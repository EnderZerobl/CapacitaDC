"""Start the real API with disposable SQLite data for browser tests.

Usage: backend/.venv/bin/python backend/tests/serve.py --port 8021
Never reads or changes the configured application database.
"""
import argparse
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8021)
    args = parser.parse_args()
    with TemporaryDirectory(prefix='capacita-browser-') as directory:
        database = Path(directory) / 'database.db'
        os.environ['DATABASE_URL'] = f'sqlite:///{database}'
        os.environ['JWT_SECRET_KEY'] = 'disposable-browser-tests-only'
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from app.main import app
        from app.database import SessionLocal, engine
        from app import models
        from app.auth import get_password_hash
        from app.services import blob_storage
        import uvicorn

        # No real Vercel Blob store for disposable browser tests: an in-memory
        # dict stands in for it for the life of this one process.
        store: dict[str, bytes] = {}

        def fake_upload(pathname, data, content_type=None):
            store[pathname] = data
            return pathname

        blob_storage.upload = fake_upload
        blob_storage.download = store.get
        blob_storage.delete = lambda pathname: store.pop(pathname, None)
        with SessionLocal() as db:
            for role in ['admin', 'organizador', 'membro', 'trainee']:
                db.add(models.User(
                    id=role, name=role.capitalize(), email=f'{role}@example.com',
                    type=role, cargo=role, password_hash=get_password_hash('qa-test-password'),
                    pontos_acumulados=0, eixo='vendas' if role == 'membro' else None,
                ))
            db.commit()
        print(f'Banco descartável: {database}', flush=True)
        print('Contas: admin/organizador/membro/trainee@example.com; senha de teste: qa-test-password', flush=True)
        try:
            uvicorn.run(app, host='127.0.0.1', port=args.port)
        finally:
            engine.dispose()


if __name__ == '__main__':
    main()
