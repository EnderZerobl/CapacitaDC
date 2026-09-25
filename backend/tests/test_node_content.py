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
