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
from app.services import node_service

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
    node_name = (node_in.name or "").strip()
    activity_id = node_in.activity_id or (
        node_in.reference_id if node_in.type == "activity" else None
    )
    reference_id = node_in.reference_id if node_in.type == "material" else None

    act = None
    if activity_id:
        act = db.query(models.Activity).filter(models.Activity.id == activity_id).first()

    if not node_name:
        if act:
            node_name = act.title
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


@router.delete("/{node_id}")
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

    node.is_released = release_data.is_released
    node.released_at = release_data.released_at
    node.released_by = current_user.id if release_data.is_released else None

    db.commit()
    db.refresh(node)

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
        unlocked=True,
        user_score=0,
        is_released=node.is_released,
        released_at=node.released_at,
        released_by=node.released_by,
    )


@router.post("/{node_id}/complete")
def complete_material_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó de treinamento não encontrado")
    if node.type != "material":
        raise HTTPException(status_code=400, detail="Este nó é um jogo, use o endpoint submit-game")

    is_privileged = current_user.type in ["admin", "organizador"]

    if node.prerequisite_node_id and not is_privileged:
        prereq = db.query(models.UserNodeProgress).filter(
            models.UserNodeProgress.user_id == current_user.id,
            models.UserNodeProgress.node_id == node.prerequisite_node_id,
            models.UserNodeProgress.completed == True,
        ).first()
        if not prereq:
            raise HTTPException(
                status_code=400, detail="Você precisa concluir o pré-requisito antes."
            )

    if not is_privileged and not node_service.is_effectively_released(node):
        raise HTTPException(status_code=403, detail="Este nó ainda não foi liberado.")

    return node_service.complete_material_node(db, node, current_user)


@router.post("/{node_id}/submit-game")
def submit_game_score(
    node_id: str,
    submit_req: schemas.GameSubmitRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nó de treinamento não encontrado")
    if node.type != "game":
        raise HTTPException(status_code=400, detail="Este nó não é um jogo")

    is_privileged = current_user.type in ["admin", "organizador"]

    if node.prerequisite_node_id and not is_privileged:
        prereq = db.query(models.UserNodeProgress).filter(
            models.UserNodeProgress.user_id == current_user.id,
            models.UserNodeProgress.node_id == node.prerequisite_node_id,
            models.UserNodeProgress.completed == True,
        ).first()
        if not prereq:
            raise HTTPException(
                status_code=400, detail="Você precisa concluir o pré-requisito antes."
            )

    if not is_privileged and not node_service.is_effectively_released(node):
        raise HTTPException(status_code=403, detail="Este nó ainda não foi liberado.")

    return node_service.submit_game_score(db, node, current_user, submit_req.score)


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
    node.order_index = order_data.order_index
    db.commit()
    db.refresh(node)
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
        unlocked=True,
        user_score=0,
        is_released=node.is_released,
        released_at=node.released_at,
        released_by=node.released_by,
    )
