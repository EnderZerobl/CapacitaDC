from typing import Optional, List, Literal
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field, model_validator

Role = Literal["admin", "organizador", "gerente", "membro", "trainee"]

# --- User Schemas ---
class UserBase(BaseModel):
    name: str
    email: EmailStr
    cargo: str
    type: Role
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
    rotacao: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    cargo: Optional[str] = None
    type: Optional[Role] = None
    eixo: Optional[str] = None
    password: Optional[str] = None

class TraineeUpdate(BaseModel):
    # A nota de rotação não entra aqui: ela é calculada a partir das atividades
    # corrigidas. Recusar o campo em vez de ignorá-lo evita um cliente antigo
    # achar que gravou uma nota.
    model_config = ConfigDict(extra="forbid")

    rotacao: Optional[int] = None  # 1 ou 2

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
    type: str  # "membro", "trainee"
    eixo: str  # "vendas", "conexoes", "experiencia"
    text: Optional[str] = ""

class MaterialCreate(MaterialBase):
    type: Literal["membro", "trainee"]
    eixo: Literal["vendas", "conexoes", "experiencia", "trainee", "all"]
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
    is_correct: Optional[bool] = None
    score: Optional[int] = None
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
    type: str  # "activity", "material", "game"
    reference_id: Optional[str] = None
    game_revision_id: Optional[str] = None
    game_format: Optional[Literal["quiz", "scenario"]] = None
    activity_id: Optional[str] = None
    eixo: str
    prerequisite_node_id: Optional[str] = None
    x_pos: Optional[float] = 0.0
    y_pos: Optional[float] = 0.0
    order_index: int = 0
    questions: List[QuestionOut] = []
    is_released: bool = False
    released_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    released_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class TrainingNodeGraphOut(TrainingNodeOut):
    # Pré-requisito que vale de fato: o escolhido à mão ou a etapa anterior do eixo.
    effective_prerequisite_id: Optional[str] = None
    completed: bool = False
    unlocked: bool = True
    user_score: int = 0

class NodeActivityUpdate(BaseModel):
    activity_id: str = Field(min_length=1)


class NodeReleaseUpdate(BaseModel):
    is_released: bool
    released_at: Optional[datetime] = None  # None = liberar imediatamente

class OptionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    text: str = Field(min_length=1)
    is_correct: bool = False
    score: int = Field(default=0, ge=0)
    feedback: Optional[str] = ""

class QuestionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    text: str = Field(min_length=1)
    explanation: Optional[str] = ""
    options: List[OptionCreate] = Field(min_length=2)

    @model_validator(mode="after")
    def validate_answers(self):
        if not any(option.is_correct for option in self.options):
            raise ValueError("Cada pergunta precisa de pelo menos uma alternativa correta")
        return self

class TrainingNodeCreate(BaseModel):
    name: Optional[str] = None
    type: Literal["activity", "material", "game"]
    eixo: Literal["trainee", "vendas", "conexoes", "experiencia", "all"]
    activity_id: Optional[str] = None
    reference_id: Optional[str] = None
    game_revision_id: Optional[str] = None
    prerequisite_node_id: Optional[str] = None
    is_released: bool = False
    deadline: Optional[datetime] = None
    questions: List[QuestionCreate] = []

    @model_validator(mode="after")
    def validate_content(self):
        if self.type == "game":
            if not self.questions and not self.game_revision_id:
                raise ValueError("Selecione um jogo publicado ou adicione perguntas")
            if self.questions and self.game_revision_id:
                raise ValueError("Selecione um jogo publicado ou perguntas, sem misturar os formatos")
            if self.activity_id or self.reference_id:
                raise ValueError("Jogos não podem vincular uma atividade ou material")
        elif self.type == "material" and not self.reference_id:
            raise ValueError("Selecione o material da etapa")
        elif self.type == "activity" and not (self.activity_id or self.reference_id):
            raise ValueError("Selecione a atividade da etapa")
        if self.type != "game" and self.questions:
            raise ValueError("Perguntas são permitidas apenas em jogos")
        if self.type != "game" and self.game_revision_id:
            raise ValueError("Versões de jogos são permitidas apenas em etapas de jogo")
        return self

class GameAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question_id: str
    option_id: str

class GameSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: List[GameAnswer] = Field(min_length=1)

class LeaderboardEntry(BaseModel):
    id: str
    name: str
    email: str
    cargo: str
    type: str
    eixo: Optional[str] = None
    pontos_acumulados: int = 0

    model_config = ConfigDict(from_attributes=True)


# --- Activity & Submission Schemas ---

class ActivityCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    eixo: str  # "trainee", "vendas", "conexoes", "experiencia", "all"
    accepts_file: bool = True
    deadline: Optional[datetime] = None
    material_id: Optional[str] = None
    weight: float = Field(default=1.0, ge=0, allow_inf_nan=False)

class ActivityUpdate(BaseModel):
    is_open: Optional[bool] = None
    deadline: Optional[datetime] = None
    title: Optional[str] = None
    description: Optional[str] = None
    accepts_file: Optional[bool] = None
    material_id: Optional[str] = None
    weight: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False)

class SubmissionAttachmentOut(BaseModel):
    id: str
    name: str
    size: int
    url: str
    model_config = ConfigDict(from_attributes=True)


class ActivitySubmissionOut(BaseModel):
    id: str
    activity_id: str
    user_id: str
    file_url: Optional[str] = None
    links: List[str] = Field(default_factory=list, max_length=10)
    attachments: List[SubmissionAttachmentOut] = Field(default_factory=list)
    comment: Optional[str] = ""
    submitted_at: Optional[datetime] = None
    grade: Optional[float] = None
    feedback: Optional[str] = ""
    user_name: Optional[str] = None      # populated from join
    user_type: Optional[str] = None      # trainee ou membro, para a fila de correção
    activity_title: Optional[str] = None
    activity_weight: Optional[float] = None
    activity_eixo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ActivityOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    eixo: str
    accepts_file: bool
    deadline: Optional[datetime] = None
    is_open: bool
    weight: float = 1.0
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    material_id: Optional[str] = None
    # computed: effective_open (deadline check)
    effective_open: bool = True
    submission_count: int = 0
    my_submission: Optional[ActivitySubmissionOut] = None  # present for trainee/member requests

    model_config = ConfigDict(from_attributes=True)

class NodeContentOut(BaseModel):
    node: TrainingNodeGraphOut
    activity: Optional[ActivityOut] = None
    material: Optional[MaterialOut] = None


class SubmissionCreate(BaseModel):
    node_id: Optional[str] = None
    file_url: Optional[str] = None  # Older clients may still send a link here.
    attachment_ids: List[str] = Field(default_factory=list, max_length=5)
    links: List[str] = Field(default_factory=list, max_length=10)
    comment: Optional[str] = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def validate_links(self):
        from urllib.parse import urlsplit
        self.links = [link.strip() for link in self.links if link.strip()]
        if self.file_url:
            self.file_url = self.file_url.strip() or None
        for link in self.links + ([self.file_url] if self.file_url else []):
            parsed = urlsplit(link)
            if len(link) > 2048 or parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError("Informe links válidos começando com http:// ou https://")
        if len(self.attachment_ids) != len(set(self.attachment_ids)):
            raise ValueError("Um anexo não pode ser enviado duas vezes")
        return self

class SubmissionGrade(BaseModel):
    grade: float = Field(ge=0, le=10)
    feedback: Optional[str] = ""


# --- Profile & Grades Schemas ---

class NodeProgressOut(BaseModel):
    node_id: str
    node_name: str
    node_type: str
    completed: bool
    score: int
    completed_at: Optional[datetime] = None

class UserProfileOut(BaseModel):
    id: str
    name: str
    email: str
    cargo: str
    type: str
    eixo: Optional[str] = None
    rotacao: Optional[int] = None
    nota_rotacao: Optional[float] = None
    pontos_acumulados: int = 0
    node_progress: List[NodeProgressOut] = []
    activity_submissions: List[ActivitySubmissionOut] = []

class NodeOrderUpdate(BaseModel):
    order_index: int

class GradeRow(BaseModel):
    id: str
    name: str
    email: str
    cargo: str
    type: str
    eixo: Optional[str] = None
    rotacao: Optional[int] = None
    nota_rotacao: Optional[float] = None
    pontos_acumulados: int = 0
    nodes_completed: int = 0
    nodes_total: int = 0
    activities_submitted: int = 0
    activities_graded: int = 0
