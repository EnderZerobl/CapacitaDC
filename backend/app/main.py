import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        "user": user,
        "must_change_password": user.must_change_password
    }

@app.get("/api/auth/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/api/auth/change-password")
def change_password(
    req: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter pelo menos 6 caracteres")
    
    current_user.password_hash = get_password_hash(req.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"detail": "Senha alterada com sucesso"}


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
    if user_in.cargo == "gerente":
        cargo_label = "Gerente"
    elif user_in.cargo == "membro":
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
        pontos_acumulados=0,
        must_change_password=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

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
    # Organizador can only create pluginfo materials
    if current_user.type == "organizador" and material_in.type != "pluginfo":
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem gerenciar conteúdos do PlugInfo."
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

    if current_user.type == "organizador" and (material.type != "pluginfo" or material_in.type != "pluginfo"):
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem gerenciar conteúdos do PlugInfo."
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

    if current_user.type == "organizador" and material.type != "pluginfo":
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem gerenciar conteúdos do PlugInfo."
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


@app.get("/api/nodes", response_model=List[schemas.TrainingNodeGraphOut])
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

        result.append(
            schemas.TrainingNodeGraphOut(
                id=node.id,
                name=node.name,
                type=node.type,
                reference_id=node.reference_id,
                eixo=node.eixo,
                prerequisite_node_id=node.prerequisite_node_id,
                x_pos=node.x_pos,
                y_pos=node.y_pos,
                questions=node.questions,
                completed=completed,
                unlocked=unlocked,
                user_score=user_score,
                is_released=node.is_released,
                released_at=node.released_at,
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
