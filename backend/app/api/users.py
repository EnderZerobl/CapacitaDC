"""
api/users.py — User & member management endpoints (/api/users/*)
"""

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import (
    get_password_hash,
    get_current_member_or_above,
    get_current_organizador_or_admin,
)

router = APIRouter()


@router.get("/", response_model=List[schemas.UserOut])
def get_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_member_or_above),
):
    if current_user.type == "organizador":
        return db.query(models.User).filter(models.User.type == "trainee").all()
    return db.query(models.User).all()


@router.post("/", response_model=schemas.UserOut)
def create_member(
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    if current_user.type == "organizador" and user_in.type != "trainee":
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores do PlugInfo só podem cadastrar trainees.",
        )

    if db.query(models.User).filter(models.User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Este email já está cadastrado")

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
            "experiencia": "Experiência do Consumidor",
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
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if current_user.id == user.id:
        raise HTTPException(status_code=400, detail="Você não pode excluir a sua própria conta")
    if current_user.type == "organizador" and user.type != "trainee":
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores do PlugInfo só podem excluir trainees.",
        )

    db.query(models.UserNodeProgress).filter(
        models.UserNodeProgress.user_id == user_id
    ).delete()
    db.query(models.ActivitySubmission).filter(
        models.ActivitySubmission.user_id == user_id
    ).delete()
    db.delete(user)
    db.commit()
    return {"message": "Usuário excluído com sucesso"}


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: str,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if current_user.type == "organizador" and user.type != "trainee":
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores do PlugInfo só podem gerenciar trainees.",
        )
    if (
        current_user.type == "organizador"
        and user_update.type
        and user_update.type != "trainee"
    ):
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem manter o perfil como trainee.",
        )

    if user_update.name is not None:
        user.name = user_update.name
    if user_update.email is not None:
        other = db.query(models.User).filter(
            models.User.email == user_update.email, models.User.id != user_id
        ).first()
        if other:
            raise HTTPException(
                status_code=400, detail="Este email já está sendo utilizado por outro usuário"
            )
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


@router.put("/trainees/{trainee_id}", response_model=schemas.UserOut)
def update_trainee(
    trainee_id: str,
    trainee_update: schemas.TraineeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_member_or_above),
):
    trainee = db.query(models.User).filter(
        models.User.id == trainee_id, models.User.type == "trainee"
    ).first()
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


@router.get("/{user_id}/profile", response_model=schemas.UserProfileOut)
def get_user_profile(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    progress_list = db.query(models.UserNodeProgress).filter(
        models.UserNodeProgress.user_id == user_id
    ).all()
    node_progress = []
    for p in progress_list:
        node = db.query(models.TrainingNode).filter(
            models.TrainingNode.id == p.node_id
        ).first()
        if node:
            node_progress.append(
                schemas.NodeProgressOut(
                    node_id=node.id,
                    node_name=node.name,
                    node_type=node.type,
                    completed=p.completed,
                    score=p.score,
                    completed_at=p.completed_at,
                )
            )

    subs = db.query(models.ActivitySubmission).filter(
        models.ActivitySubmission.user_id == user_id
    ).all()
    activity_submissions = [
        schemas.ActivitySubmissionOut(
            id=sub.id,
            activity_id=sub.activity_id,
            user_id=sub.user_id,
            file_url=sub.file_url,
            comment=sub.comment,
            submitted_at=sub.submitted_at,
            grade=sub.grade,
            feedback=sub.feedback,
            user_name=target.name,
        )
        for sub in subs
    ]

    return schemas.UserProfileOut(
        id=target.id,
        name=target.name,
        email=target.email,
        cargo=target.cargo,
        type=target.type,
        eixo=target.eixo,
        rotacao=target.rotacao,
        nota_rotacao=target.nota_rotacao,
        pontos_acumulados=target.pontos_acumulados,
        node_progress=node_progress,
        activity_submissions=activity_submissions,
    )
