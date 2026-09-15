"""
api/nodes.py — Training node endpoints (/api/nodes/*)
"""

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, get_current_organizador_or_admin
from app.services import node_service, access
from app.services.game_service import revision_for_node

router = APIRouter()


@router.get("/", response_model=List[schemas.TrainingNodeGraphOut])
@router.get("", response_model=List[schemas.TrainingNodeGraphOut])
def get_training_nodes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return node_service.list_nodes_for_user(db, current_user)


@router.post("/", response_model=schemas.TrainingNodeGraphOut)
@router.post("", response_model=schemas.TrainingNodeGraphOut)
def create_training_node(
    node_in: schemas.TrainingNodeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    access.ensure_node_eixo_access(current_user, node_in.eixo)
    node_name = (node_in.name or "").strip()
    activity_id = node_in.activity_id or (
        node_in.reference_id if node_in.type == "activity" else None
    )
    reference_id = node_in.reference_id if node_in.type == "material" else None

    revision = None
    if node_in.game_revision_id:
        revision = revision_for_node(db, node_in.game_revision_id, node_in.eixo, current_user)

    act = None
    if activity_id:
        act = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
        if not act:
            raise HTTPException(status_code=404, detail="Atividade não encontrada")
        access.ensure_activity_access(current_user, act, manage=True)
        if act.eixo not in {node_in.eixo, "all"}:
            raise HTTPException(status_code=400, detail="A atividade deve pertencer ao eixo da etapa")
    if reference_id:
        material = db.query(models.Material).filter(models.Material.id == reference_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material não encontrado")
        access.ensure_material_access(current_user, material, manage=True)
        if material.eixo != node_in.eixo:
            raise HTTPException(status_code=400, detail="O material deve pertencer ao eixo da etapa")
    if node_in.prerequisite_node_id:
        prerequisite = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_in.prerequisite_node_id).first()
        if not prerequisite:
            raise HTTPException(status_code=404, detail="Pré-requisito não encontrado")
        access.ensure_node_access(db, prerequisite, current_user)
        if prerequisite.eixo != node_in.eixo:
            raise HTTPException(status_code=400, detail="O pré-requisito deve pertencer ao eixo da etapa")

    if not node_name:
        if act:
            node_name = act.title
        elif revision:
            node_name = revision.title
        elif node_in.type == "material" and reference_id:
            mat = db.query(models.Material).filter(
                models.Material.id == reference_id
            ).first()
            if mat:
                node_name = mat.name
        if not node_name:
            node_name = "Nó de Aprendizado"

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
        game_revision_id=node_in.game_revision_id,
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
            db.add(models.Option(
                id=str(uuid.uuid4()),
                question_id=question.id,
                text=o_in.text,
                is_correct=o_in.is_correct,
                score=o_in.score,
                feedback=o_in.feedback or "",
            ))

    db.commit()
    db.refresh(new_node)

    return node_service.node_to_out(new_node)


@router.delete("/{node_id}")
def delete_training_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó não encontrado")
    access.ensure_node_eixo_access(current_user, node.eixo)
    db.delete(node)
    db.commit()
    return {"detail": "Nó excluído com sucesso"}


@router.patch("/{node_id}/release", response_model=schemas.TrainingNodeGraphOut)
def release_node(
    node_id: str,
    release_data: schemas.NodeReleaseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó não encontrado")

    access.ensure_node_eixo_access(current_user, node.eixo)
    node.is_released = release_data.is_released
    node.released_at = release_data.released_at
    node.released_by = current_user.id if release_data.is_released else None

    db.commit()
    db.refresh(node)

    return node_service.node_to_out(node)


@router.post("/{node_id}/complete")
def complete_material_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.type not in {"membro", "trainee"}:
        raise HTTPException(status_code=403, detail="Somente membros e trainees registram progresso na trilha.")
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó de treinamento não encontrado")
    if node.type != "material":
        raise HTTPException(status_code=400, detail="Esta rota conclui apenas materiais; entregue a atividade ou responda o jogo")

    access.ensure_node_access(db, node, current_user, require_unlocked=True)

    return node_service.complete_material_node(db, node, current_user)


@router.post("/{node_id}/submit-game")
def submit_game_score(
    node_id: str,
    submit_req: schemas.GameSubmitRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.type not in {"membro", "trainee"}:
        raise HTTPException(status_code=403, detail="Use a pré-visualização para testar jogos sem alterar o progresso.")
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó de treinamento não encontrado")
    if node.type != "game":
        raise HTTPException(status_code=400, detail="Este nó não é um jogo")
    if node.game_revision_id:
        raise HTTPException(status_code=400, detail="Inicie uma tentativa para responder este jogo da biblioteca")

    access.ensure_node_access(db, node, current_user, require_unlocked=True)

    return node_service.submit_game_score(db, node, current_user, submit_req.answers)


@router.patch("/{node_id}/order", response_model=schemas.TrainingNodeGraphOut)
def update_node_order(
    node_id: str,
    order_data: schemas.NodeOrderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó não encontrado")
    access.ensure_node_eixo_access(current_user, node.eixo)
    node.order_index = order_data.order_index
    db.commit()
    db.refresh(node)
    return node_service.node_to_out(node)
