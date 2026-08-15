import uuid
from app.database import engine, SessionLocal
from app.models import Base, User
from app.auth import get_password_hash


def seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        existing_admin = db.query(User).filter(User.email == "admin@infojr.com.br").first()
        if not existing_admin:
            print("Criando usuário admin...")
            admin = User(
                id=str(uuid.uuid4()),
                name="Admin",
                email="admin@infojr.com.br",
                password_hash=get_password_hash("admin123"),
                cargo="Administrador",
                type="admin",
                eixo=None,
                nota_rotacao=None,
                pontos_acumulados=0,
                rotacao=None
            )
            db.add(admin)
            db.commit()
            print("✅ Admin criado com sucesso!")
        else:
            print("✅ Admin 'admin@infojr.com.br' já existe no banco.")

        print("   Email: admin@infojr.com.br")
        print("   Senha: admin123")

    except Exception as e:
        db.rollback()
        print(f"❌ Erro durante seeding: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()
