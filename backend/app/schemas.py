from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict

# --- User Schemas ---
class UserBase(BaseModel):
    name: str
    email: EmailStr
    cargo: str
    type: str  # "admin", "organizador", "membro", "trainee"
    eixo: Optional[str] = None
    photo: Optional[str] = ""

class UserCreate(UserBase):
    password: Optional[str] = "123456"  # Default password for members created by admin

class UserRegister(BaseModel):
    name: str
    cargo: str
    email: EmailStr
    password: str

class UserOut(UserBase):
    id: str
    nota_rotacao: Optional[float] = None
    pontos_acumulados: int = 0

    model_config = ConfigDict(from_attributes=True)

class TraineeUpdate(BaseModel):
    notaRotacao: Optional[float] = None

# --- Document Schemas ---
class DocumentBase(BaseModel):
    name: str
    url: str

class DocumentCreate(DocumentBase):
    pass

class DocumentOut(DocumentBase):
    id: str

    model_config = ConfigDict(from_attributes=True)

# --- Video Schemas ---
class VideoBase(BaseModel):
    url: str

class VideoCreate(VideoBase):
    pass

class VideoOut(VideoBase):
    id: str

    model_config = ConfigDict(from_attributes=True)

# --- Material Schemas ---
class MaterialBase(BaseModel):
    name: str
    type: str  # "membro", "trainee", "pluginfo"
    eixo: str  # "vendas", "conexoes", "experiencia", "pluginfo"
    text: Optional[str] = ""

class MaterialCreate(MaterialBase):
    documents: List[DocumentCreate] = []
    videos: List[str] = []  # List of URLs

class MaterialOut(MaterialBase):
    id: str
    documents: List[DocumentOut] = []
    videos: List[VideoOut] = []

    model_config = ConfigDict(from_attributes=True)

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class TokenData(BaseModel):
    email: Optional[str] = None

# --- Game & Node Graph Schemas ---

class OptionOut(BaseModel):
    id: str
    text: str
    is_correct: bool
    score: int
    feedback: Optional[str] = ""

    model_config = ConfigDict(from_attributes=True)

class QuestionOut(BaseModel):
    id: str
    text: str
    explanation: Optional[str] = ""
    options: List[OptionOut] = []

    model_config = ConfigDict(from_attributes=True)

class TrainingNodeOut(BaseModel):
    id: str
    name: str
    type: str  # "material", "game"
    reference_id: Optional[str] = None
    eixo: str
    prerequisite_node_id: Optional[str] = None
    x_pos: Optional[float] = 0.0
    y_pos: Optional[float] = 0.0
    questions: List[QuestionOut] = []
    is_released: bool = False
    released_at: Optional[datetime] = None
    released_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class TrainingNodeGraphOut(TrainingNodeOut):
    completed: bool = False
    unlocked: bool = True
    user_score: int = 0

class NodeReleaseUpdate(BaseModel):
    is_released: bool
    released_at: Optional[datetime] = None  # None = liberar imediatamente

class GameSubmitRequest(BaseModel):
    score: int

class LeaderboardEntry(BaseModel):
    id: str
    name: str
    email: str
    cargo: str
    type: str
    eixo: Optional[str] = None
    pontos_acumulados: int = 0

    model_config = ConfigDict(from_attributes=True)
