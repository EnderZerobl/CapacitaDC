"""Coverage for the matching, ordering and categorization formats."""

import unittest

import test_creation
from app.api import games


class BoardGameTests(unittest.TestCase):
    def setUp(self):
        self.api = test_creation.CreationTests()
        self.api.setUp()
        self.api.app.include_router(games.router, prefix="/api")
        self.request, self.create = self.api.request, self.api.create

    def tearDown(self):
        self.api.tearDown()

    def matching_config(self):
        return {"pairs": [
            {"id": "p1", "right_id": "r1", "left": "Item um", "right": "Correspondência um", "feedback": "Comentário um"},
            {"id": "p2", "right_id": "r2", "left": "Item dois", "right": "Correspondência dois", "feedback": ""},
            {"id": "p3", "right_id": "r3", "left": "Item três", "right": "Correspondência três", "feedback": ""},
        ], "distractors": [{"id": "d1", "right": "Correspondência extra"}]}

    def ordering_config(self):
        return {"items": [{"id": f"i{n}", "text": f"Etapa {n}"} for n in range(1, 5)],
                "explanation": "A sequência segue a ordem do processo."}

    def categorization_config(self):
        return {"categories": [{"id": "c1", "text": "Categoria um", "description": "Descrição"},
                               {"id": "c2", "text": "Categoria dois", "description": ""}],
                "items": [{"id": "i1", "text": "Item um", "category_id": "c1", "feedback": "Comentário"},
                          {"id": "i2", "text": "Item dois", "category_id": "c2", "feedback": ""},
                          {"id": "i3", "text": "Item três", "category_id": "c2", "feedback": ""}]}

    def config_for(self, fmt):
        return getattr(self, f"{fmt}_config")()

    def published(self, fmt, config=None):
        game = self.create("games", {"title": f"Jogo {fmt}", "instructions": "Instruções",
                                     "eixo": "vendas", "format": fmt, "config": config or self.config_for(fmt)})
        status, game = self.request("POST", f"/api/games/{game['id']}/publish", {})
        self.assertEqual(status, 200, game)
        return game

    def node_for(self, fmt, config=None):
        game = self.published(fmt, config)
        return self.create("nodes", {"type": "game", "eixo": "vendas", "is_released": True,
                                     "game_revision_id": game["published_revision"]["id"]})

    def begin(self, node, role="membro"):
        status, attempt = self.request("POST", f"/api/nodes/{node['id']}/attempts", {}, role=role)
        self.assertEqual(status, 200, attempt)
        return attempt

    def complete(self, attempt, payload, role="membro"):
        return self.request("POST", f"/api/game-attempts/{attempt['id']}/complete", payload, role=role)

    def test_publication_rejects_inconsistent_board_configurations(self):
        invalid = {
            "matching": [
                {"pairs": [{"id": "p1", "right_id": "r1", "left": "A", "right": "B"}], "distractors": []},
                {"pairs": [{"id": "p1", "right_id": "r1", "left": "A", "right": "Igual"}, {"id": "p2", "right_id": "r2", "left": "B", "right": "igual"}], "distractors": []},
                {"pairs": [{"id": "p1", "right_id": "r1", "left": "A", "right": "B"}, {"id": "p1", "right_id": "r2", "left": "C", "right": "D"}], "distractors": []},
                {"pairs": [{"id": "p1", "right_id": "p2", "left": "A", "right": "B"}, {"id": "p2", "right_id": "r2", "left": "C", "right": "D"}], "distractors": []},
            ],
            "ordering": [
                {"items": [{"id": "i1", "text": "Única"}], "explanation": ""},
                {"items": [{"id": "i1", "text": "A"}, {"id": "i1", "text": "B"}], "explanation": ""},
            ],
            "categorization": [
                {"categories": [{"id": "c1", "text": "Uma"}], "items": [{"id": "i1", "text": "A", "category_id": "c1"}, {"id": "i2", "text": "B", "category_id": "c1"}]},
                {"categories": [{"id": "c1", "text": "Uma"}, {"id": "c2", "text": "Outra"}],
                 "items": [{"id": "i1", "text": "A", "category_id": "c1"}, {"id": "i2", "text": "B", "category_id": "c1"}]},
                {"categories": [{"id": "c1", "text": "Uma"}, {"id": "c2", "text": "Outra"}],
                 "items": [{"id": "i1", "text": "A", "category_id": "ausente"}, {"id": "i2", "text": "B", "category_id": "c2"}]},
            ],
        }
        for fmt, configs in invalid.items():
            for config in configs:
                with self.subTest(format=fmt, config=config):
                    game = self.create("games", {"title": "Rascunho", "eixo": "vendas", "format": fmt, "config": config})
                    status, body = self.request("POST", f"/api/games/{game['id']}/publish", {})
                    self.assertEqual(status, 422, body)
            self.published(fmt)

    def test_board_hides_the_answer_key_and_keeps_the_same_arrangement(self):
        for fmt in ["matching", "ordering", "categorization"]:
            with self.subTest(format=fmt):
                node = self.node_for(fmt)
                attempt = self.begin(node)
                board = attempt["board"]
                self.assertEqual(attempt["questions"], [])
                self.assertIsNone(attempt["current_step"])
                self.assertTrue(attempt["can_finish"])
                serialized = repr(board)
                for leak in ["is_correct", "category_id", "feedback", "next_step_id"]:
                    self.assertNotIn(leak, serialized)
                if fmt == "matching":
                    self.assertEqual(len(board["right"]), 4)
                    self.assertFalse({card["id"] for card in board["left"]} & {card["id"] for card in board["right"]})
                    self.assertEqual([card["text"] for card in board["left"]], ["Item um", "Item dois", "Item três"])
                if fmt == "categorization":
                    self.assertEqual([category["text"] for category in board["categories"]], ["Categoria um", "Categoria dois"])
                self.assertEqual(self.begin(node)["board"], board)
                # A trilha é sequencial: sem remover, a etapa seguinte do mesmo eixo
                # ficaria esperando esta ser concluída.
                self.request("DELETE", f"/api/nodes/{node['id']}")

    def test_ordering_shuffles_longer_sequences_for_the_player(self):
        config = {"items": [{"id": f"i{n}", "text": f"Etapa {n}"} for n in range(1, 13)], "explanation": ""}
        attempt = self.begin(self.node_for("ordering", config))
        expected = [item["id"] for item in config["items"]]
        self.assertNotEqual([item["id"] for item in attempt["board"]["items"]], expected)
        self.assertEqual(sorted(item["id"] for item in attempt["board"]["items"]), sorted(expected))

    def test_server_scores_each_format_and_normalizes_to_one_hundred(self):
        cases = [
            ("matching", {"matches": [{"left_id": "p1", "right_id": "r1"}, {"left_id": "p2", "right_id": "r2"}, {"left_id": "p3", "right_id": "r3"}]},
             {"matches": [{"left_id": "p1", "right_id": "d1"}, {"left_id": "p2", "right_id": "r2"}, {"left_id": "p3", "right_id": "r3"}]}, 67),
            ("ordering", {"order": ["i1", "i2", "i3", "i4"]}, {"order": ["i2", "i1", "i3", "i4"]}, 50),
            ("categorization", {"placements": [{"item_id": "i1", "category_id": "c1"}, {"item_id": "i2", "category_id": "c2"}, {"item_id": "i3", "category_id": "c2"}]},
             {"placements": [{"item_id": "i1", "category_id": "c2"}, {"item_id": "i2", "category_id": "c2"}, {"item_id": "i3", "category_id": "c2"}]}, 67),
        ]
        accumulated = 0
        for fmt, perfect, partial, partial_score in cases:
            with self.subTest(format=fmt):
                node = self.node_for(fmt)
                status, result = self.complete(self.begin(node), partial)
                self.assertEqual(status, 200, result)
                self.assertEqual(result["result"]["attempt_score"], partial_score)
                self.assertEqual(result["result"]["max_score"], 100)
                self.assertEqual(result["result"]["score_added"], partial_score)
                self.assertIsNone(result["board"])
                wrong = [item for item in result["result"]["feedback"] if not item["is_correct"]]
                self.assertTrue(all(item["explanation"] for item in wrong), result["result"]["feedback"])
                status, result = self.complete(self.begin(node), perfect)
                self.assertEqual(status, 200, result)
                self.assertEqual(result["result"]["attempt_score"], 100)
                self.assertEqual(result["result"]["score_added"], 100 - partial_score)
                accumulated += 100
                self.assertEqual(result["result"]["user_total_points"], accumulated)
                self.assertTrue(all(item["is_correct"] for item in result["result"]["feedback"]))
                self.request("DELETE", f"/api/nodes/{node['id']}")

    def test_ordering_returns_the_author_note_and_other_formats_do_not(self):
        status, result = self.complete(self.begin(self.node_for("ordering")), {"order": ["i1", "i2", "i3", "i4"]})
        self.assertEqual(status, 200)
        self.assertEqual(result["result"]["note"], "A sequência segue a ordem do processo.")
        status, result = self.complete(self.begin(self.node_for("matching")),
                                       {"matches": [{"left_id": f"p{n}", "right_id": f"r{n}"} for n in range(1, 4)]})
        self.assertEqual(result["result"]["note"], "")

    def test_incomplete_forged_and_foreign_payloads_are_rejected(self):
        cases = {
            "matching": [
                {"matches": [{"left_id": "p1", "right_id": "r1"}]},
                {"matches": [{"left_id": "p1", "right_id": "r1"}, {"left_id": "p2", "right_id": "r1"}, {"left_id": "p3", "right_id": "r3"}]},
                {"matches": [{"left_id": "p1", "right_id": "ausente"}, {"left_id": "p2", "right_id": "r2"}, {"left_id": "p3", "right_id": "r3"}]},
                {"matches": [{"left_id": "fora", "right_id": "p1"}, {"left_id": "p2", "right_id": "r2"}, {"left_id": "p3", "right_id": "r3"}]},
                {"order": ["i1", "i2", "i3", "i4"]},
                {"answers": [{"question_id": "q1", "option_ids": ["a"]}]},
            ],
            "ordering": [
                {"order": ["i1", "i2", "i3"]},
                {"order": ["i1", "i1", "i2", "i3"]},
                {"order": ["i1", "i2", "i3", "ausente"]},
                {"placements": [{"item_id": "i1", "category_id": "c1"}]},
            ],
            "categorization": [
                {"placements": [{"item_id": "i1", "category_id": "c1"}]},
                {"placements": [{"item_id": "i1", "category_id": "ausente"}, {"item_id": "i2", "category_id": "c2"}, {"item_id": "i3", "category_id": "c2"}]},
                {"placements": [{"item_id": "i1", "category_id": "c1"}, {"item_id": "i1", "category_id": "c1"}, {"item_id": "i2", "category_id": "c2"}, {"item_id": "i3", "category_id": "c2"}]},
                {"matches": [{"left_id": "p1", "right_id": "r1"}]},
            ],
        }
        for fmt, payloads in cases.items():
            node = self.node_for(fmt)
            attempt = self.begin(node)
            for payload in payloads:
                with self.subTest(format=fmt, payload=payload):
                    status, body = self.complete(attempt, payload)
                    self.assertEqual(status, 400, body)
            status, body = self.complete(attempt, {"score": 100})
            self.assertEqual(status, 422, body)
            status, listing = self.request("GET", "/api/nodes", role="membro")
            self.assertFalse(next(item for item in listing if item["id"] == node["id"])["completed"])
            self.request("DELETE", f"/api/nodes/{node['id']}")

    def test_scenario_still_refuses_board_payloads(self):
        scenario = {"start_step_id": "s1", "steps": [{"id": "s1", "text": "Passo", "options": [
            {"id": "a", "text": "Decisão A", "score": 10, "feedback": "", "next_step_id": None},
            {"id": "b", "text": "Decisão B", "score": 0, "feedback": "", "next_step_id": None}]}]}
        node = self.node_for("scenario", scenario)
        attempt = self.begin(node)
        status, _ = self.complete(attempt, {"order": ["s1"]})
        self.assertEqual(status, 400)
        status, attempt = self.request("POST", f"/api/game-attempts/{attempt['id']}/answers", {"step_id": "s1", "option_id": "a"}, role="membro")
        self.assertEqual(status, 200, attempt)
        status, result = self.complete(attempt, {})
        self.assertEqual(status, 200, result)
        self.assertEqual(result["result"]["attempt_score"], 100)
