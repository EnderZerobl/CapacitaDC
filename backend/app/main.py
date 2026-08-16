import uuid
import os
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from app.database import get_db, engine
from app import models, schemas
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_admin,
    get_current_organizador_or_admin,
    get_current_member_or_above,
)

app = FastAPI(title="Capacita DC API")

# Ensure database tables and columns are created
models.Base.metadata.create_all(bind=engine)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files as static content
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# --- File Upload Endpoint ---

ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "png", "jpg", "jpeg", "gif", "webp", "zip", "txt", "csv"
}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Tipo de arquivo .{ext} não permitido.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Arquivo muito grande. Limite: 20 MB.")

    safe_name = f"{uuid.uuid4().hex}_{file.filename.replace(' ', '_')}"
    dest = UPLOAD_DIR / safe_name
    with open(dest, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/{safe_name}", "name": file.filename}

# --- Authentication Endpoints ---

@app.post("/api/auth/register", response_model=schemas.UserOut)
def register_user(user_in: schemas.UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Este email já está cadastrado"
        )
    
    user_type = "trainee"
    eixo = None
    if user_in.email.endswith("@infoej.com.br"):
        if user_in.email.startswith("admin@"):
            user_type = "admin"
        elif user_in.email.startswith("organizador@"):
            user_type = "organizador"
        else:
            user_type = "membro"
            eixo = "Vendas"

    new_user = models.User(
        id=str(uuid.uuid4()),
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        cargo=user_in.cargo,
        type=user_type,
        eixo=eixo,
        photo="",
        nota_rotacao=0.0 if user_type == "trainee" else None,
        pontos_acumulados=0
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

class LoginRequest(schemas.BaseModel):
    email: str
    password: str

@app.post("/api/auth/login", response_model=schemas.Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ou senha incorretos"
        )
    
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/auth/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


# --- Users/Members Management Endpoints ---

@app.get("/api/users", response_model=List[schemas.UserOut])
def get_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_member_or_above)
):
    # Organizador only sees trainees
    if current_user.type == "organizador":
        users = db.query(models.User).filter(models.User.type == "trainee").all()
    else:
        # Admin and Membro see all users
        users = db.query(models.User).all()
    return users

@app.post("/api/users", response_model=schemas.UserOut)
def create_member(
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    # Organizadores can only create trainees
    if current_user.type == "organizador" and user_in.type != "trainee":
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores do PlugInfo só podem cadastrar trainees."
        )

    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Este email já está cadastrado"
        )

    cargo_label = user_in.cargo
    if user_in.cargo == "membro":
        cargo_label = "Membro"
    elif user_in.cargo == "organizador":
        cargo_label = "Organizador do PlugInfo"
    elif user_in.cargo == "trainee":
        cargo_label = "Trainee"

    eixo_label = None
    if user_in.eixo:
        eixo_labels = {
            "vendas": "Vendas",
            "conexoes": "Conexões",
            "experiencia": "Experiência do Consumidor"
        }
        eixo_label = eixo_labels.get(user_in.eixo.lower(), user_in.eixo)

    new_user = models.User(
        id=str(uuid.uuid4()),
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password or "123456"),
        cargo=cargo_label,
        type=user_in.type,
        eixo=eixo_label,
        photo=user_in.photo or "",
        nota_rotacao=0.0 if user_in.type == "trainee" else None,
        pontos_acumulados=0
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.delete("/api/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if current_user.id == user.id:
        raise HTTPException(status_code=400, detail="Você não pode excluir a sua própria conta")
        
    if current_user.type == "organizador" and user.type != "trainee":
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores do PlugInfo só podem excluir trainees."
        )
        
    db.query(models.UserNodeProgress).filter(models.UserNodeProgress.user_id == user_id).delete()
    db.query(models.ActivitySubmission).filter(models.ActivitySubmission.user_id == user_id).delete()
    
    db.delete(user)
    db.commit()
    return {"message": "Usuário excluído com sucesso"}

@app.put("/api/users/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: str,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
    if current_user.type == "organizador" and user.type != "trainee":
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores do PlugInfo só podem gerenciar trainees."
        )
        
    if current_user.type == "organizador" and user_update.type and user_update.type != "trainee":
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem manter o perfil como trainee."
        )

    if user_update.name is not None:
        user.name = user_update.name
    if user_update.email is not None:
        other_user = db.query(models.User).filter(models.User.email == user_update.email, models.User.id != user_id).first()
        if other_user:
            raise HTTPException(status_code=400, detail="Este email já está sendo utilizado por outro usuário")
        user.email = user_update.email
    if user_update.cargo is not None:
        user.cargo = user_update.cargo
    if user_update.type is not None:
        user.type = user_update.type
    if user_update.eixo is not None:
        user.eixo = user_update.eixo
    if user_update.password is not None and user_update.password.strip() != "":
        user.password_hash = get_password_hash(user_update.password)
        
    db.commit()
    db.refresh(user)
    return user

@app.put("/api/users/trainees/{trainee_id}", response_model=schemas.UserOut)
def update_trainee(
    trainee_id: str,
    trainee_update: schemas.TraineeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_member_or_above)
):
    trainee = db.query(models.User).filter(models.User.id == trainee_id, models.User.type == "trainee").first()
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee não encontrado")

    if trainee_update.notaRotacao is not None:
        trainee.nota_rotacao = trainee_update.notaRotacao
    if trainee_update.rotacao is not None:
        if trainee_update.rotacao not in [1, 2]:
            raise HTTPException(status_code=400, detail="Rotação deve ser 1 ou 2")
        trainee.rotacao = trainee_update.rotacao

    db.commit()
    db.refresh(trainee)
    return trainee


# --- Materials / Contents Endpoints ---

@app.get("/api/materials", response_model=List[schemas.MaterialOut])
def get_materials(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.type == "trainee":
        materials = db.query(models.Material).filter(models.Material.type == "trainee").all()
    elif current_user.type == "membro":
        materials = db.query(models.Material).filter(models.Material.type.in_(["trainee", "membro"])).all()
    elif current_user.type == "organizador":
        materials = db.query(models.Material).filter(models.Material.type.in_(["trainee", "pluginfo"])).all()
    else:
        # Admin sees everything
        materials = db.query(models.Material).all()
    return materials

@app.post("/api/materials", response_model=schemas.MaterialOut)
def create_material(
    material_in: schemas.MaterialCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    # Organizador can create pluginfo and trainee materials
    if current_user.type == "organizador" and material_in.type not in ["pluginfo", "trainee"]:
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem gerenciar conteúdos do PlugInfo e Trainees."
        )

    new_material = models.Material(
        id=str(uuid.uuid4()),
        name=material_in.name,
        type=material_in.type,
        eixo=material_in.eixo,
        text=material_in.text or ""
    )
    db.add(new_material)
    db.flush()

    for doc in material_in.documents:
        db_doc = models.Document(
            id=str(uuid.uuid4()),
            material_id=new_material.id,
            name=doc.name,
            url=doc.url
        )
        db.add(db_doc)

    for video_url in material_in.videos:
        db_video = models.Video(
            id=str(uuid.uuid4()),
            material_id=new_material.id,
            url=video_url
        )
        db.add(db_video)

    db.commit()
    db.refresh(new_material)
    return new_material

@app.put("/api/materials/{material_id}", response_model=schemas.MaterialOut)
def update_material(
    material_id: str,
    material_in: schemas.MaterialCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado")

    if current_user.type == "organizador" and (material.type not in ["pluginfo", "trainee"] or material_in.type not in ["pluginfo", "trainee"]):
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem gerenciar conteúdos do PlugInfo e Trainees."
        )

    material.name = material_in.name
    material.type = material_in.type
    material.eixo = material_in.eixo
    material.text = material_in.text or ""

    db.query(models.Document).filter(models.Document.material_id == material_id).delete()
    db.query(models.Video).filter(models.Video.material_id == material_id).delete()

    for doc in material_in.documents:
        db_doc = models.Document(
            id=str(uuid.uuid4()),
            material_id=material_id,
            name=doc.name,
            url=doc.url
        )
        db.add(db_doc)

    for video_url in material_in.videos:
        db_video = models.Video(
            id=str(uuid.uuid4()),
            material_id=material_id,
            url=video_url
        )
        db.add(db_video)

    db.commit()
    db.refresh(material)
    return material

@app.delete("/api/materials/{material_id}")
def delete_material(
    material_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado")

    if current_user.type == "organizador" and material.type not in ["pluginfo", "trainee"]:
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem gerenciar conteúdos do PlugInfo e Trainees."
        )

    db.delete(material)
    db.commit()
    return {"detail": "Material deletado com sucesso"}


# --- Graph Nodes / Path & Games Endpoints ---

def _node_is_effectively_released(node: models.TrainingNode) -> bool:
    """
    Returns True if the node is considered released right now.
    Admin/Organizador always bypass this check (handled at the caller level).
    """
    if not node.is_released:
        return False
    if node.released_at is None:
        return True  # Released immediately (no scheduled date)
    now = datetime.now(timezone.utc)
    released_at = node.released_at
    # Make released_at timezone-aware for comparison if it's naive
    if released_at.tzinfo is None:
        released_at = released_at.replace(tzinfo=timezone.utc)
    return released_at <= now


# --- Create / Delete nodes ---

@app.post("/api/nodes", response_model=schemas.TrainingNodeGraphOut)
@app.post("/api/nodes/", response_model=schemas.TrainingNodeGraphOut)
def create_training_node(
    node_in: schemas.TrainingNodeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    # Determine node name automatically if not provided
    node_name = (node_in.name or "").strip()
    activity_id = node_in.activity_id or (node_in.reference_id if node_in.type == "activity" else None)
    reference_id = node_in.reference_id if node_in.type == "material" else None

    act = None
    if activity_id:
        act = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
        # Note: reference_id is NOT overwritten with act.material_id here.
        # Activity nodes store the activity link via activity_id; the material
        # is resolved on demand (e.g. on the member/trainee view).

    if not node_name:
        if act:
            node_name = act.title
        elif node_in.type == "material" and reference_id:
            mat = db.query(models.Material).filter(models.Material.id == reference_id).first()
            if mat:
                node_name = mat.name
        if not node_name:
            node_name = "Nó de Aprendizado"

    # Count existing nodes for this eixo to set initial order
    existing_count = db.query(models.TrainingNode).filter(
        models.TrainingNode.eixo == node_in.eixo
    ).count()

    new_node = models.TrainingNode(
        id=str(uuid.uuid4()),
        name=node_name,
        type=node_in.type,
        eixo=node_in.eixo,
        activity_id=activity_id,
        reference_id=reference_id,
        deadline=node_in.deadline,
        prerequisite_node_id=node_in.prerequisite_node_id,
        is_released=node_in.is_released,
        order_index=existing_count,
    )
    db.add(new_node)
    db.flush()

    for q_in in node_in.questions:
        question = models.Question(
            id=str(uuid.uuid4()),
            node_id=new_node.id,
            text=q_in.text,
            explanation=q_in.explanation or "",
        )
        db.add(question)
        db.flush()
        for o_in in q_in.options:
            option = models.Option(
                id=str(uuid.uuid4()),
                question_id=question.id,
                text=o_in.text,
                is_correct=o_in.is_correct,
                score=o_in.score,
                feedback=o_in.feedback or "",
            )
            db.add(option)

    db.commit()
    db.refresh(new_node)

    return schemas.TrainingNodeGraphOut(
        id=new_node.id,
        name=new_node.name,
        type=new_node.type,
        reference_id=new_node.reference_id,
        activity_id=new_node.activity_id,
        eixo=new_node.eixo,
        prerequisite_node_id=new_node.prerequisite_node_id,
        x_pos=new_node.x_pos,
        y_pos=new_node.y_pos,
        order_index=new_node.order_index,
        questions=new_node.questions,
        completed=False,
        unlocked=True,
        user_score=0,
        is_released=new_node.is_released,
        released_at=new_node.released_at,
        deadline=new_node.deadline,
        released_by=new_node.released_by,
    )


@app.delete("/api/nodes/{node_id}")
def delete_training_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó não encontrado")
    db.delete(node)
    db.commit()
    return {"detail": "Nó excluído com sucesso"}


@app.get("/api/nodes", response_model=List[schemas.TrainingNodeGraphOut])
@app.get("/api/nodes/", response_model=List[schemas.TrainingNodeGraphOut])
def get_training_nodes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    is_privileged = current_user.type in ["admin", "organizador"]

    # Query nodes by eixo
    if current_user.type == "trainee":
        nodes = db.query(models.TrainingNode).filter(models.TrainingNode.eixo == "trainee").all()
    elif current_user.type == "membro":
        nodes = db.query(models.TrainingNode).filter(
            models.TrainingNode.eixo.in_(["vendas", "conexoes", "experiencia"])
        ).all()
    else:
        nodes = db.query(models.TrainingNode).all()

    # Load user progress
    progress_map = {
        p.node_id: p for p in db.query(models.UserNodeProgress).filter(
            models.UserNodeProgress.user_id == current_user.id
        ).all()
    }
    completed_node_ids = {nid for nid, p in progress_map.items() if p.completed}

    result = []
    for node in nodes:
        node_progress = progress_map.get(node.id)
        completed = node_progress.completed if node_progress else False
        user_score = node_progress.score if node_progress else 0

        if is_privileged:
            # Admins and organizers always see nodes as unlocked for management/testing
            unlocked = True
        else:
            # Must satisfy both: prerequisite completed AND node released
            prereq_ok = (
                node.prerequisite_node_id is None or
                node.prerequisite_node_id in completed_node_ids
            )
            release_ok = _node_is_effectively_released(node)
            unlocked = prereq_ok and release_ok

        ref_id = node.reference_id

        result.append(
            schemas.TrainingNodeGraphOut(
                id=node.id,
                name=node.name,
                type=node.type,
                reference_id=ref_id,
                activity_id=node.activity_id,
                eixo=node.eixo,
                prerequisite_node_id=node.prerequisite_node_id,
                x_pos=node.x_pos,
                y_pos=node.y_pos,
                order_index=node.order_index,
                questions=node.questions,
                completed=completed,
                unlocked=unlocked,
                user_score=user_score,
                is_released=node.is_released,
                released_at=node.released_at,
                deadline=node.deadline,
                released_by=node.released_by,
            )
        )

    return result


@app.patch("/api/nodes/{node_id}/release", response_model=schemas.TrainingNodeGraphOut)
def release_node(
    node_id: str,
    release_data: schemas.NodeReleaseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    """
    Libera ou bloqueia um nó da trilha. Apenas admin e organizador (admPlugInfo) podem chamar este endpoint.
    - is_released=True + released_at=None → libera imediatamente
    - is_released=True + released_at=<futuro> → agenda liberação para a data/hora especificada
    - is_released=False → bloqueia novamente
    """
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó não encontrado")

    node.is_released = release_data.is_released
    node.released_at = release_data.released_at
    node.released_by = current_user.id if release_data.is_released else None

    db.commit()
    db.refresh(node)

    # Return with graph-out format (no progress for this call, just node state)
    return schemas.TrainingNodeGraphOut(
        id=node.id,
        name=node.name,
        type=node.type,
        reference_id=node.reference_id,
        eixo=node.eixo,
        prerequisite_node_id=node.prerequisite_node_id,
        x_pos=node.x_pos,
        y_pos=node.y_pos,
        order_index=node.order_index,
        questions=node.questions,
        completed=False,
        unlocked=True,  # privileged view
        user_score=0,
        is_released=node.is_released,
        released_at=node.released_at,
        released_by=node.released_by,
    )


@app.post("/api/nodes/{node_id}/complete")
def complete_material_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó de treinamento não encontrado")

    if node.type != "material":
        raise HTTPException(status_code=400, detail="Este nó é um jogo, use o endpoint submit-game")

    is_privileged = current_user.type in ["admin", "organizador"]

    # Check prerequisite
    if node.prerequisite_node_id and not is_privileged:
        prereq_progress = db.query(models.UserNodeProgress).filter(
            models.UserNodeProgress.user_id == current_user.id,
            models.UserNodeProgress.node_id == node.prerequisite_node_id,
            models.UserNodeProgress.completed == True
        ).first()
        if not prereq_progress:
            raise HTTPException(status_code=400, detail="Você precisa concluir o pré-requisito antes.")

    # Check release
    if not is_privileged and not _node_is_effectively_released(node):
        raise HTTPException(status_code=403, detail="Este nó ainda não foi liberado.")

    progress = db.query(models.UserNodeProgress).filter(
        models.UserNodeProgress.user_id == current_user.id,
        models.UserNodeProgress.node_id == node_id
    ).first()

    if not progress:
        progress = models.UserNodeProgress(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            node_id=node_id,
            completed=True,
            score=0,
            completed_at=datetime.utcnow()
        )
        db.add(progress)
        current_user.pontos_acumulados += 50
    else:
        if not progress.completed:
            progress.completed = True
            progress.completed_at = datetime.utcnow()
            current_user.pontos_acumulados += 50

    db.commit()
    return {"detail": "Nó marcado como concluído", "score_earned": 50}

@app.post("/api/nodes/{node_id}/submit-game")
def submit_game_score(
    node_id: str,
    submit_req: schemas.GameSubmitRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó de treinamento não encontrado")

    if node.type != "game":
        raise HTTPException(status_code=400, detail="Este nó não é um jogo")

    is_privileged = current_user.type in ["admin", "organizador"]

    # Check prerequisite
    if node.prerequisite_node_id and not is_privileged:
        prereq_progress = db.query(models.UserNodeProgress).filter(
            models.UserNodeProgress.user_id == current_user.id,
            models.UserNodeProgress.node_id == node.prerequisite_node_id,
            models.UserNodeProgress.completed == True
        ).first()
        if not prereq_progress:
            raise HTTPException(status_code=400, detail="Você precisa concluir o pré-requisito antes.")

    # Check release
    if not is_privileged and not _node_is_effectively_released(node):
        raise HTTPException(status_code=403, detail="Este nó ainda não foi liberado.")

    progress = db.query(models.UserNodeProgress).filter(
        models.UserNodeProgress.user_id == current_user.id,
        models.UserNodeProgress.node_id == node_id
    ).first()

    score_added = 0
    if not progress:
        progress = models.UserNodeProgress(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            node_id=node_id,
            completed=True,
            score=submit_req.score,
            completed_at=datetime.utcnow()
        )
        db.add(progress)
        score_added = submit_req.score
        current_user.pontos_acumulados += score_added
    else:
        if submit_req.score > progress.score:
            score_added = submit_req.score - progress.score
            current_user.pontos_acumulados += score_added
            progress.score = submit_req.score

        if not progress.completed:
            progress.completed = True
            progress.completed_at = datetime.utcnow()

    db.commit()
    return {
        "detail": "Pontuação registrada com sucesso",
        "score_added": score_added,
        "total_score": progress.score,
        "user_total_points": current_user.pontos_acumulados
    }

@app.get("/api/leaderboard", response_model=List[schemas.LeaderboardEntry])
def get_leaderboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    users = db.query(models.User).filter(
        models.User.type.in_(["trainee", "membro"])
    ).order_by(models.User.pontos_acumulados.desc()).all()
    return users


# --- Activity Endpoints ---

def _activity_is_effectively_open(activity: models.Activity) -> bool:
    """Returns True if the activity is currently open (manual flag AND deadline not passed)."""
    if not activity.is_open:
        return False
    if activity.deadline is None:
        return True
    now = datetime.now(timezone.utc)
    deadline = activity.deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    return deadline > now


@app.get("/api/activities", response_model=List[schemas.ActivityOut])
def get_activities(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    is_privileged = current_user.type in ["admin", "organizador"]

    # Determine which eixos this user can see
    if current_user.type == "trainee":
        allowed_eixos = ["trainee", "all"]
    elif current_user.type == "membro":
        allowed_eixos = ["vendas", "conexoes", "experiencia", "all"]
    elif current_user.type == "organizador":
        allowed_eixos = ["pluginfo", "trainee", "all"]
    else:
        allowed_eixos = None  # admin sees everything

    if allowed_eixos is not None:
        activities = db.query(models.Activity).filter(
            models.Activity.eixo.in_(allowed_eixos)
        ).order_by(models.Activity.created_at.desc()).all()
    else:
        activities = db.query(models.Activity).order_by(
            models.Activity.created_at.desc()
        ).all()

    result = []
    for act in activities:
        effective_open = _activity_is_effectively_open(act)
        submission_count = len(act.submissions)

        # Find this user's own submission (if not privileged)
        my_submission = None
        if not is_privileged:
            sub = next((s for s in act.submissions if s.user_id == current_user.id), None)
            if sub:
                my_submission = schemas.ActivitySubmissionOut(
                    id=sub.id,
                    activity_id=sub.activity_id,
                    user_id=sub.user_id,
                    file_url=sub.file_url,
                    comment=sub.comment,
                    submitted_at=sub.submitted_at,
                    grade=sub.grade,
                    feedback=sub.feedback,
                    user_name=current_user.name
                )

        result.append(schemas.ActivityOut(
            id=act.id,
            title=act.title,
            description=act.description,
            eixo=act.eixo,
            accepts_file=act.accepts_file,
            deadline=act.deadline,
            is_open=act.is_open,
            weight=getattr(act, "weight", 1.0) or 1.0,
            created_by=act.created_by,
            created_at=act.created_at,
            material_id=act.material_id,
            effective_open=effective_open,
            submission_count=submission_count,
            my_submission=my_submission
        ))

    return result


@app.post("/api/activities", response_model=schemas.ActivityOut)
def create_activity(
    activity_in: schemas.ActivityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    new_activity = models.Activity(
        id=str(uuid.uuid4()),
        title=activity_in.title,
        description=activity_in.description or "",
        eixo=activity_in.eixo,
        accepts_file=activity_in.accepts_file,
        deadline=activity_in.deadline,
        material_id=activity_in.material_id,
        weight=activity_in.weight if activity_in.weight is not None else 1.0,
        is_open=True,
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_activity)
    db.commit()
    db.refresh(new_activity)

    return schemas.ActivityOut(
        id=new_activity.id,
        title=new_activity.title,
        description=new_activity.description,
        eixo=new_activity.eixo,
        accepts_file=new_activity.accepts_file,
        deadline=new_activity.deadline,
        is_open=new_activity.is_open,
        weight=new_activity.weight,
        created_by=new_activity.created_by,
        created_at=new_activity.created_at,
        material_id=new_activity.material_id,
        effective_open=True,
        submission_count=0,
        my_submission=None
    )


@app.patch("/api/activities/{activity_id}", response_model=schemas.ActivityOut)
def update_activity(
    activity_id: str,
    update_data: schemas.ActivityUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    if update_data.is_open is not None:
        activity.is_open = update_data.is_open
    if update_data.deadline is not None:
        activity.deadline = update_data.deadline
    if update_data.title is not None:
        activity.title = update_data.title
    if update_data.description is not None:
        activity.description = update_data.description
    if update_data.accepts_file is not None:
        activity.accepts_file = update_data.accepts_file
    if update_data.material_id is not None:
        activity.material_id = update_data.material_id
    if update_data.weight is not None:
        activity.weight = update_data.weight

    db.commit()
    db.refresh(activity)

    effective_open = _activity_is_effectively_open(activity)
    submission_count = len(activity.submissions)

    return schemas.ActivityOut(
        id=activity.id,
        title=activity.title,
        description=activity.description,
        eixo=activity.eixo,
        accepts_file=activity.accepts_file,
        deadline=activity.deadline,
        is_open=activity.is_open,
        weight=activity.weight or 1.0,
        created_by=activity.created_by,
        created_at=activity.created_at,
        material_id=activity.material_id,
        effective_open=effective_open,
        submission_count=submission_count,
        my_submission=None
    )


@app.delete("/api/activities/{activity_id}")
def delete_activity(
    activity_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    db.delete(activity)
    db.commit()
    return {"detail": "Atividade deletada com sucesso"}


@app.get("/api/activities/{activity_id}/submissions", response_model=List[schemas.ActivitySubmissionOut])
def get_activity_submissions(
    activity_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    result = []
    for sub in activity.submissions:
        user = db.query(models.User).filter(models.User.id == sub.user_id).first()
        result.append(schemas.ActivitySubmissionOut(
            id=sub.id,
            activity_id=sub.activity_id,
            user_id=sub.user_id,
            file_url=sub.file_url,
            comment=sub.comment,
            submitted_at=sub.submitted_at,
            grade=sub.grade,
            feedback=sub.feedback,
            user_name=user.name if user else None
        ))
    return result


@app.post("/api/activities/{activity_id}/submit", response_model=schemas.ActivitySubmissionOut)
def submit_activity(
    activity_id: str,
    submission_in: schemas.SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    if not _activity_is_effectively_open(activity):
        raise HTTPException(status_code=400, detail="Esta atividade está fechada e não aceita mais envios")

    if activity.accepts_file and not submission_in.file_url:
        raise HTTPException(status_code=400, detail="Esta atividade exige o envio de um arquivo (URL)")

    # Check if already submitted — update if so
    existing = db.query(models.ActivitySubmission).filter(
        models.ActivitySubmission.activity_id == activity_id,
        models.ActivitySubmission.user_id == current_user.id
    ).first()

    if existing:
        existing.file_url = submission_in.file_url
        existing.comment = submission_in.comment or ""
        existing.submitted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return schemas.ActivitySubmissionOut(
            id=existing.id,
            activity_id=existing.activity_id,
            user_id=existing.user_id,
            file_url=existing.file_url,
            comment=existing.comment,
            submitted_at=existing.submitted_at,
            grade=existing.grade,
            feedback=existing.feedback,
            user_name=current_user.name
        )

    new_submission = models.ActivitySubmission(
        id=str(uuid.uuid4()),
        activity_id=activity_id,
        user_id=current_user.id,
        file_url=submission_in.file_url,
        comment=submission_in.comment or "",
        submitted_at=datetime.now(timezone.utc)
    )
    db.add(new_submission)
    db.commit()
    db.refresh(new_submission)

    return schemas.ActivitySubmissionOut(
        id=new_submission.id,
        activity_id=new_submission.activity_id,
        user_id=new_submission.user_id,
        file_url=new_submission.file_url,
        comment=new_submission.comment,
        submitted_at=new_submission.submitted_at,
        grade=new_submission.grade,
        feedback=new_submission.feedback,
        user_name=current_user.name
    )


@app.patch("/api/activities/{activity_id}/submissions/{submission_id}", response_model=schemas.ActivitySubmissionOut)
def grade_submission(
    activity_id: str,
    submission_id: str,
    grade_data: schemas.SubmissionGrade,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    submission = db.query(models.ActivitySubmission).filter(
        models.ActivitySubmission.id == submission_id,
        models.ActivitySubmission.activity_id == activity_id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submissão não encontrada")

    submission.grade = grade_data.grade
    submission.feedback = grade_data.feedback or ""
    db.commit()
    db.refresh(submission)

    user = db.query(models.User).filter(models.User.id == submission.user_id).first()
    return schemas.ActivitySubmissionOut(
        id=submission.id,
        activity_id=submission.activity_id,
        user_id=submission.user_id,
        file_url=submission.file_url,
        comment=submission.comment,
        submitted_at=submission.submitted_at,
        grade=submission.grade,
        feedback=submission.feedback,
        user_name=user.name if user else None
    )



# --- Node Order Endpoint ---

@app.patch("/api/nodes/{node_id}/order", response_model=schemas.TrainingNodeGraphOut)
def update_node_order(
    node_id: str,
    order_data: schemas.NodeOrderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó não encontrado")
    node.order_index = order_data.order_index
    db.commit()
    db.refresh(node)
    return schemas.TrainingNodeGraphOut(
        id=node.id, name=node.name, type=node.type, reference_id=node.reference_id,
        eixo=node.eixo, prerequisite_node_id=node.prerequisite_node_id,
        x_pos=node.x_pos, y_pos=node.y_pos, order_index=node.order_index,
        questions=node.questions, completed=False, unlocked=True, user_score=0,
        is_released=node.is_released, released_at=node.released_at, released_by=node.released_by,
    )


# --- User Profile Endpoint (admin/organizador only) ---

@app.get("/api/users/{user_id}/profile", response_model=schemas.UserProfileOut)
def get_user_profile(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Node progress
    progress_list = db.query(models.UserNodeProgress).filter(
        models.UserNodeProgress.user_id == user_id
    ).all()
    node_progress = []
    for p in progress_list:
        node = db.query(models.TrainingNode).filter(models.TrainingNode.id == p.node_id).first()
        if node:
            node_progress.append(schemas.NodeProgressOut(
                node_id=node.id, node_name=node.name, node_type=node.type,
                completed=p.completed, score=p.score, completed_at=p.completed_at
            ))

    # Activity submissions
    subs = db.query(models.ActivitySubmission).filter(
        models.ActivitySubmission.user_id == user_id
    ).all()
    activity_submissions = []
    for sub in subs:
        act = db.query(models.Activity).filter(models.Activity.id == sub.activity_id).first()
        activity_submissions.append(schemas.ActivitySubmissionOut(
            id=sub.id, activity_id=sub.activity_id, user_id=sub.user_id,
            file_url=sub.file_url, comment=sub.comment,
            submitted_at=sub.submitted_at, grade=sub.grade, feedback=sub.feedback,
            user_name=target.name
        ))

    return schemas.UserProfileOut(
        id=target.id, name=target.name, email=target.email, cargo=target.cargo,
        type=target.type, eixo=target.eixo, rotacao=target.rotacao,
        nota_rotacao=target.nota_rotacao, pontos_acumulados=target.pontos_acumulados,
        node_progress=node_progress, activity_submissions=activity_submissions
    )


# --- Grades Spreadsheet Endpoint ---

@app.get("/api/grades", response_model=List[schemas.GradeRow])
def get_grades(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin)
):
    if current_user.type == "organizador":
        users = db.query(models.User).filter(models.User.type == "trainee").all()
        # Get total trainee nodes
        total_nodes_map = {}
        for u in users:
            total_nodes_map[u.id] = db.query(models.TrainingNode).filter(
                models.TrainingNode.eixo == "trainee"
            ).count()
    else:
        users = db.query(models.User).filter(
            models.User.type.in_(["trainee", "membro"])
        ).all()
        total_nodes_map = {}
        for u in users:
            if u.type == "trainee":
                total_nodes_map[u.id] = db.query(models.TrainingNode).filter(
                    models.TrainingNode.eixo == "trainee"
                ).count()
            else:
                # membro: count nodes in their eixo
                eixo_key = (u.eixo or "").lower()
                for e in ["vendas", "conexoes", "experiencia"]:
                    if e in eixo_key:
                        total_nodes_map[u.id] = db.query(models.TrainingNode).filter(
                            models.TrainingNode.eixo == e
                        ).count()
                        break
                else:
                    total_nodes_map[u.id] = 0

    result = []
    for u in users:
        progress = db.query(models.UserNodeProgress).filter(
            models.UserNodeProgress.user_id == u.id,
            models.UserNodeProgress.completed == True
        ).count()
        subs = db.query(models.ActivitySubmission).filter(
            models.ActivitySubmission.user_id == u.id
        ).all()
        graded = [s for s in subs if s.grade is not None]
        avg_grade = sum(s.grade for s in graded) / len(graded) if graded else None

        result.append(schemas.GradeRow(
            id=u.id, name=u.name, email=u.email, cargo=u.cargo, type=u.type,
            eixo=u.eixo, rotacao=u.rotacao, nota_rotacao=u.nota_rotacao,
            pontos_acumulados=u.pontos_acumulados,
            nodes_completed=progress, nodes_total=total_nodes_map.get(u.id, 0),
            activities_submitted=len(subs), activities_graded=len(graded),
            avg_activity_grade=avg_grade
        ))

    return result
