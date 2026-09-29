"""Attachment permissions, limits, persistence and correction metadata."""
import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import text
import test_creation
from app import models, schemas
from app.api import activities
from app.services import blob_storage
from app.migrations import migrate
from vercel.blob.errors import BlobNoTokenProvidedError


class SubmissionAttachmentTests(unittest.TestCase):
    def setUp(self):
        self.api = test_creation.CreationTests()
        self.api.setUp()
        self.request, self.create = self.api.request, self.api.create
        self.store: dict[str, bytes] = {}
        self.upload_patch = patch.object(
            blob_storage, 'upload',
            side_effect=lambda pathname, data, content_type=None: self.store.__setitem__(pathname, data) or pathname,
        )
        self.download_patch = patch.object(blob_storage, 'download', side_effect=self.store.get)
        self.delete_patch = patch.object(blob_storage, 'delete', side_effect=lambda pathname: self.store.pop(pathname, None))
        self.size_patch = patch.object(blob_storage, 'size', side_effect=lambda pathname: len(self.store[pathname]) if pathname in self.store else None)
        self.token_patch = patch.object(blob_storage, 'client_upload_token', side_effect=lambda pathname, max_size: f'vercel_blob_client_test_{pathname}')
        for started in [self.upload_patch, self.download_patch, self.delete_patch, self.size_patch, self.token_patch]:
            started.start()
        with self.api.sessions() as db:
            for role in ['trainee', 'other']:
                db.add(models.User(id=role, name=role, email=f'{role}@example.com', password_hash='unused', cargo='trainee', type='trainee'))
            db.commit()
        self.activity = self.create('activities', {'title': 'Entrega com anexos', 'eixo': 'trainee', 'accepts_file': True})
        self.node = self.create('nodes', {'type': 'activity', 'eixo': 'trainee', 'activity_id': self.activity['id'], 'is_released': True})

    def tearDown(self):
        for started in [self.upload_patch, self.download_patch, self.delete_patch, self.size_patch, self.token_patch]:
            started.stop()
        self.api.tearDown()

    def upload_token(self, filename='resposta.pdf', size=13, role='trainee'):
        with self.api.sessions() as db:
            return activities.create_attachment_upload_token(self.activity['id'], schemas.AttachmentUploadRequest(
                name=filename, size=size, node_id=self.node['id']), db, db.get(models.User, role))

    def register(self, pathname, filename='resposta.pdf', role='trainee'):
        with self.api.sessions() as db:
            return activities.register_submission_attachment(self.activity['id'], schemas.AttachmentRegister(
                pathname=pathname, name=filename, node_id=self.node['id']), db, db.get(models.User, role)).id

    def upload(self, filename='resposta.pdf', data=b'%PDF-1.4\ntest', role='trainee'):
        pathname = self.upload_token(filename, len(data), role)['pathname']
        self.store[pathname] = data  # the browser sends the file straight to storage
        return self.register(pathname, filename, role)

    def download(self, attachment, role):
        with self.api.sessions() as db:
            response = activities.download_submission_attachment(self.activity['id'], attachment, db, db.get(models.User, role))
        async def chunks():
            return [chunk async for chunk in response.body_iterator]
        return asyncio.run(chunks())

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
        for role in ['trainee', 'admin', 'organizador']:
            self.assertEqual(b''.join(self.download(attachment, role)), b'%PDF-1.4\ntest')
        with self.assertRaises(HTTPException) as error:
            self.download(attachment, 'other')
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
        self.assertEqual(len(self.store), 1)

        status, body = self.request('DELETE', f"/api/activities/{self.activity['id']}/submissions/{result['id']}")
        self.assertEqual(status, 200, body)
        self.assertEqual(self.store, {})
        with self.api.sessions() as db:
            self.assertIsNone(db.get(models.SubmissionAttachment, attachment))

    def test_limits_invalid_links_and_foreign_attachments(self):
        self.assertEqual(self.submit(links=['https://example.com'], comment='Só link')[0], 400)
        self.assertEqual(self.submit(attachment_ids=['x'] * 6)[0], 422)
        self.assertEqual(self.submit(links=['javascript:alert(1)'])[0], 422)
        foreign = self.upload(role='other')
        self.assertEqual(self.submit(attachment_ids=[foreign])[0], 400)
        # Refused before the browser sends anything to storage.
        for filename, size, expected in [('script.exe', 1, 400), ('empty.pdf', 0, 400)]:
            with self.assertRaises(HTTPException) as error:
                self.upload_token(filename, size)
            self.assertEqual(error.exception.status_code, expected)
        with patch.object(activities, 'MAX_ATTACHMENT_SIZE', 10):
            with self.assertRaises(HTTPException) as error:
                self.upload_token(size=11)
            self.assertEqual(error.exception.status_code, 413)
        self.assertEqual(len(self.store), 1)

    def test_locked_or_closed_activity_cannot_receive_files(self):
        # A token issued while the step was open does not register the file later.
        issued = self.upload_token()['pathname']
        self.store[issued] = b'%PDF-1.4\ntest'
        self.request('PATCH', f"/api/nodes/{self.node['id']}/release", {'is_released': False})
        for attempt in [self.upload, lambda: self.register(issued)]:
            with self.assertRaises(HTTPException) as error:
                attempt()
            self.assertEqual(error.exception.status_code, 403)
        self.request('PATCH', f"/api/nodes/{self.node['id']}/release", {'is_released': True})
        self.request('PATCH', f"/api/activities/{self.activity['id']}", {'is_open': False})
        for attempt in [self.upload, lambda: self.register(issued)]:
            with self.assertRaises(HTTPException) as error:
                attempt()
            self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(list(self.store), [issued])
        with self.api.sessions() as db:
            self.assertEqual(db.query(models.SubmissionAttachment).count(), 0)

    def test_registration_requires_an_issued_and_completed_upload(self):
        pathname = self.upload_token()['pathname']
        blob_storage.client_upload_token.assert_called_with(pathname, activities.MAX_ATTACHMENT_SIZE)
        self.assertTrue(pathname.startswith('submissions/trainee/') and pathname.endswith('.pdf'))
        with self.assertRaises(HTTPException) as error:
            self.register(pathname)  # token issued, but the file never reached storage
        self.assertEqual((error.exception.status_code, error.exception.detail),
                         (400, 'O envio do arquivo não foi concluído. Tente novamente.'))
        forged = 'submissions/trainee/relatorio.pdf'
        self.store.update({pathname: b'%PDF-1.4\ntest', forged: b'%PDF-1.4\ntest'})
        for target, filename, role in [(pathname, 'resposta.pdf', 'other'),   # issued to someone else
                                       (forged, 'resposta.pdf', 'trainee'),     # not issued by the API
                                       (pathname, 'resposta.csv', 'trainee')]:  # not the requested format
            with self.assertRaises(HTTPException) as error:
                self.register(target, filename, role)
            self.assertEqual(error.exception.status_code, 400, target)
        attachment = self.register(pathname)
        with self.assertRaises(HTTPException) as error:
            self.register(pathname)  # registered only once
        self.assertEqual(error.exception.status_code, 400)
        with self.api.sessions() as db:
            stored = db.get(models.SubmissionAttachment, attachment)
            self.assertEqual((stored.storage_key, stored.size, stored.user_id), (pathname, 13, 'trainee'))
            self.assertEqual(db.query(models.SubmissionAttachment).count(), 1)

    def test_registration_discards_uploads_outside_the_limits(self):
        empty = self.upload_token()['pathname']
        self.store[empty] = b''
        with patch.object(activities, 'MAX_ATTACHMENT_SIZE', 10):
            oversized = self.upload_token(size=5)['pathname']
            self.store[oversized] = b'x' * 11  # the real store enforces the token limit too
            for pathname, expected in [(empty, 400), (oversized, 413)]:
                with self.assertRaises(HTTPException) as error:
                    self.register(pathname)
                self.assertEqual(error.exception.status_code, expected)
        self.assertEqual(self.store, {})

    def test_large_attachment_download_is_streamed_in_chunks(self):
        data = b'%PDF' + os.urandom(2 * activities.DOWNLOAD_CHUNK_SIZE)
        chunks = self.download(self.upload(data=data), 'trainee')
        self.assertEqual([len(chunk) for chunk in chunks], [activities.DOWNLOAD_CHUNK_SIZE] * 2 + [4])
        self.assertEqual(b''.join(chunks), data)

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


class ClientUploadTokenTests(unittest.TestCase):
    """The format generateClientTokenFromReadWriteToken (@vercel/blob) produces."""

    def test_token_signs_the_upload_constraints_with_the_store_token(self):
        read_write = 'vercel_blob_rw_store123_secret'
        with patch.dict(os.environ, {'BLOB_READ_WRITE_TOKEN': read_write}):
            token = blob_storage.client_upload_token('submissions/u/arquivo.pdf', 20)
        self.assertTrue(token.startswith('vercel_blob_client_store123_'))
        signature, payload = base64.b64decode(token.removeprefix('vercel_blob_client_store123_')).decode().split('.', 1)
        self.assertEqual(signature, hmac.new(read_write.encode(), payload.encode(), hashlib.sha256).hexdigest())
        claims = json.loads(base64.b64decode(payload))
        self.assertEqual({key: claims[key] for key in ['pathname', 'maximumSizeInBytes', 'addRandomSuffix', 'allowOverwrite']},
                         {'pathname': 'submissions/u/arquivo.pdf', 'maximumSizeInBytes': 20, 'addRandomSuffix': False, 'allowOverwrite': False})
        self.assertTrue(time.time() * 1000 < claims['validUntil'] <= (time.time() + 600) * 1000)

    def test_token_requires_a_read_write_token(self):
        with patch.dict(os.environ):
            os.environ.pop('BLOB_READ_WRITE_TOKEN', None)
            os.environ.pop('VERCEL_BLOB_READ_WRITE_TOKEN', None)
            with self.assertRaises(BlobNoTokenProvidedError):
                blob_storage.client_upload_token('submissions/u/arquivo.pdf', 20)
