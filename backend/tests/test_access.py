"""Regression tests for sessions, content permissions and activity delivery."""
import unittest
from unittest.mock import patch

import test_creation
from app import models
from app.api import auth, users
from app.auth import create_access_token


class AccessTests(unittest.TestCase):
    def setUp(self):
        self.api = test_creation.CreationTests()
        self.api.setUp()
        self.api.app.include_router(auth.router, prefix='/api/auth')
        self.api.app.include_router(users.router, prefix='/api/users')
        with self.api.sessions() as db:
            db.add(models.User(id='trainee', name='Trainee', email='trainee@example.com', password_hash='unused', cargo='Trainee', type='trainee'))
            db.commit()
        self.request = self.api.request
        self.create = self.api.create

    def tearDown(self):
        self.api.tearDown()

    def test_public_registration_never_grants_privileged_role(self):
        for email in ['admin@infoej.com.br', 'organizador@infoej.com.br', 'membro@infoej.com.br']:
            with self.subTest(email=email), patch.object(auth, 'get_password_hash', return_value='test-only'):
                status, result = self.request('POST', '/api/auth/register', {
                    'name': 'Cadastro público', 'email': email, 'cargo': 'Administrador', 'password': 'test-only',
                }, role=None)
            self.assertEqual(status, 200)
            self.assertEqual(result['type'], 'trainee')

    def test_login_token_survives_email_change_and_legacy_token_works(self):
        with patch.object(auth, 'verify_password', return_value=True):
            status, result = self.request('POST', '/api/auth/login', {'email': 'admin@example.com', 'password': 'test-only'}, role=None)
        self.assertEqual(status, 200)
        token = result['access_token']
        status, result = self.request('PUT', '/api/users/admin', {'email': 'changed@example.com'}, role=None, token=token)
        self.assertEqual(status, 200)
        status, result = self.request('GET', '/api/auth/me', role=None, token=token)
        self.assertEqual(status, 200)
        self.assertEqual(result['email'], 'changed@example.com')
        legacy = create_access_token({'sub': 'membro@example.com'})
        status, result = self.request('GET', '/api/auth/me', role=None, token=legacy)
        self.assertEqual(status, 200)
        self.assertEqual(result['id'], 'membro')

    def test_organizer_and_trainee_cannot_act_outside_their_content(self):
        activity = self.create('activities', {'title': 'Restrita', 'eixo': 'vendas'})
        for method, path, body, role in [
            ('POST', '/api/activities', {'title': 'Restrita', 'eixo': 'vendas'}, 'organizador'),
            ('PATCH', f"/api/activities/{activity['id']}", {'title': 'Alterada'}, 'organizador'),
            ('GET', f"/api/activities/{activity['id']}/submissions", None, 'organizador'),
            ('DELETE', f"/api/activities/{activity['id']}", None, 'organizador'),
            ('POST', f"/api/activities/{activity['id']}/submit", {'file_url': 'https://example.com/file'}, 'trainee'),
            ('GET', '/api/users/admin/profile', None, 'organizador'),
        ]:
            with self.subTest(method=method, path=path):
                status, result = self.request(method, path, body, role)
                self.assertEqual(status, 403, result)

    def test_patch_can_remove_deadline_and_material_without_clearing_omitted_fields(self):
        material = self.create('materials', {'name': 'Material', 'type': 'trainee', 'eixo': 'trainee'})
        activity = self.create('activities', {
            'title': 'Atividade', 'eixo': 'trainee', 'deadline': '2030-01-01T00:00:00Z', 'material_id': material['id'],
        })
        path = f"/api/activities/{activity['id']}"
        _, updated = self.request('PATCH', path, {'title': 'Alterada'})
        self.assertEqual(updated['deadline'], activity['deadline'])
        self.assertEqual(updated['material_id'], material['id'])
        status, updated = self.request('PATCH', path, {'deadline': None, 'material_id': None})
        self.assertEqual(status, 200)
        self.assertIsNone(updated['deadline'])
        self.assertIsNone(updated['material_id'])

    def test_delivery_completes_only_the_selected_available_node(self):
        activity = self.create('activities', {'title': 'Atividade', 'eixo': 'trainee', 'accepts_file': False})
        node = self.create('nodes', {'type': 'activity', 'eixo': 'trainee', 'activity_id': activity['id'], 'is_released': True})
        blocked = self.create('nodes', {'type': 'activity', 'eixo': 'trainee', 'activity_id': activity['id'], 'is_released': False})
        path = f"/api/activities/{activity['id']}/submit"
        status, _ = self.request('POST', path, {'node_id': blocked['id'], 'comment': 'Entrega'}, role='trainee')
        self.assertEqual(status, 403)
        status, _ = self.request('POST', path, {'node_id': node['id'], 'comment': ''}, role='trainee')
        self.assertEqual(status, 400)
        for _ in range(2):
            status, body = self.request('POST', path, {'node_id': node['id'], 'comment': 'Entrega'}, role='trainee')
            self.assertEqual(status, 200, body)
        with self.api.sessions() as db:
            progress = db.query(models.UserNodeProgress).all()
            self.assertEqual(len(progress), 1)
            self.assertEqual(progress[0].node_id, node['id'])
            self.assertTrue(progress[0].completed)
            self.assertEqual(db.query(models.ActivitySubmission).count(), 1)

    def test_activity_without_node_id_cannot_bypass_trail_gates(self):
        activity = self.create('activities', {'title': 'Atividade', 'eixo': 'trainee', 'accepts_file': False})
        self.create('nodes', {'type': 'activity', 'eixo': 'trainee', 'activity_id': activity['id']})
        status, _ = self.request('POST', f"/api/activities/{activity['id']}/submit", {'comment': 'Entrega'}, role='trainee')
        self.assertEqual(status, 403)

    def test_retired_pluginfo_axis_is_rejected_and_organizer_is_limited_to_trainees(self):
        """PlugInfo é papel, não eixo: o valor não existe mais para nenhum perfil."""
        payloads = {
            'nodes': lambda eixo: {'type': 'game', 'eixo': eixo,
                                   'questions': [{'text': 'Pergunta', 'options': [
                                       {'text': 'A', 'score': 10, 'is_correct': True}, {'text': 'B', 'score': 0}]}]},
            'activities': lambda eixo: {'title': 'Atividade', 'eixo': eixo},
        }
        for resource, build in payloads.items():
            for role in ['admin', 'organizador']:
                with self.subTest(resource=resource, role=role):
                    status, _ = self.request('POST', f'/api/{resource}', build('pluginfo'), role=role)
                    self.assertEqual(status, 422)
            status, body = self.request('POST', f'/api/{resource}', build('vendas'), role='organizador')
            self.assertEqual(status, 403, body)
            status, body = self.request('POST', f'/api/{resource}', build('trainee'), role='organizador')
            self.assertEqual(status, 200, body)
        status, _ = self.request('POST', '/api/materials', {'name': 'Material', 'type': 'pluginfo', 'eixo': 'trainee'})
        self.assertEqual(status, 422)
        status, body = self.request('POST', '/api/materials', {'name': 'Material', 'type': 'trainee', 'eixo': 'trainee'}, role='organizador')
        self.assertEqual(status, 200, body)

    def test_material_cannot_use_retired_axis_with_valid_type(self):
        status, _ = self.request('POST', '/api/materials', {'name': 'Material', 'type': 'trainee', 'eixo': 'pluginfo'})
        self.assertEqual(status, 422)
