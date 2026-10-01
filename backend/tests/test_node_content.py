"""The trail resolves node -> activity -> material, independently of library lists."""
import unittest

import test_creation
from test_creation import models


class NodeContentTests(unittest.TestCase):
    def setUp(self):
        self.api = test_creation.CreationTests()
        self.api.setUp()
        self.request = self.api.request
        self.create = self.api.create
        with self.api.sessions() as db:
            db.add(models.User(id='trainee', name='Trainee', email='trainee@example.com',
                               password_hash='unused', cargo='trainee', type='trainee'))
            db.commit()

    def tearDown(self):
        self.api.tearDown()

    def material(self, name='Material da atividade'):
        return self.create('materials', {'name': name, 'type': 'trainee', 'eixo': 'trainee',
                                        'text': 'Texto completo', 'videos': ['https://example.com/video'],
                                        'documents': [{'name': 'Documento', 'url': 'https://example.com/doc'}]})

    def test_activity_material_and_submission_are_loaded_from_node(self):
        material = self.material()
        library_only = self.material('Só na biblioteca')
        activity = self.create('activities', {'title': 'Atividade', 'eixo': 'trainee',
                                            'material_id': material['id'], 'accepts_file': False})
        node = self.create('nodes', {'type': 'activity', 'eixo': 'trainee',
                                    'activity_id': activity['id'], 'is_released': True})
        # A stale direct reference must never override the activity's own material.
        with self.api.sessions() as db:
            db.get(models.TrainingNode, node['id']).reference_id = library_only['id']
            db.commit()
        path = f"/api/nodes/{node['id']}/content"
        status, content = self.request('GET', path, role='trainee')
        self.assertEqual(status, 200, content)
        self.assertEqual(content['activity']['id'], activity['id'])
        self.assertEqual(content['material']['id'], material['id'])
        self.assertEqual(content['material']['text'], 'Texto completo')
        self.assertEqual(len(content['material']['videos']), 1)
        self.assertEqual(len(content['material']['documents']), 1)
        self.assertFalse(content['node']['completed'])
        # A biblioteca usa o mesmo vínculo da etapa: a referência antiga não libera nada.
        _, listing = self.request('GET', '/api/materials', role='trainee')
        self.assertEqual([item['id'] for item in listing], [material['id']])
        status, _ = self.request('POST', f"/api/activities/{activity['id']}/submit",
                                 {'node_id': node['id'], 'comment': 'Minha resposta'}, role='trainee')
        self.assertEqual(status, 200)
        _, content = self.request('GET', path, role='trainee')
        self.assertTrue(content['node']['completed'])
        self.assertEqual(content['activity']['my_submission']['comment'], 'Minha resposta')

    def test_content_endpoint_enforces_release_prerequisites_and_audience(self):
        material = self.material()
        activity = self.create('activities', {'title': 'Atividade', 'eixo': 'trainee', 'material_id': material['id']})
        first = self.create('nodes', {'type': 'activity', 'eixo': 'trainee', 'activity_id': activity['id']})
        second = self.create('nodes', {'type': 'activity', 'eixo': 'trainee', 'activity_id': activity['id'], 'is_released': True})
        for node in (first, second):
            status, _ = self.request('GET', f"/api/nodes/{node['id']}/content", role='trainee')
            self.assertEqual(status, 403)
        member_material = self.create('materials', {'name': 'Membro', 'type': 'membro', 'eixo': 'vendas'})
        member_node = self.create('nodes', {'type': 'material', 'eixo': 'vendas', 'reference_id': member_material['id'], 'is_released': True})
        status, _ = self.request('GET', f"/api/nodes/{member_node['id']}/content", role='trainee')
        self.assertEqual(status, 403)

    def test_legacy_node_can_be_linked_to_activity_and_material_changes_follow_it(self):
        material = self.material()
        activity = self.create('activities', {'title': 'Atividade', 'eixo': 'trainee', 'material_id': material['id']})
        with self.api.sessions() as db:
            db.add(models.TrainingNode(id='legacy', name='Etapa antiga', type='material', eixo='trainee', is_released=True))
            db.commit()
        path = '/api/nodes/legacy/content'
        self.assertEqual(self.request('GET', path, role='trainee')[0], 404)
        self.assertEqual(self.request('PATCH', '/api/nodes/legacy/activity', {'activity_id': activity['id']}, role='trainee')[0], 403)
        status, node = self.request('PATCH', '/api/nodes/legacy/activity', {'activity_id': activity['id']}, role='organizador')
        self.assertEqual(status, 200, node)
        self.assertEqual(node['type'], 'activity')
        self.assertIsNone(node['reference_id'])
        status, content = self.request('GET', path, role='trainee')
        self.assertEqual(status, 200, content)
        self.assertEqual(content['material']['id'], material['id'])
        replacement = self.material('Novo material')
        self.request('PATCH', f"/api/activities/{activity['id']}", {'material_id': replacement['id']})
        _, content = self.request('GET', path, role='trainee')
        self.assertEqual(content['material']['id'], replacement['id'])
        self.request('PATCH', f"/api/activities/{activity['id']}", {'material_id': None})
        _, content = self.request('GET', path, role='trainee')
        self.assertIsNone(content['material'])
        self.assertEqual(content['activity']['id'], activity['id'])

    def test_link_rejects_wrong_axis_and_missing_activity(self):
        material = self.material()
        node = self.create('nodes', {'type': 'material', 'eixo': 'trainee', 'reference_id': material['id']})
        activity = self.create('activities', {'title': 'Outro eixo', 'eixo': 'vendas'})
        path = f"/api/nodes/{node['id']}/activity"
        self.assertEqual(self.request('PATCH', path, {'activity_id': activity['id']})[0], 400)
        self.assertEqual(self.request('PATCH', path, {'activity_id': 'missing'})[0], 404)

    def game(self, **changes):
        return self.create('nodes', {'name': 'Jogo', 'type': 'game', 'eixo': 'trainee',
            'questions': [{'text': 'Pergunta', 'options': [
                {'text': 'Sim', 'is_correct': True}, {'text': 'Não'}]}], **changes})

    def test_game_support_material_follows_release_and_can_be_replaced_or_removed(self):
        material = self.material()
        node = self.game(reference_id=material['id'])
        path = f"/api/nodes/{node['id']}"
        self.assertEqual(self.request('GET', path + '/content', role='trainee')[0], 403)
        self.assertEqual(self.request('GET', '/api/materials', role='trainee')[1], [])
        self.request('PATCH', path + '/release', {'is_released': True})
        status, content = self.request('GET', path + '/content', role='trainee')
        self.assertEqual(status, 200, content)
        self.assertEqual(content['material']['id'], material['id'])
        self.assertIsNone(content['activity'])
        self.assertIsNone(content['node']['questions'][0]['options'][0]['is_correct'])
        self.assertEqual(self.request('GET', '/api/materials', role='trainee')[1][0]['id'], material['id'])
        self.assertEqual(self.request('POST', path + '/complete', role='trainee')[0], 400)
        replacement = self.material('Outro material')
        self.assertEqual(self.request('PATCH', path, {'reference_id': replacement['id']})[0], 200)
        self.assertEqual(self.request('GET', path + '/content', role='trainee')[1]['material']['id'], replacement['id'])
        self.assertEqual(self.request('PATCH', path, {'reference_id': None})[0], 200)
        self.assertIsNone(self.request('GET', path + '/content', role='trainee')[1]['material'])
        self.assertEqual(self.request('GET', '/api/materials', role='trainee')[1], [])

    def test_node_edit_preserves_progress_and_questions_and_clears_deadline(self):
        node = self.game(is_released=True, deadline='2028-05-01T12:00:00Z')
        with self.api.sessions() as db:
            db.add(models.UserNodeProgress(id='completed', user_id='trainee', node_id=node['id'], completed=True, score=7))
            db.commit()
        status, updated = self.request('PATCH', f"/api/nodes/{node['id']}", {'name': 'Novo nome', 'deadline': None}, role='organizador')
        self.assertEqual(status, 200, updated)
        self.assertEqual(updated['name'], 'Novo nome')
        self.assertIsNone(updated['deadline'])
        self.assertEqual(updated['questions'], node['questions'])
        self.assertEqual(updated['order_index'], node['order_index'])
        with self.api.sessions() as db:
            self.assertTrue(db.get(models.UserNodeProgress, 'completed').completed)
            self.assertEqual(db.get(models.UserNodeProgress, 'completed').score, 7)

    def test_edit_rejects_cycles_including_implicit_previous_node(self):
        first = self.game()
        second = self.game()
        path = f"/api/nodes/{first['id']}"
        for prerequisite in [first['id'], second['id']]:
            self.assertEqual(self.request('PATCH', path, {'prerequisite_node_id': prerequisite})[0], 400)
        self.assertEqual(self.request('PATCH', f"/api/nodes/{second['id']}", {'prerequisite_node_id': first['id']})[0], 200)
        self.assertEqual(self.request('PATCH', path, {'prerequisite_node_id': 'missing'})[0], 404)

    def test_edit_enforces_permissions_axis_and_node_type(self):
        node = self.game()
        path = f"/api/nodes/{node['id']}"
        foreign_material = self.create('materials', {'name': 'Outro eixo', 'type': 'membro', 'eixo': 'vendas'})
        self.assertEqual(self.request('PATCH', path, {'name': 'Negado'}, role='trainee')[0], 403)
        self.assertEqual(self.request('PATCH', path, {'name': 'Negado'}, role='membro')[0], 403)
        self.assertEqual(self.request('PATCH', path, {'reference_id': foreign_material['id']})[0], 400)
        self.assertEqual(self.request('PATCH', path, {'reference_id': 'missing'})[0], 404)
        self.assertEqual(self.request('PATCH', path, {'activity_id': 'missing'})[0], 400)
        self.assertEqual(self.request('PATCH', path, {'name': ''})[0], 422)
        self.assertEqual(self.request('PATCH', path, {'eixo': 'vendas'})[0], 422)
        self.assertEqual(self.request('PATCH', '/api/nodes/missing', {'name': 'Nada'})[0], 404)
        foreign_node = self.create('nodes', {'type': 'material', 'eixo': 'vendas', 'reference_id': foreign_material['id']})
        self.assertEqual(self.request('PATCH', f"/api/nodes/{foreign_node['id']}", {'name': 'Negado'}, role='organizador')[0], 403)
        with self.api.sessions() as db:
            db.add(models.User(id='gerente', name='Gerente', email='gerente@example.com',
                               password_hash='unused', cargo='gerente', type='gerente', eixo='conexoes'))
            db.commit()
        self.assertEqual(self.request('PATCH', f"/api/nodes/{foreign_node['id']}", {'name': 'Negado'}, role='gerente')[0], 403)
        self.assertEqual(self.request('PATCH', path, {'name': 'PlugInfo editado'}, role='gerente')[0], 200)

    def test_edit_activity_link_resolves_its_material(self):
        material = self.material()
        activity = self.create('activities', {'title': 'Primeira', 'eixo': 'trainee'})
        replacement = self.create('activities', {'title': 'Segunda', 'eixo': 'trainee', 'material_id': material['id']})
        node = self.create('nodes', {'type': 'activity', 'eixo': 'trainee', 'activity_id': activity['id'], 'is_released': True})
        path = f"/api/nodes/{node['id']}"
        self.assertEqual(self.request('PATCH', path, {'activity_id': replacement['id']})[0], 200)
        status, content = self.request('GET', path + '/content', role='trainee')
        self.assertEqual(status, 200, content)
        self.assertEqual(content['activity']['id'], replacement['id'])
        self.assertEqual(content['material']['id'], material['id'])
