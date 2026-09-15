"""Attachment permissions, limits, persistence and correction metadata."""
import asyncio
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi import HTTPException, UploadFile
from sqlalchemy import text
import test_creation
from app import models
from app.api import activities
from app.migrations import migrate


class SubmissionAttachmentTests(unittest.TestCase):
    def setUp(self):
        self.api = test_creation.CreationTests()
        self.api.setUp()
        self.request, self.create = self.api.request, self.api.create
        self.directory = TemporaryDirectory()
        self.storage = patch.object(activities, 'SUBMISSION_UPLOAD_DIR', Path(self.directory.name))
        self.storage.start()
        with self.api.sessions() as db:
            for role in ['trainee', 'other']:
                db.add(models.User(id=role, name=role, email=f'{role}@example.com', password_hash='unused', cargo='trainee', type='trainee'))
            db.commit()
        self.activity = self.create('activities', {'title': 'Entrega com anexos', 'eixo': 'trainee', 'accepts_file': True})
        self.node = self.create('nodes', {'type': 'activity', 'eixo': 'trainee', 'activity_id': self.activity['id'], 'is_released': True})

    def tearDown(self):
        self.storage.stop()
        self.directory.cleanup()
        self.api.tearDown()

    def upload(self, filename='resposta.pdf', data=b'%PDF-1.4\ntest', role='trainee'):
        with self.api.sessions() as db:
            result = asyncio.run(activities.upload_submission_attachment(
                self.activity['id'], UploadFile(filename=filename, file=BytesIO(data)), self.node['id'], db, db.get(models.User, role)))
            return result.id

    def submit(self, **payload):
        return self.request('POST', f"/api/activities/{self.activity['id']}/submit",
                            {'node_id': self.node['id'], **payload}, role='trainee')

    def test_attachment_links_comments_and_download_permissions(self):
        attachment = self.upload()
        payload = {'attachment_ids': [attachment], 'links': ['https://example.com/trabalho'], 'comment': 'Explicação'}
        status, result = self.submit(**payload)
        self.assertEqual(status, 200, result)
        self.assertEqual(result['attachments'][0]['name'], 'resposta.pdf')
        self.assertEqual(result['links'], payload['links'])
        self.assertEqual(result['comment'], payload['comment'])
        url = result['attachments'][0]['url']
        _, listing = self.request('GET', '/api/activities', role='trainee')
        self.assertEqual(listing[0]['my_submission']['attachments'][0]['id'], attachment)
        _, corrected = self.request('GET', f"/api/activities/{self.activity['id']}/submissions", role='organizador')
        self.assertEqual(corrected[0]['links'], payload['links'])
        self.assertEqual(corrected[0]['attachments'][0]['url'], url)
        with self.api.sessions() as db:
            for role in ['trainee', 'admin', 'organizador']:
                response = activities.download_submission_attachment(self.activity['id'], attachment, db, db.get(models.User, role))
                self.assertEqual(Path(response.path).read_bytes(), b'%PDF-1.4\ntest')
            with self.assertRaises(HTTPException) as error:
                activities.download_submission_attachment(self.activity['id'], attachment, db, db.get(models.User, 'other'))
            self.assertEqual(error.exception.status_code, 403)
        grade_url = f"/api/activities/{self.activity['id']}/submissions/{result['id']}"
        self.request('PATCH', grade_url, {'grade': 8, 'feedback': 'Bom'})
        self.assertEqual(self.submit(**payload)[1]['grade'], 8)
        payload['links'] = ['https://example.com/alterado']
        self.assertIsNone(self.submit(**payload)[1]['grade'])

    def test_deleting_a_submission_removes_its_attachment_files(self):
        attachment = self.upload()
        status, result = self.submit(attachment_ids=[attachment])
        self.assertEqual(status, 200, result)
        self.assertEqual(len(list(Path(self.directory.name).iterdir())), 1)

        status, body = self.request('DELETE', f"/api/activities/{self.activity['id']}/submissions/{result['id']}")
        self.assertEqual(status, 200, body)
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])
        with self.api.sessions() as db:
            self.assertIsNone(db.get(models.SubmissionAttachment, attachment))

    def test_limits_invalid_links_and_foreign_attachments(self):
        self.assertEqual(self.submit(links=['https://example.com'], comment='Só link')[0], 400)
        self.assertEqual(self.submit(attachment_ids=['x'] * 6)[0], 422)
        self.assertEqual(self.submit(links=['javascript:alert(1)'])[0], 422)
        foreign = self.upload(role='other')
        self.assertEqual(self.submit(attachment_ids=[foreign])[0], 400)
        for filename, data, expected in [('script.exe', b'x', 400), ('empty.pdf', b'', 400)]:
            with self.assertRaises(HTTPException) as error:
                self.upload(filename, data)
            self.assertEqual(error.exception.status_code, expected)
        with patch.object(activities, 'MAX_ATTACHMENT_SIZE', 10):
            with self.assertRaises(HTTPException) as error:
                self.upload(data=b'x' * 11)
            self.assertEqual(error.exception.status_code, 413)
        self.assertEqual(len(list(Path(self.directory.name).iterdir())), 1)

    def test_locked_or_closed_activity_cannot_receive_files(self):
        self.request('PATCH', f"/api/nodes/{self.node['id']}/release", {'is_released': False})
        with self.assertRaises(HTTPException) as error:
            self.upload()
        self.assertEqual(error.exception.status_code, 403)
        self.request('PATCH', f"/api/nodes/{self.node['id']}/release", {'is_released': True})
        self.request('PATCH', f"/api/activities/{self.activity['id']}", {'is_open': False})
        with self.assertRaises(HTTPException) as error:
            self.upload()
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])

    def test_migration_preserves_legacy_link_and_grade(self):
        with self.api.engine.begin() as connection:
            connection.execute(text("INSERT INTO activity_submissions(id, activity_id, user_id, file_url, grade) VALUES ('legacy', :activity, 'trainee', 'https://example.com/old', 9)"), {'activity': self.activity['id']})
            connection.execute(text('ALTER TABLE activity_submissions DROP COLUMN links'))
        migrate(self.api.engine)
        migrate(self.api.engine)
        with self.api.sessions() as db:
            legacy = db.get(models.ActivitySubmission, 'legacy')
            self.assertEqual(legacy.file_url, 'https://example.com/old')
            self.assertEqual(legacy.grade, 9)
            self.assertEqual(legacy.links, [])
            self.assertEqual(legacy.attachments, [])
