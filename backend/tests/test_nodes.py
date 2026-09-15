"""Integration coverage for node contracts and server-side quiz evaluation."""
import unittest

import test_creation
from test_creation import models


class NodeTests(unittest.TestCase):
    def setUp(self):
        self.api = test_creation.CreationTests()
        self.api.setUp()
        self.request = self.api.request
        self.create = self.api.create

    def tearDown(self):
        self.api.tearDown()

    def game(self, **changes):
        payload = {
            'name': 'Questionário', 'type': 'game', 'eixo': 'vendas', 'is_released': True,
            'questions': [
                {'text': 'Pergunta um', 'explanation': 'Explicação', 'options': [
                    {'text': 'A', 'score': 10, 'is_correct': True, 'feedback': 'Feedback'},
                    {'text': 'B', 'score': 0},
                ]},
                {'text': 'Pergunta dois', 'options': [
                    {'text': 'C', 'score': 25, 'is_correct': True}, {'text': 'D', 'score': 5},
                ]},
            ],
        }
        payload.update(changes)
        return self.create('nodes', payload)

    def choices(self, node, index=0):
        return {'answers': [
            {'question_id': q['id'], 'option_id': q['options'][index]['id']}
            for q in node['questions']
        ]}

    def test_server_evaluates_answers_and_awards_only_improvement(self):
        node = self.game()
        path = f"/api/nodes/{node['id']}/submit-game"
        for choices, score, delta in [(1, 5, 5), (0, 35, 30), (0, 35, 0), (1, 5, 0)]:
            status, result = self.request('POST', path, self.choices(node, choices), role='membro')
            self.assertEqual(status, 200, result)
            self.assertEqual(result['attempt_score'], score)
            self.assertEqual(result['max_score'], 35)
            self.assertEqual(result['score_added'], delta)
            self.assertEqual(len(result['feedback']), 2)
        self.assertEqual(result['total_score'], 35)
        self.assertEqual(result['user_total_points'], 35)
        with self.api.sessions() as db:
            self.assertEqual(db.query(models.UserNodeProgress).count(), 1)

    def test_answer_keys_are_hidden_until_submission(self):
        node = self.game()
        status, listing = self.request('GET', '/api/nodes', role='membro')
        self.assertEqual(status, 200)
        public = next(item for item in listing if item['id'] == node['id'])
        for question in public['questions']:
            self.assertIsNone(question.get('explanation'))
            for option in question['options']:
                for key in ['is_correct', 'score', 'feedback']:
                    self.assertIsNone(option.get(key))
        _, result = self.request('POST', f"/api/nodes/{node['id']}/submit-game", self.choices(node), role='membro')
        self.assertTrue(result['feedback'][0]['is_correct'])
        self.assertEqual(result['feedback'][0]['explanation'], 'Explicação')

    def test_invalid_submissions_do_not_create_progress(self):
        node = self.game()
        valid = self.choices(node)
        path = f"/api/nodes/{node['id']}/submit-game"
        wrong_option = self.choices(node)
        wrong_option['answers'][0]['option_id'] = node['questions'][1]['options'][0]['id']
        cases = [
            ({'score': 999999}, 422), ({**valid, 'score': 999999}, 422),
            ({'answers': []}, 422), (wrong_option, 400),
            ({'answers': valid['answers'][:1]}, 400),
            ({'answers': [valid['answers'][0], valid['answers'][0]]}, 400),
        ]
        for payload, expected in cases:
            with self.subTest(payload=payload):
                status, result = self.request('POST', path, payload, role='membro')
                self.assertEqual(status, expected, result)
        with self.api.sessions() as db:
            self.assertEqual(db.query(models.UserNodeProgress).count(), 0)

    def test_access_release_and_prerequisite_apply_to_game_submission(self):
        blocked = self.game(is_released=False)
        status, _ = self.request('POST', f"/api/nodes/{blocked['id']}/submit-game", self.choices(blocked), role='membro')
        self.assertEqual(status, 403)
        _, listing = self.request('GET', '/api/nodes', role='membro')
        self.assertEqual(listing[0]['questions'], [])
        next_node = self.game(prerequisite_node_id=blocked['id'])
        status, _ = self.request('POST', f"/api/nodes/{next_node['id']}/submit-game", self.choices(next_node), role='membro')
        self.assertEqual(status, 403)
        outside = self.game(eixo='trainee')
        status, _ = self.request('POST', f"/api/nodes/{outside['id']}/submit-game", self.choices(outside), role='membro')
        self.assertEqual(status, 403)
        for operation, method, payload in [('release', 'PATCH', {'is_released': True}), ('order', 'PATCH', {'order_index': 3}), ('', 'DELETE', None)]:
            path = f"/api/nodes/{blocked['id']}" + (f'/{operation}' if operation else '')
            status, _ = self.request(method, path, payload, role='organizador')
            self.assertEqual(status, 403)

    def test_release_and_order_preserve_activity_metadata(self):
        activity = self.create('activities', {'title': 'Atividade', 'eixo': 'trainee'})
        node = self.create('nodes', {'type': 'activity', 'eixo': 'trainee', 'activity_id': activity['id'], 'deadline': '2030-01-01T00:00:00Z'})
        for operation, payload in [('release', {'is_released': True}), ('order', {'order_index': 3})]:
            status, result = self.request('PATCH', f"/api/nodes/{node['id']}/{operation}", payload)
            self.assertEqual(status, 200)
            self.assertEqual(result['activity_id'], activity['id'])
            self.assertEqual(result['deadline'], node['deadline'])

    def test_invalid_quiz_creation_is_rejected(self):
        variants = [[], [{'text': '', 'options': []}], [{'text': 'Q', 'options': [{'text': 'A', 'is_correct': True}]}], [{'text': 'Q', 'options': [{'text': 'A'}, {'text': 'B'}]}]]
        for questions in variants:
            status, _ = self.request('POST', '/api/nodes', {'type': 'game', 'eixo': 'vendas', 'questions': questions})
            self.assertEqual(status, 422)
        with self.api.sessions() as db:
            self.assertEqual(db.query(models.TrainingNode).count(), 0)

    def test_trail_is_sequential_by_order_and_explicit_prerequisite_wins(self):
        """A etapa anterior do mesmo eixo tranca a seguinte, sem ninguém configurar."""
        first, second = self.game(name='Primeira'), self.game(name='Segunda')
        status, listing = self.request('GET', '/api/nodes', role='membro')
        self.assertEqual(status, 200)
        by_id = {item['id']: item for item in listing}
        self.assertIsNone(by_id[first['id']]['effective_prerequisite_id'])
        self.assertEqual(by_id[second['id']]['effective_prerequisite_id'], first['id'])
        self.assertTrue(by_id[first['id']]['unlocked'])
        self.assertFalse(by_id[second['id']]['unlocked'])

        status, _ = self.request('POST', f"/api/nodes/{second['id']}/submit-game", self.choices(second), role='membro')
        self.assertEqual(status, 403)
        status, result = self.request('POST', f"/api/nodes/{first['id']}/submit-game", self.choices(first), role='membro')
        self.assertEqual(status, 200, result)
        status, _ = self.request('POST', f"/api/nodes/{second['id']}/submit-game", self.choices(second), role='membro')
        self.assertEqual(status, 200)

        # Um pré-requisito escolhido à mão se sobrepõe à ordem.
        third = self.game(name='Terceira', prerequisite_node_id=first['id'])
        _, listing = self.request('GET', '/api/nodes', role='membro')
        chained = next(item for item in listing if item['id'] == third['id'])
        self.assertEqual(chained['effective_prerequisite_id'], first['id'])
        self.assertTrue(chained['unlocked'])

    def test_reordering_rebuilds_the_chain(self):
        first, second = self.game(name='Primeira'), self.game(name='Segunda')
        for node, order in [(first, 1), (second, 0)]:
            status, _ = self.request('PATCH', f"/api/nodes/{node['id']}/order", {'order_index': order})
            self.assertEqual(status, 200)
        _, listing = self.request('GET', '/api/nodes', role='membro')
        by_id = {item['id']: item for item in listing}
        self.assertIsNone(by_id[second['id']]['effective_prerequisite_id'])
        self.assertEqual(by_id[first['id']]['effective_prerequisite_id'], second['id'])
        self.assertTrue(by_id[second['id']]['unlocked'])
        self.assertFalse(by_id[first['id']]['unlocked'])
