import uuid
from app.database import engine, SessionLocal
from app.models import Base, User
from app.auth import get_password_hash

def seed_db():
    print("Recriando tabelas do banco de dados...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Criando usuário admin...")
        admin = User(
            id=str(uuid.uuid4()),
            name="Admin Info",
            email="admin@infoej.com.br",
            password_hash=get_password_hash("admin123"),
            cargo="Administrador",
            type="admin",
            eixo=None,
            photo="",
            nota_rotacao=None,
            pontos_acumulados=0
        )
        db.add(admin)
        db.commit()
        print("Usuário admin criado com sucesso! (admin@infoej.com.br / admin123)")
    except Exception as e:
        db.rollback()
        print(f"Erro durante seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
