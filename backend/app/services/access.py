"""Shared content visibility and authorization for lists and actions by ID."""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models


# PlugInfo é um papel (type="organizador"), não um eixo de conteúdo: quem organiza
# cria e administra o conteúdo dos trainees e não faz atividades.
CONTENT_EIXOS = {"trainee", "vendas", "conexoes", "experiencia", "all"}
MATERIAL_TYPES = {"trainee", "membro"}
_EIXOS_BY_ROLE = {
    "trainee": {"trainee", "all"},
    "membro": {"vendas", "conexoes", "experiencia", "all"},
    "organizador": {"trainee", "all"},
}
_MATERIAL_TYPES_BY_ROLE = {
    "trainee": {"trainee"},
    "membro": {"trainee", "membro"},
    "organizador": {"trainee"},
}
# Ver e gerenciar são conjuntos diferentes: o organizador enxerga o eixo "all",
# mas não pode criar nem corrigir nele.
_MANAGEABLE_EIXOS_BY_ROLE = {
    "organizador": {"trainee"},
}


def allowed_node_eixos(user: models.User) -> set[str] | None:
    return None if user.type == "admin" else _EIXOS_BY_ROLE.get(user.type, set())


def allowed_activity_eixos(user: models.User) -> set[str] | None:
    return allowed_node_eixos(user)


def manageable_eixos(user: models.User) -> set[str] | None:
    """Axes the user may create or correct content in. None means every axis."""
    return None if user.type == "admin" else _MANAGEABLE_EIXOS_BY_ROLE.get(user.type, set())


def allowed_material_types(user: models.User) -> set[str] | None:
    return None if user.type == "admin" else _MATERIAL_TYPES_BY_ROLE.get(user.type, set())


def _ensure_eixo_visible(user: models.User, eixo: str) -> None:
    allowed = allowed_node_eixos(user)
    if allowed is not None and eixo not in allowed:
        raise HTTPException(status_code=403, detail="Você não tem acesso a este conteúdo.")


def ensure_node_eixo_access(user: models.User, eixo: str) -> None:
    """Validate the destination axis for administrative content mutations."""
    if eixo not in CONTENT_EIXOS:
        raise HTTPException(status_code=422, detail="Eixo de conteúdo inválido.")
    allowed = manageable_eixos(user)
    if allowed is not None and eixo not in allowed:
        raise HTTPException(
            status_code=403,
            detail="Organizadores só podem gerenciar conteúdos dos trainees.",
        )


def ensure_activity_access(user: models.User, activity: models.Activity, *, manage: bool = False) -> None:
    if manage:
        ensure_node_eixo_access(user, activity.eixo)
    else:
        _ensure_eixo_visible(user, activity.eixo)


def ensure_material_type_access(user: models.User, material_type: str, *, manage: bool = False) -> None:
    if material_type not in MATERIAL_TYPES:
        raise HTTPException(status_code=422, detail="Tipo de material inválido.")
    if manage and user.type not in {"admin", "organizador"}:
        raise HTTPException(status_code=403, detail="Você não pode gerenciar materiais.")
    allowed = allowed_material_types(user)
    if allowed is not None and material_type not in allowed:
        raise HTTPException(status_code=403, detail="Você não tem acesso a este material.")


def ensure_material_access(user: models.User, material: models.Material, *, manage: bool = False) -> None:
    ensure_material_type_access(user, material.type, manage=manage)


def effective_prerequisite_id(db: Session, node: models.TrainingNode) -> str | None:
    """A trilha é uma sequência: a etapa anterior do mesmo eixo é o pré-requisito.

    Um pré-requisito escolhido à mão continua valendo e se sobrepõe ao implícito.
    Derivar da ordem faz a corrente se refazer sozinha ao reordenar as etapas.
    """
    if node.prerequisite_node_id:
        return node.prerequisite_node_id
    ordered = [
        row[0] for row in db.query(models.TrainingNode.id).filter(
            models.TrainingNode.eixo == node.eixo,
        ).order_by(models.TrainingNode.order_index, models.TrainingNode.id).all()
    ]
    position = ordered.index(node.id) if node.id in ordered else 0
    return ordered[position - 1] if position > 0 else None


def ensure_node_access(
    db: Session,
    node: models.TrainingNode,
    user: models.User,
    *,
    require_unlocked: bool = False,
) -> None:
    _ensure_eixo_visible(user, node.eixo)
    if not require_unlocked or user.type in {"admin", "organizador"}:
        return
    released_at = node.released_at
    if released_at is not None and released_at.tzinfo is None:
        released_at = released_at.replace(tzinfo=timezone.utc)
    if not node.is_released or (released_at and released_at > datetime.now(timezone.utc)):
        raise HTTPException(status_code=403, detail="Esta etapa ainda não foi liberada.")
    prerequisite_id = effective_prerequisite_id(db, node)
    if prerequisite_id:
        prerequisite = db.query(models.UserNodeProgress).filter(
            models.UserNodeProgress.user_id == user.id,
            models.UserNodeProgress.node_id == prerequisite_id,
            models.UserNodeProgress.completed.is_(True),
        ).first()
        if prerequisite is None:
            raise HTTPException(status_code=403, detail="Conclua a etapa anterior para continuar.")
