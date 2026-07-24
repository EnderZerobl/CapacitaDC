from app.database import engine
from app.models import Base

def seed_db():
    print("Recriando tabelas do banco de dados...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Tabelas criadas com sucesso!")

if __name__ == "__main__":
    seed_db()
