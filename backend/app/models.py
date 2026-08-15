import uuid
from sqlalchemy import Column, String, Float, Boolean, ForeignKey, Text, Integer, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    cargo = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "admin", "organizador", "membro", "trainee"
    eixo = Column(String, nullable=True)   # "Vendas", "Conexões", "Experiência do Consumidor", etc.
    photo = Column(String, nullable=True, default="")
    nota_rotacao = Column(Float, nullable=True)
    pontos_acumulados = Column(Integer, default=0, nullable=False)
    rotacao = Column(Integer, nullable=True)  # 1 ou 2 — apenas para trainees

    # Relationships
    node_progress = relationship("UserNodeProgress", back_populates="user", cascade="all, delete-orphan")

class Material(Base):
    __tablename__ = "materials"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "membro", "trainee", "pluginfo"
    eixo = Column(String, nullable=False)  # "vendas", "conexoes", "experiencia", "pluginfo"
    text = Column(Text, nullable=True, default="")

    # Relationships
    documents = relationship("Document", back_populates="material", cascade="all, delete-orphan")
    videos = relationship("Video", back_populates="material", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    material_id = Column(String, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)

    # Relationships
    material = relationship("Material", back_populates="documents")

class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True, default=generate_uuid)
    material_id = Column(String, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)

    # Relationships
    material = relationship("Material", back_populates="videos")

# --- Trilha de Aprendizado em Grafo / Jogos ---

class TrainingNode(Base):
    __tablename__ = "training_nodes"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "material", "game"
    reference_id = Column(String, nullable=True)  # Material.id if type == "material", null if game
    eixo = Column(String, nullable=False)  # "vendas", "conexoes", "experiencia", "trainee"
    prerequisite_node_id = Column(String, ForeignKey("training_nodes.id", ondelete="SET NULL"), nullable=True)
    x_pos = Column(Float, nullable=True, default=0.0)
    y_pos = Column(Float, nullable=True, default=0.0)
    order_index = Column(Integer, default=0, nullable=False)  # controla a ordem na trilha

    # Controle de liberação (somente admin/organizador pode alterar)
    is_released = Column(Boolean, default=False, nullable=False)
    released_at = Column(DateTime, nullable=True)   # Se definido, libera na data/hora especificada
    released_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    activity_id = Column(String, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True)
    activity = relationship("Activity")
    deadline = Column(DateTime, nullable=True)     # Prazo da atividade associada ao nó

    # Relationships
    questions = relationship("Question", back_populates="node", cascade="all, delete-orphan")
    progress = relationship("UserNodeProgress", back_populates="node", cascade="all, delete-orphan")

class Question(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, default=generate_uuid)
    node_id = Column(String, ForeignKey("training_nodes.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True, default="")

    # Relationships
    node = relationship("TrainingNode", back_populates="questions")
    options = relationship("Option", back_populates="question", cascade="all, delete-orphan")

class Option(Base):
    __tablename__ = "options"

    id = Column(String, primary_key=True, default=generate_uuid)
    question_id = Column(String, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    text = Column(String, nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)
    score = Column(Integer, default=0, nullable=False)
    feedback = Column(Text, nullable=True, default="")

    # Relationships
    question = relationship("Question", back_populates="options")

class UserNodeProgress(Base):
    __tablename__ = "user_node_progress"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(String, ForeignKey("training_nodes.id", ondelete="CASCADE"), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    score = Column(Integer, default=0, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="node_progress")
    node = relationship("TrainingNode", back_populates="progress")


# --- Atividades com envio de arquivo e deadline ---

class Activity(Base):
    __tablename__ = "activities"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True, default="")
    eixo = Column(String, nullable=False)          # "trainee", "vendas", "conexoes", "experiencia", "pluginfo", "all"
    accepts_file = Column(Boolean, default=True, nullable=False)  # Se exige envio de arquivo
    deadline = Column(DateTime, nullable=True)     # None = sem prazo definido
    is_open = Column(Boolean, default=True, nullable=False)  # Fechamento manual ou automático via deadline
    weight = Column(Float, default=1.0, nullable=False)    # Peso para cálculo de média ponderada
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=True)

    material_id = Column(String, ForeignKey("materials.id", ondelete="SET NULL"), nullable=True)
    material = relationship("Material")

    # Relationships
    submissions = relationship("ActivitySubmission", back_populates="activity", cascade="all, delete-orphan")


class ActivitySubmission(Base):
    __tablename__ = "activity_submissions"

    id = Column(String, primary_key=True, default=generate_uuid)
    activity_id = Column(String, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String, nullable=True)       # URL do arquivo enviado (Google Drive, etc.)
    comment = Column(Text, nullable=True, default="")  # Comentário opcional do trainee
    submitted_at = Column(DateTime, nullable=True)
    grade = Column(Float, nullable=True)           # Nota atribuída pelo admin (0-10)
    feedback = Column(Text, nullable=True, default="")  # Feedback do avaliador

    # Relationships
    activity = relationship("Activity", back_populates="submissions")
    user = relationship("User")
