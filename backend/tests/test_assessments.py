"""Repetition controls and mandatory weighted grades across games and deliveries."""
import unittest
from sqlalchemy import text

import test_grading
from app import models
from app.api import games
from app.migrations import migrate
from app.services.activity_service import axis_metrics


class AssessmentTests(unittest.TestCase):
    def setUp(self):
        self.base = test_grading.GradingTests()
        self.base.setUp()
        self.api = self.base.api
        self.api.app.include_router(games.router, prefix='/api')
        self.request, self.create = self.api.request, self.api.create

    def tearDown(self):
        self.base.tearDown()

    def activity(self, **settings):
        return self.create('activities', {'title': 'Entrega', 'eixo': 'trainee', 'accepts_file': False, **settings})

    def deliver(self, activity, comment='Primeira entrega'):
        status, result = self.request('POST', f"/api/activities/{activity['id']}/submit", {'comment': comment}, role='trainee')
        self.assertEqual(status, 200, result)
        return result

    def grade(self, activity, submission, grade):
        status, result = self.request('PATCH', f"/api/activities/{activity['id']}/submissions/{submission['id']}", {'grade': grade})
        self.assertEqual(status, 200, result)
        return result

    def game(self, **settings):
        eixo = settings.pop('eixo', 'trainee')
        game = self.create('games', {'title': 'Questionário', 'eixo': eixo, 'format': 'quiz', 'config': {'questions': [
            {'id': 'q', 'text': 'Escolha', 'options': [{'id': 'yes', 'text': 'Certa', 'is_correct': True}, {'id': 'no', 'text': 'Errada'}]},
        ]}})
        status, game = self.request('POST', f"/api/games/{game['id']}/publish", {})
        self.assertEqual(status, 200, game)
        return self.create('nodes', {'type': 'game', 'eixo': eixo, 'game_revision_id': game['published_revision']['id'], 'is_released': True, **settings})

    def begin(self, node, role='trainee'):
        status, result = self.request('POST', f"/api/nodes/{node['id']}/attempts", {}, role=role)
        self.assertEqual(status, 200, result)
        return result

    def finish(self, attempt, correct=True, role='trainee'):
        return self.request('POST', f"/api/game-attempts/{attempt['id']}/complete", {'answers': [{'question_id': 'q', 'option_ids': ['yes' if correct else 'no']}]}, role=role)

    def average(self):
        return self.base.grade_of('trainee')

    def test_required_delivery_and_game_share_weighted_average(self):
        activity = self.activity(weight=2)
        self.grade(activity, self.deliver(activity), 4)
        node = self.game(weight=1)
        status, completed = self.finish(self.begin(node))
        self.assertEqual(status, 200, completed)
        self.assertEqual(completed['result']['grade'], 10)
        self.assertEqual(self.average(), 6)
        _, nodes = self.request('GET', '/api/nodes', role='trainee')
        self.assertEqual(nodes[0]['grade'], 10)
        self.request('PATCH', f"/api/nodes/{node['id']}", {'weight': 4})
        self.assertEqual(self.average(), 8)
        self.request('PATCH', f"/api/nodes/{node['id']}", {'is_required': False})
        self.assertEqual(self.average(), 4)
        self.request('PATCH', f"/api/nodes/{node['id']}", {'is_required': True})
        self.assertEqual(self.average(), 8)
        self.request('DELETE', f"/api/nodes/{node['id']}")
        self.assertEqual(self.average(), 4)

    def test_optional_assessments_do_not_count_and_do_not_block_next_step(self):
        activity = self.activity(is_required=False, weight=5)
        self.grade(activity, self.deliver(activity), 10)
        self.assertIsNone(self.average())
        optional = self.game(is_required=False, weight=7)
        required = self.game(weight=2)
        self.assertEqual(self.finish(self.begin(required))[0], 200)
        self.assertEqual(self.average(), 10)
        self.finish(self.begin(optional), correct=False)
        self.assertEqual(self.average(), 10)
        self.request('PATCH', f"/api/activities/{activity['id']}", {'is_required': True})
        self.assertEqual(self.average(), 10)

    def test_making_step_required_cannot_close_a_prerequisite_cycle(self):
        first, second, third = self.game(is_required=False), self.game(), self.game()
        # Opcional, a primeira não segura a segunda: primeira → terceira → segunda → fim.
        self.assertEqual(self.request('PATCH', f"/api/nodes/{first['id']}", {'prerequisite_node_id': third['id']})[0], 200)
        # Obrigatória, a segunda passaria a depender dela e a corrente fecharia.
        status, result = self.request('PATCH', f"/api/nodes/{first['id']}", {'is_required': True})
        self.assertEqual(status, 400, result)
        _, nodes = self.request('GET', '/api/nodes')
        self.assertFalse(next(node for node in nodes if node['id'] == first['id'])['is_required'])
        self.assertEqual(self.finish(self.begin(second))[0], 200)

    def test_single_game_attempt_is_resumable_and_completed_result_is_read_only(self):
        node = self.game(allow_retry=False)
        attempt = self.begin(node)
        self.assertEqual(self.begin(node)['id'], attempt['id'])
        status, completed = self.finish(attempt, correct=False)
        self.assertEqual(status, 200, completed)
        self.assertEqual(completed['result']['grade'], 0)
        reopened = self.begin(node)
        self.assertEqual(reopened['id'], attempt['id'])
        self.assertEqual(reopened['status'], 'completed')
        self.assertEqual(self.finish(attempt, correct=True)[1]['result']['grade'], 0)
        self.assertEqual(self.average(), 0)
        with self.api.sessions() as db:
            self.assertEqual(db.query(models.GameAttempt).count(), 1)

    def test_repeating_game_keeps_best_grade_and_respects_later_disabling(self):
        node = self.game()
        self.finish(self.begin(node), correct=True)
        status, worse = self.finish(self.begin(node), correct=False)
        self.assertEqual(status, 200, worse)
        self.assertEqual(worse['result']['grade'], 0)
        self.assertEqual(worse['result']['best_grade'], 10)
        self.assertEqual(self.average(), 10)
        active = self.begin(node)
        self.request('PATCH', f"/api/nodes/{node['id']}", {'allow_retry': False})
        self.assertEqual(self.finish(active)[0], 409)
        self.assertEqual(self.begin(node)['status'], 'completed')

    def test_single_activity_delivery_rejects_replacement_and_upload(self):
        activity = self.activity(allow_retry=False)
        submission = self.deliver(activity)
        self.grade(activity, submission, 7)
        status, _ = self.request('POST', f"/api/activities/{activity['id']}/submit", {'comment': 'Tentativa de reenvio'}, role='trainee')
        self.assertEqual(status, 409)
        status, _ = self.request('POST', f"/api/activities/{activity['id']}/attachments/upload-token", {'name': 'a.pdf', 'size': 20}, role='trainee')
        self.assertEqual(status, 409)
        self.assertEqual(self.average(), 7)
        with self.api.sessions() as db:
            self.assertEqual(db.get(models.ActivitySubmission, submission['id']).comment, 'Primeira entrega')
        self.request('PATCH', f"/api/activities/{activity['id']}", {'allow_retry': True})
        self.assertEqual(self.deliver(activity, 'Reenvio permitido')['previous_grade'], 7)

    def test_repeat_delivery_keeps_prior_best_but_allows_correcting_current_grade(self):
        activity = self.activity()
        submission = self.deliver(activity)
        self.grade(activity, submission, 8)
        # Correção da mesma entrega deve substituir uma nota lançada errada.
        self.grade(activity, submission, 6)
        self.assertEqual(self.average(), 6)
        retry = self.deliver(activity, 'Nova entrega')
        self.assertIsNone(retry['grade'])
        self.assertEqual(retry['effective_grade'], 6)
        self.assertEqual(self.average(), 6)
        self.assertEqual(self.grade(activity, retry, 4)['effective_grade'], 6)
        self.assertEqual(self.average(), 6)
        self.grade(activity, retry, 9)
        self.assertEqual(self.average(), 9)
        self.request('PATCH', f"/api/activities/{activity['id']}", {'is_required': False})
        self.assertIsNone(self.average())

    def test_mandatory_weight_validation_and_participant_cannot_change_rules(self):
        for value in [0, -1, 'NaN', 'Infinity']:
            self.assertEqual(self.request('POST', '/api/activities', {'title': 'Inválida', 'eixo': 'trainee', 'weight': value})[0], 422)
        activity, node = self.activity(), self.game()
        for path in [f"/api/activities/{activity['id']}", f"/api/nodes/{node['id']}"]:
            for payload in [{'weight': 0}, {'weight': None}, {'allow_retry': None}, {'is_required': None}]:
                self.assertEqual(self.request('PATCH', path, payload)[0], 422)
            self.assertEqual(self.request('PATCH', path, {'allow_retry': True}, role='trainee')[0], 403)
            self.assertEqual(self.request('PATCH', path, {'is_required': False, 'weight': 0})[0], 200)
            self.assertEqual(self.request('PATCH', path, {'is_required': True})[0], 422)

    def weighted_game(self, **settings):
        # Weights 69/1/30 reach exactly 6.9 and 7.0 without rounding.
        questions = [{'id': key, 'text': key, 'weight': weight, 'options': [
            {'id': f'{key}-yes', 'text': 'Certa', 'is_correct': True}, {'id': f'{key}-no', 'text': 'Errada'}]}
            for key, weight in [('a', 69), ('b', 1), ('c', 30)]]
        game = self.create('games', {'title': 'Pesos', 'eixo': 'trainee', 'format': 'quiz', 'config': {'questions': questions}})
        status, game = self.request('POST', f"/api/games/{game['id']}/publish", {})
        self.assertEqual(status, 200, game)
        return self.create('nodes', {'type': 'game', 'eixo': 'trainee', 'game_revision_id': game['published_revision']['id'], 'is_released': True, **settings})

    def finish_with(self, node, right):
        attempt = self.begin(node)
        status, result = self.request('POST', f"/api/game-attempts/{attempt['id']}/complete", {'answers': [
            {'question_id': key, 'option_ids': [f"{key}-{'yes' if key in right else 'no'}"]} for key in 'abc']}, role='trainee')
        self.assertEqual(status, 200, result)
        return result

    def unlocked(self, node):
        _, nodes = self.request('GET', '/api/nodes', role='trainee')
        return next(item for item in nodes if item['id'] == node['id'])['unlocked']

    def test_repeatable_game_needs_minimum_grade_to_conclude_step(self):
        game, following = self.weighted_game(), self.game()
        failed = self.finish_with(game, 'a')
        self.assertEqual(failed['result']['grade'], 6.9)
        self.assertEqual((failed['result']['min_grade'], failed['result']['step_completed']), (7, False))
        self.assertFalse(self.unlocked(following))
        self.assertEqual(self.request('GET', f"/api/nodes/{following['id']}/content", role='trainee')[0], 403)
        # The best grade still counts in the average while the step stays open.
        self.assertEqual(self.average(), 6.9)
        passed = self.finish_with(game, 'ab')
        self.assertEqual((passed['result']['grade'], passed['result']['step_completed']), (7, True))
        self.assertTrue(self.unlocked(following))
        # A later lower attempt never reopens the step; the old result shows the current state.
        worse = self.finish_with(game, '')
        self.assertEqual((worse['result']['grade'], worse['result']['best_grade'], worse['result']['step_completed']), (0, 7, True))
        status, old = self.request('GET', f"/api/game-attempts/{failed['id']}", role='trainee')
        self.assertEqual(status, 200, old)
        self.assertTrue(old['result']['step_completed'])
        self.assertEqual(self.average(), 7)

    def test_single_attempt_game_concludes_with_any_grade(self):
        game, following = self.weighted_game(allow_retry=False), self.game()
        result = self.finish_with(game, '')
        self.assertEqual(result['result']['grade'], 0)
        self.assertEqual((result['result']['min_grade'], result['result']['step_completed']), (None, True))
        self.assertTrue(self.unlocked(following))

    def test_repeatable_legacy_quiz_needs_minimum_grade(self):
        node = self.create('nodes', {'type': 'game', 'eixo': 'trainee', 'is_released': True,
            'questions': [{'text': 'Pergunta', 'options': [{'text': 'Sim', 'is_correct': True, 'score': 10}, {'text': 'Não'}]}]})
        following = self.game()
        question = node['questions'][0]
        path = f"/api/nodes/{node['id']}/submit-game"
        for option, grade, completed in [(1, 0, False), (0, 10, True)]:
            status, result = self.request('POST', path, {'answers': [
                {'question_id': question['id'], 'option_id': question['options'][option]['id']}]}, role='trainee')
            self.assertEqual(status, 200, result)
            self.assertEqual((result['grade'], result['min_grade'], result['step_completed']), (grade, 7, completed))
            self.assertEqual(self.unlocked(following), completed)

    def test_legacy_quiz_without_point_weights_gets_grade_and_cannot_repeat(self):
        node = self.create('nodes', {'type': 'game', 'eixo': 'trainee', 'is_released': True, 'allow_retry': False,
            'questions': [{'text': 'Pergunta', 'options': [{'text': 'Sim', 'is_correct': True}, {'text': 'Não'}]}]})
        question = node['questions'][0]
        payload = {'answers': [{'question_id': question['id'], 'option_id': question['options'][0]['id']}]}
        status, result = self.request('POST', f"/api/nodes/{node['id']}/submit-game", payload, role='trainee')
        self.assertEqual(status, 200, result)
        self.assertEqual(result['grade'], 10)
        self.assertEqual(self.average(), 10)
        self.assertEqual(self.request('POST', f"/api/nodes/{node['id']}/submit-game", payload, role='trainee')[0], 409)

    def test_manager_average_includes_only_games_in_their_axis(self):
        sales, connections = self.game(eixo='vendas'), self.game(eixo='conexoes')
        self.finish(self.begin(sales, role='membro'), role='membro')
        self.finish(self.begin(connections, role='membro'), correct=False, role='membro')
        with self.api.sessions() as db:
            self.assertEqual(axis_metrics(db, 'membro', {'vendas'})['nota_rotacao'], 10)
            self.assertEqual(axis_metrics(db, 'membro', {'conexoes'})['nota_rotacao'], 0)
            self.assertEqual(db.get(models.User, 'membro').nota_rotacao, 5)

    def test_migration_backfills_game_grades_and_preserves_repeat_behavior(self):
        activity = self.activity(weight=2)
        self.grade(activity, self.deliver(activity), 4)
        node = self.game()
        self.finish(self.begin(node))
        migrate(self.api.engine)
        with self.api.engine.begin() as connection:
            connection.execute(text('DELETE FROM schema_migrations WHERE version = 6'))
            for table, fields in {'activities': ['allow_retry', 'is_required'], 'training_nodes': ['allow_retry', 'is_required', 'weight'],
                                  'user_node_progress': ['grade'], 'activity_submissions': ['previous_grade']}.items():
                for field in fields:
                    connection.execute(text(f'ALTER TABLE {table} DROP COLUMN {field}'))
        migrate(self.api.engine)
        migrate(self.api.engine)
        self.assertEqual(self.average(), 6)
        with self.api.sessions() as db:
            self.assertTrue(db.get(models.Activity, activity['id']).allow_retry)
            self.assertTrue(db.get(models.TrainingNode, node['id']).is_required)
            self.assertEqual(db.query(models.UserNodeProgress).filter_by(node_id=node['id']).one().grade, 10)
