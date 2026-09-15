"""API regression coverage for reusable quizzes, scenarios and migrations."""

from concurrent.futures import ThreadPoolExecutor
from tempfile import TemporaryDirectory
from threading import Barrier
import unittest

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

import test_creation
from app import models
from app.api import games
from app.migrations import migrate
from app.game_schemas import AttemptComplete
from app.services import game_service


class GameTests(unittest.TestCase):
    def setUp(self):
        self.api = test_creation.CreationTests()
        self.api.setUp()
        self.api.app.include_router(games.router, prefix="/api")
        self.request, self.create = self.api.request, self.api.create
        with self.api.sessions() as db:
            db.add(models.User(id="trainee", name="Trainee", email="trainee@example.com", type="trainee", cargo="Trainee", password_hash="unused"))
            db.commit()

    def tearDown(self):
        self.api.tearDown()

    def quiz_config(self):
        return {"questions": [
            {"id": "q1", "text": "Pergunta 1", "selection": "single", "weight": 1, "explanation": "Explicação 1",
             "options": [{"id": "a", "text": "Opção A", "is_correct": True, "feedback": "Feedback A"},
                         {"id": "b", "text": "Opção B", "is_correct": False}]},
            {"id": "q2", "text": "Pergunta 2", "selection": "multiple", "weight": 3,
             "options": [{"id": "c", "text": "Opção C", "is_correct": True},
                         {"id": "d", "text": "Opção D", "is_correct": True},
                         {"id": "e", "text": "Opção E", "is_correct": False}]},
        ]}

    def scenario_config(self):
        return {"start_step_id": "s1", "steps": [
            {"id": "s1", "text": "Passo 1", "options": [
                {"id": "a", "text": "Decisão A", "score": 30, "feedback": "Consequência A", "next_step_id": "s2"},
                {"id": "b", "text": "Decisão B", "score": 20, "next_step_id": None}]},
            {"id": "s2", "text": "Passo 2", "options": [
                {"id": "c", "text": "Decisão C", "score": 70, "next_step_id": None},
                {"id": "d", "text": "Decisão D", "score": 0, "next_step_id": None}]},
        ]}

    def game(self, format="quiz", eixo="vendas", published=True):
        config = self.quiz_config() if format == "quiz" else self.scenario_config()
        game = self.create("games", {"title": "Jogo", "instructions": "Instruções", "eixo": eixo, "format": format, "config": config})
        if published:
            status, game = self.request("POST", f"/api/games/{game['id']}/publish", {})
            self.assertEqual(status, 200, game)
        return game

    def node(self, game=None, **overrides):
        game = game or self.game()
        return self.create("nodes", {"type": "game", "eixo": game["eixo"], "game_revision_id": game["published_revision"]["id"], "is_released": True, **overrides})

    def begin(self, node, role="membro"):
        status, attempt = self.request("POST", f"/api/nodes/{node['id']}/attempts", {}, role=role)
        self.assertEqual(status, 200, attempt)
        return attempt

    def complete(self, attempt, correct=True):
        answers = [{"question_id": "q1", "option_ids": ["a" if correct else "b"]},
                   {"question_id": "q2", "option_ids": ["c", "d"] if correct else ["c"]}]
        return self.request("POST", f"/api/game-attempts/{attempt['id']}/complete", {"answers": answers}, role="membro")

    def test_draft_publication_duplicate_and_immutable_revisions(self):
        draft = self.create("games", {"title": "Rascunho", "eixo": "vendas", "format": "quiz"})
        self.assertIsNone(draft["published_revision"])
        status, _ = self.request("POST", f"/api/games/{draft['id']}/publish", {})
        self.assertEqual(status, 422)
        game = self.game()
        node = self.node(game)
        revision = game["published_revision"]
        status, unchanged = self.request("POST", f"/api/games/{game['id']}/publish", {})
        self.assertEqual(unchanged["published_revision"]["id"], revision["id"])
        status, updated = self.request("PATCH", f"/api/games/{game['id']}", {"title": "Título revisado"})
        self.assertTrue(updated["has_unpublished_changes"])
        _, second = self.request("POST", f"/api/games/{game['id']}/publish", {})
        self.assertEqual(second["published_revision"]["version"], 2)
        attempt = self.begin(node)
        self.assertEqual(attempt["title"], "Jogo")
        self.assertEqual(attempt["game_revision_id"], revision["id"])
        _, revisions = self.request("GET", f"/api/games/{game['id']}/revisions")
        self.assertEqual(revisions[0]["title"], "Jogo")
        _, duplicate = self.request("POST", f"/api/games/{game['id']}/duplicate", {})
        self.assertIsNone(duplicate["published_revision"])
        self.assertEqual(duplicate["config"], second["config"])
        status, _ = self.request("DELETE", f"/api/games/{game['id']}")
        self.assertEqual(status, 409)
        status, _ = self.request("DELETE", f"/api/games/{draft['id']}")
        self.assertEqual(status, 200)

    def test_publication_validates_quiz_answers_and_graph_integrity(self):
        configs = []
        quiz = self.quiz_config()
        quiz["questions"][0]["options"][1]["is_correct"] = True
        configs.append(("quiz", quiz))
        quiz = self.quiz_config()
        quiz["questions"][1]["id"] = "q1"
        configs.append(("quiz", quiz))
        quiz = self.quiz_config()
        quiz["questions"][0]["weight"] = 0
        configs.append(("quiz", quiz))
        for mode in ["cycle", "missing", "unreachable", "zero"]:
            config = self.scenario_config()
            if mode == "cycle": config["steps"][1]["options"][0]["next_step_id"] = "s1"
            if mode == "missing": config["steps"][0]["options"][0]["next_step_id"] = "absent"
            if mode == "unreachable": config["steps"][0]["options"][0]["next_step_id"] = None
            if mode == "zero":
                for step in config["steps"]:
                    for option in step["options"]: option["score"] = 0
            configs.append(("scenario", config))
        for format, config in configs:
            with self.subTest(config=config):
                draft = self.create("games", {"title": "Inválido", "eixo": "vendas", "format": format, "config": config})
                status, _ = self.request("POST", f"/api/games/{draft['id']}/publish", {})
                self.assertEqual(status, 422)

    def test_attempt_hides_answer_keys_and_resumes_without_duplicates(self):
        node = self.node()
        self.assertEqual(node["game_format"], "quiz")
        first = self.begin(node)
        second = self.begin(node)
        self.assertEqual(first["id"], second["id"])
        self.assertIsNone(first["result"])
        for question in first["questions"]:
            self.assertNotIn("explanation", question)
            self.assertNotIn("weight", question)
            for option in question["options"]:
                self.assertEqual(set(option), {"id", "text"})
        status, _ = self.request("GET", "/api/games", role="membro")
        self.assertEqual(status, 403)
        status, _ = self.request("POST", f"/api/nodes/{node['id']}/submit-game", {"answers": [{"question_id": "q1", "option_id": "a"}]}, role="membro")
        self.assertEqual(status, 400)
        with self.api.sessions() as db:
            self.assertEqual(db.query(models.GameAttempt).count(), 1)
            self.assertEqual(db.query(models.UserNodeProgress).count(), 0)

    def test_quiz_exact_selection_normalization_and_retry_idempotency(self):
        node = self.node()
        attempt = self.begin(node)
        answers = {"answers": [{"question_id": "q1", "option_ids": ["a"]}, {"question_id": "q2", "option_ids": ["c"]}]}
        status, partial = self.request("POST", f"/api/game-attempts/{attempt['id']}/complete", answers, role="membro")
        self.assertEqual(status, 200, partial)
        self.assertEqual(partial["result"]["attempt_score"], 25)
        self.assertEqual(partial["result"]["score_added"], 25)
        self.assertEqual(partial["result"]["feedback"][0]["explanation"], "Explicação 1")
        status, repeated = self.request("POST", f"/api/game-attempts/{attempt['id']}/complete", answers, role="membro")
        self.assertEqual(repeated, partial)
        next_attempt = self.begin(node)
        self.assertNotEqual(next_attempt["id"], attempt["id"])
        status, perfect = self.complete(next_attempt)
        self.assertEqual(status, 200, perfect)
        self.assertEqual(perfect["result"]["attempt_score"], 100)
        self.assertEqual(perfect["result"]["score_added"], 75)
        status, worse = self.complete(self.begin(node), correct=False)
        self.assertEqual(worse["result"]["score_added"], 0)
        self.assertEqual(worse["result"]["total_score"], 100)
        with self.api.sessions() as db:
            self.assertEqual(db.query(models.UserNodeProgress).count(), 1)
            self.assertEqual(db.get(models.User, "membro").pontos_acumulados, 100)

    def test_forged_choices_scores_and_incomplete_quizzes_are_rejected(self):
        attempt = self.begin(self.node())
        cases = [
            {"score": 99999}, {},
            {"answers": [{"question_id": "q1", "option_ids": ["c"]}, {"question_id": "q2", "option_ids": ["c", "d"]}]},
            {"answers": [{"question_id": "q1", "option_ids": ["a", "b"]}, {"question_id": "q2", "option_ids": ["c", "d"]}]},
            {"answers": [{"question_id": "q1", "option_ids": ["a"]}, {"question_id": "q2", "option_ids": ["c", "c"]}]},
            {"answers": [{"question_id": "q1", "option_ids": ["a"]}, {"question_id": "q1", "option_ids": ["a"]}]},
        ]
        for payload in cases:
            status, _ = self.request("POST", f"/api/game-attempts/{attempt['id']}/complete", payload, role="membro")
            self.assertIn(status, [400, 422])
        with self.api.sessions() as db:
            self.assertEqual(db.query(models.UserNodeProgress).count(), 0)
            self.assertEqual(db.get(models.GameAttempt, attempt["id"]).status, "in_progress")

    def test_scenario_server_controls_sequence_and_final_result(self):
        attempt = self.begin(self.node(self.game(format="scenario")))
        base = f"/api/game-attempts/{attempt['id']}"
        self.assertEqual(attempt["current_step"]["id"], "s1")
        self.assertNotIn("next_step_id", attempt["current_step"]["options"][0])
        status, _ = self.request("POST", base + "/complete", {}, role="membro")
        self.assertEqual(status, 400)
        status, _ = self.request("POST", base + "/answers", {"step_id": "s2", "option_id": "c"}, role="membro")
        self.assertEqual(status, 400)
        status, first = self.request("POST", base + "/answers", {"step_id": "s1", "option_id": "a"}, role="membro")
        self.assertEqual(first["current_step"]["id"], "s2")
        self.assertIsNone(first["result"])
        _, replay = self.request("POST", base + "/answers", {"step_id": "s1", "option_id": "a"}, role="membro")
        self.assertEqual(replay, first)
        status, _ = self.request("POST", base + "/answers", {"step_id": "s1", "option_id": "b"}, role="membro")
        self.assertEqual(status, 409)
        _, final_step = self.request("POST", base + "/answers", {"step_id": "s2", "option_id": "c"}, role="membro")
        self.assertTrue(final_step["can_finish"])
        self.assertIsNone(final_step["current_step"])
        status, done = self.request("POST", base + "/complete", {}, role="membro")
        self.assertEqual(status, 200, done)
        self.assertEqual(done["result"]["attempt_score"], 100)
        self.assertEqual(done["result"]["feedback"][0]["feedback"], "Consequência A")

    def test_access_authorship_axis_release_prerequisite_and_attempt_ownership(self):
        game = self.game()
        for path in ["/api/games", f"/api/games/{game['id']}", f"/api/games/{game['id']}/revisions"]:
            status, _ = self.request("GET", path, role="membro")
            self.assertEqual(status, 403)
        status, _ = self.request("PATCH", f"/api/games/{game['id']}", {"title": "Fora do eixo"}, role="organizador")
        self.assertEqual(status, 403)
        status, _ = self.request("PATCH", f"/api/games/{game['id']}", {"eixo": "trainee"})
        self.assertEqual(status, 409)
        status, _ = self.request("POST", "/api/nodes", {"type": "game", "eixo": "trainee", "game_revision_id": game["published_revision"]["id"]})
        self.assertEqual(status, 400)
        node = self.node(game)
        blocked = self.node(game, is_released=False)
        prerequisite = self.node(game, prerequisite_node_id=blocked["id"])
        for target in [blocked, prerequisite]:
            status, _ = self.request("POST", f"/api/nodes/{target['id']}/attempts", {}, role="membro")
            self.assertEqual(status, 403)
        status, _ = self.request("POST", f"/api/nodes/{node['id']}/attempts", {}, role="trainee")
        self.assertEqual(status, 403)
        attempt = self.begin(node)
        status, _ = self.request("GET", f"/api/game-attempts/{attempt['id']}", role="trainee")
        self.assertEqual(status, 403)
        self.request("PATCH", f"/api/nodes/{node['id']}/release", {"is_released": False})
        status, _ = self.complete(attempt)
        self.assertEqual(status, 403)

    def test_one_publication_can_have_independent_progress_in_two_nodes(self):
        game = self.game()
        for _ in range(2):
            node = self.node(game)
            status, attempt = self.complete(self.begin(node))
            self.assertEqual(status, 200, attempt)
            self.assertEqual(attempt["result"]["score_added"], 100)
        with self.api.sessions() as db:
            self.assertEqual(db.query(models.UserNodeProgress).count(), 2)
            self.assertEqual(db.get(models.User, "membro").pontos_acumulados, 200)

    def test_trailing_slashes_authorized_organizer_and_trainee(self):
        for suffix in ["", "/"]:
            game = self.create("games", {"title": "Jogo", "eixo": "trainee", "format": "quiz", "config": self.quiz_config()}, suffix=suffix, role="organizador")
            status, published = self.request("POST", f"/api/games/{game['id']}/publish", {}, role="organizador")
            self.assertEqual(status, 200)
            node = self.node(published)
            self.begin(node, role="trainee")
            # Cada volta cria a etapa seguinte do mesmo eixo, que esperaria esta.
            self.request("DELETE", f"/api/nodes/{node['id']}")
            status, listing = self.request("GET", "/api/games" + suffix, role="organizador")
            self.assertEqual(status, 200)
            self.assertTrue(all(item["eixo"] == "trainee" for item in listing))

    def test_existing_legacy_quiz_remains_playable_after_migration(self):
        node = self.create("nodes", {"name": "Legado", "type": "game", "eixo": "vendas", "is_released": True,
                                    "questions": [{"text": "Pergunta", "options": [
                                        {"text": "A", "score": 35, "is_correct": True}, {"text": "B", "score": 10}]}]})
        path = f"/api/nodes/{node['id']}/submit-game"
        answers = {"answers": [{"question_id": node["questions"][0]["id"], "option_id": node["questions"][0]["options"][1]["id"]}]}
        self.request("POST", path, answers, role="membro")
        # Recreate the legacy table shape without the newly introduced column.
        # SQLite cannot drop a column used by a table-level foreign key, so make
        # a copy of its exact old fields before invoking the migration.
        with self.api.engine.begin() as db:
            columns = [column["name"] for column in inspect(db).get_columns("training_nodes") if column["name"] != "game_revision_id"]
            fields = ", ".join(columns)
            db.execute(text(f"CREATE TABLE legacy_nodes AS SELECT {fields} FROM training_nodes"))
            db.execute(text("DROP TABLE training_nodes"))
            db.execute(text("ALTER TABLE legacy_nodes RENAME TO training_nodes"))
        migrate(self.api.engine)
        migrate(self.api.engine)
        status, listing = self.request("GET", "/api/nodes", role="membro")
        self.assertEqual(status, 200, listing)
        self.assertEqual(listing[0]["user_score"], 10)
        self.assertEqual(listing[0]["questions"][0]["id"], node["questions"][0]["id"])
        answers["answers"][0]["option_id"] = node["questions"][0]["options"][0]["id"]
        status, result = self.request("POST", path, answers, role="membro")
        self.assertEqual(status, 200, result)
        self.assertEqual(result["score_added"], 25)
        self.assertEqual(result["user_total_points"], 35)

    def test_simultaneous_completions_award_points_once_on_sqlite(self):
        node = self.node()
        attempt = self.begin(node)
        # Separate connections and a real SQLite file exercise its write locking.
        with TemporaryDirectory(prefix="capacita-games-") as directory:
            engine = create_engine(f"sqlite:///{directory}/concurrent.db", connect_args={"check_same_thread": False})
            with self.api.engine.connect() as source, engine.connect() as target:
                source.connection.driver_connection.backup(target.connection.driver_connection)
            sessions = sessionmaker(bind=engine)
            barrier = Barrier(2)
            payload = AttemptComplete.model_validate({"answers": [
                {"question_id": "q1", "option_ids": ["a"]}, {"question_id": "q2", "option_ids": ["c", "d"]}]})

            def complete():
                with sessions() as db:
                    user = db.get(models.User, "membro")
                    barrier.wait(timeout=5)
                    return game_service.complete_attempt(db, attempt["id"], user, payload)

            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(complete) for _ in range(2)]
                results = [future.result(timeout=10) for future in futures]
            self.assertEqual(results[0], results[1])
            with sessions() as db:
                self.assertEqual(db.get(models.User, "membro").pontos_acumulados, 100)
                self.assertEqual(db.query(models.UserNodeProgress).count(), 1)
            engine.dispose()


class GameMigrationTests(unittest.TestCase):
    def test_old_schema_migrates_idempotently_preserving_quiz_and_best_progress(self):
        engine = create_engine("sqlite://")
        with engine.begin() as db:
            db.execute(text("CREATE TABLE training_nodes (id VARCHAR PRIMARY KEY, name VARCHAR, type VARCHAR)"))
            db.execute(text("CREATE TABLE user_node_progress (id VARCHAR PRIMARY KEY, user_id VARCHAR, node_id VARCHAR, completed BOOLEAN, score INTEGER, completed_at TIMESTAMP)"))
            db.execute(text("INSERT INTO training_nodes(id, name, type) VALUES ('legacy', 'Quiz existente', 'game')"))
            db.execute(text("INSERT INTO user_node_progress VALUES ('a', 'member', 'legacy', false, 10, NULL), ('b', 'member', 'legacy', true, 35, '2026-01-01 00:00:00')"))
        migrate(engine)
        migrate(engine)
        self.assertIn("game_revision_id", {column["name"] for column in inspect(engine).get_columns("training_nodes")})
        with engine.connect() as db:
            self.assertEqual(db.execute(text("SELECT id, name, game_revision_id FROM training_nodes")).one(), ("legacy", "Quiz existente", None))
            progress = db.execute(text("SELECT completed, score FROM user_node_progress")).one()
            self.assertEqual(progress, (1, 35))
            # Rodar duas vezes não pode registrar a mesma versão de novo. Contar
            # versões distintas evita que este teste quebre a cada migração nova.
            applied = db.execute(text("SELECT COUNT(*), COUNT(DISTINCT version) FROM schema_migrations")).one()
            self.assertEqual(applied[0], applied[1])
            self.assertGreaterEqual(applied[0], 3)
        engine.dispose()

    def test_retired_pluginfo_rows_are_converted_to_trainee_once(self):
        """A migração converte o eixo aposentado sem liberar conteúdo que estava oculto."""
        from app.database import Base
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        with engine.begin() as db:
            db.execute(text(
                "INSERT INTO training_nodes(id, name, type, eixo, order_index, is_released, released_at) VALUES "
                "('t0', 'Etapa trainee', 'material', 'trainee', 0, 1, NULL), "
                "('t1', 'Outra trainee', 'material', 'trainee', 1, 1, NULL), "
                "('p0', 'Etapa antiga', 'material', 'pluginfo', 0, 1, '2026-01-01 00:00:00')"
            ))
            db.execute(text("INSERT INTO materials(id, name, type, eixo) VALUES ('m0', 'Material', 'pluginfo', 'pluginfo')"))
            db.execute(text(
                "INSERT INTO activities(id, title, eixo, accepts_file, is_open, weight) "
                "VALUES ('a0', 'Atividade', 'pluginfo', 1, 1, 1.0)"
            ))
            db.execute(text(
                "INSERT INTO games(id, title, eixo, format, config, instructions, created_at, updated_at) "
                "VALUES ('g0', 'Jogo', 'pluginfo', 'quiz', '{}', '', '2026-01-01 00:00:00', '2026-01-01 00:00:00')"
            ))
        migrate(engine)
        migrate(engine)
        with engine.connect() as db:
            self.assertEqual(db.execute(text("SELECT COUNT(*) FROM training_nodes WHERE eixo = 'pluginfo'")).scalar_one(), 0)
            converted = db.execute(text(
                "SELECT eixo, order_index, is_released, released_at FROM training_nodes WHERE id = 'p0'"
            )).one()
            self.assertEqual(converted, ("trainee", 2, 0, None))
            self.assertEqual(db.execute(text("SELECT type, eixo FROM materials WHERE id = 'm0'")).one(), ("trainee", "trainee"))
            self.assertEqual(db.execute(text("SELECT eixo FROM activities WHERE id = 'a0'")).scalar_one(), "trainee")
            self.assertEqual(db.execute(text("SELECT eixo FROM games WHERE id = 'g0'")).scalar_one(), "trainee")
            self.assertEqual(db.execute(text("SELECT COUNT(*) FROM schema_migrations WHERE version = 3")).scalar_one(), 1)
        engine.dispose()
