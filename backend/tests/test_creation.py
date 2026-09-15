"""Run: backend/.venv/bin/python -m unittest discover -s backend/tests -v."""
import asyncio
import json
import os
from pathlib import Path
import sys
import unittest
from datetime import timedelta

os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['JWT_SECRET_KEY'] = 'creation-tests-only'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app import models
from app.api import activities, materials, nodes
from app.auth import create_access_token
from app.database import Base, get_db


class CreationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        # Mesma configuração de app/database.py: sem autoflush, para o teste
        # exercitar a ordem real de descarga das alterações.
        self.sessions = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        with self.sessions() as db:
            for role in ['admin', 'organizador', 'membro']:
                db.add(models.User(id=role, name=role, email=f'{role}@example.com', password_hash='unused', cargo=role, type=role))
            db.commit()
        self.app = FastAPI()
        for name, module in [('materials', materials), ('activities', activities), ('nodes', nodes)]:
            self.app.include_router(module.router, prefix=f'/api/{name}')
        def test_db():
            with self.sessions() as db:
                yield db
        self.app.dependency_overrides[get_db] = test_db

    def tearDown(self):
        self.engine.dispose()

    def request(self, method, path, payload=None, role='admin', token=None):
        route, _, query = path.partition('?')
        if token is None and role:
            token = create_access_token({'sub': f'{role}@example.com'})
        async def run():
            messages = []
            received = False
            async def receive():
                nonlocal received
                if not received:
                    received = True
                    return {'type': 'http.request', 'body': json.dumps(payload).encode(), 'more_body': False}
                await asyncio.Event().wait()
            async def send(message):
                messages.append(message)
            headers = [(b'content-type', b'application/json')]
            if token:
                headers.append((b'authorization', f'Bearer {token}'.encode()))
            await asyncio.wait_for(self.app({
                'type': 'http', 'asgi': {'version': '3.0', 'spec_version': '2.4'},
                'http_version': '1.1', 'method': method, 'scheme': 'http',
                'path': route, 'raw_path': route.encode(), 'query_string': query.encode(),
                'root_path': '', 'headers': headers, 'server': ('test', 80), 'client': ('test', 1),
            }, receive, send), timeout=5)
            start = next(m for m in messages if m['type'] == 'http.response.start')
            self.assertFalse(any(k.lower() == b'location' for k, v in start['headers']))
            body = b''.join(m.get('body', b'') for m in messages if m['type'] == 'http.response.body')
            return start['status'], json.loads(body)
        return asyncio.run(run())

    def create(self, resource, payload, suffix='', role='admin'):
        status, body = self.request('POST', f'/api/{resource}{suffix}', payload, role)
        self.assertEqual(status, 200, body)
        return body

    def test_creation_and_listing_with_linked_material_activity_and_trail(self):
        for role in ['admin', 'organizador']:
            for suffix in ['', '/']:
                with self.subTest(role=role, suffix=suffix):
                    material = self.create('materials', {
                        'name': 'Material de teste', 'type': 'trainee', 'eixo': 'trainee',
                        'text': 'Conteúdo', 'documents': [{'name': 'Documento', 'url': 'https://example.com/doc'}],
                        'videos': ['https://example.com/video'],
                    }, suffix, role)
                    self.assertEqual(len(material['documents']), 1)
                    self.assertEqual(len(material['videos']), 1)
                    activity = self.create('activities', {
                        'title': 'Atividade de teste', 'eixo': 'trainee', 'material_id': material['id'],
                        'accepts_file': True, 'weight': 2,
                    }, suffix, role)
                    self.assertEqual(activity['material_id'], material['id'])
                    for kind in ['material', 'activity', 'game']:
                        payload = {'type': kind, 'eixo': 'trainee', 'is_released': True}
                        if kind == 'material':
                            payload['reference_id'] = material['id']
                        elif kind == 'activity':
                            payload['activity_id'] = activity['id']
                        else:
                            payload['questions'] = [{'text': 'Pergunta', 'options': [{'text': 'Resposta', 'is_correct': True, 'score': 10}, {'text': 'Outra resposta', 'score': 0}]}]
                        node = self.create('nodes', payload, suffix, role)
                        self.assertEqual(node['type'], kind)
                        if kind == 'game':
                            self.assertEqual(node['questions'][0]['options'][0]['score'], 10)
                        else:
                            key = 'reference_id' if kind == 'material' else 'activity_id'
                            self.assertEqual(node[key], payload[key])
                    for resource, created in [('materials', material), ('activities', activity), ('nodes', node)]:
                        status, listing = self.request('GET', f'/api/{resource}{suffix}', role=role)
                        self.assertEqual(status, 200, listing)
                        self.assertIn(created['id'], [item['id'] for item in listing])

    def test_authentication_and_permissions(self):
        payloads = {
            'materials': {'name': 'Teste', 'type': 'trainee', 'eixo': 'trainee'},
            'activities': {'title': 'Teste', 'eixo': 'trainee'},
            'nodes': {'type': 'game', 'eixo': 'trainee'},
        }
        expired = create_access_token({'sub': 'admin@example.com'}, timedelta(seconds=-10))
        for resource, payload in payloads.items():
            for suffix in ['', '/']:
                for token in [None, 'invalid-token', expired]:
                    with self.subTest(resource=resource, suffix=suffix, token=token):
                        status, _ = self.request('POST', f'/api/{resource}{suffix}', payload, role=None, token=token)
                        self.assertEqual(status, 401)
                status, _ = self.request('POST', f'/api/{resource}{suffix}', payload, role='membro')
                self.assertEqual(status, 403)
        with self.sessions() as db:
            for model in [models.Material, models.Activity, models.TrainingNode]:
                self.assertEqual(db.query(model).count(), 0)
