"""
node_service.py — Business logic for training nodes.

All functions here are pure Python: no FastAPI, no HTTP.
This makes them trivially testable with pytest without starting a server.
"""

from datetime import datetime, timezone
from typing import List
from sqlalchemy.orm import Session

from app import models, schemas


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def is_effectively_released(node: models.TrainingNode) -> bool:
    """
    Returns True if the node is considered released right now.
    Admin/Organizador bypass checks are handled at the router level.
    """
    if not node.is_released:
        return False
    if node.released_at is None:
        return True  # Released immediately (no scheduled date)
    now = datetime.now(timezone.utc)
    released_at = node.released_at
    if released_at.tzinfo is None:
        released_at = released_at.replace(tzinfo=timezone.utc)
    return released_at <= now


# ---------------------------------------------------------------------------
# Query / listing
# ---------------------------------------------------------------------------

def list_nodes_for_user(
    db: Session,
    current_user: models.User,
) -> List[schemas.TrainingNodeGraphOut]:
    """Return nodes visible to the current user, with progress and unlock state."""
    is_privileged = current_user.type in ["admin", "organizador"]

    if current_user.type == "trainee":
        nodes = db.query(models.TrainingNode).filter(
            models.TrainingNode.eixo == "trainee"
        ).all()
    elif current_user.type == "membro":
        nodes = db.query(models.TrainingNode).filter(
            models.TrainingNode.eixo.in_(["vendas", "conexoes", "experiencia"])
        ).all()
    else:
        nodes = db.query(models.TrainingNode).all()

    progress_map = {
        p.node_id: p
        for p in db.query(models.UserNodeProgress).filter(
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
            unlocked = True
        else:
            prereq_ok = (
                node.prerequisite_node_id is None
                or node.prerequisite_node_id in completed_node_ids
            )
            release_ok = is_effectively_released(node)
            unlocked = prereq_ok and release_ok

        result.append(
            schemas.TrainingNodeGraphOut(
                id=node.id,
                name=node.name,
                type=node.type,
                reference_id=node.reference_id,
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


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------

def complete_material_node(
    db: Session,
    node: models.TrainingNode,
    current_user: models.User,
) -> dict:
    """Mark a material node as complete and award 50 points (idempotent)."""
    progress = db.query(models.UserNodeProgress).filter(
        models.UserNodeProgress.user_id == current_user.id,
        models.UserNodeProgress.node_id == node.id,
    ).first()

    if not progress:
        progress = models.UserNodeProgress(
            id=__import__("uuid").uuid4().__str__(),
            user_id=current_user.id,
            node_id=node.id,
            completed=True,
            score=0,
            completed_at=datetime.utcnow(),
        )
        db.add(progress)
        current_user.pontos_acumulados += 50
        score_earned = 50
    else:
        score_earned = 0
        if not progress.completed:
            progress.completed = True
            progress.completed_at = datetime.utcnow()
            current_user.pontos_acumulados += 50
            score_earned = 50

    db.commit()
    return {"detail": "Nó marcado como concluído", "score_earned": score_earned}


def submit_game_score(
    db: Session,
    node: models.TrainingNode,
    current_user: models.User,
    score: int,
) -> dict:
    """Register or update a game score, awarding the delta in points."""
    import uuid as _uuid

    progress = db.query(models.UserNodeProgress).filter(
        models.UserNodeProgress.user_id == current_user.id,
        models.UserNodeProgress.node_id == node.id,
    ).first()

    score_added = 0
    if not progress:
        progress = models.UserNodeProgress(
            id=str(_uuid.uuid4()),
            user_id=current_user.id,
            node_id=node.id,
            completed=True,
            score=score,
            completed_at=datetime.utcnow(),
        )
        db.add(progress)
        score_added = score
        current_user.pontos_acumulados += score_added
    else:
        if score > progress.score:
            score_added = score - progress.score
            current_user.pontos_acumulados += score_added
            progress.score = score
        if not progress.completed:
            progress.completed = True
            progress.completed_at = datetime.utcnow()

    db.commit()
    return {
        "detail": "Pontuação registrada com sucesso",
        "score_added": score_added,
        "total_score": progress.score,
        "user_total_points": current_user.pontos_acumulados,
    }
