"""Shared content visibility and authorization for lists and actions by ID."""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models
from app.services.roles import STAFF, manager_axis, normalize_axis


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
    if user.type == "gerente":
        # O gerente enxerga apenas o próprio eixo; sem eixo válido, nada.
        axis = manager_axis(user)
        return {axis} if axis else set()
    return None if user.type == "admin" else _EIXOS_BY_ROLE.get(user.type, set())


def allowed_activity_eixos(user: models.User) -> set[str] | None:
    return allowed_node_eixos(user)


def manageable_eixos(user: models.User) -> set[str] | None:
    """Axes the user may create or correct content in. None means every axis."""
    if user.type == "gerente":
        return allowed_node_eixos(user)
    return None if user.type == "admin" else _MANAGEABLE_EIXOS_BY_ROLE.get(user.type, set())


def allowed_material_types(user: models.User) -> set[str] | None:
    if user.type == "gerente":
        return {"membro"} if manager_axis(user) else set()
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
            detail="Você não pode gerenciar conteúdo deste eixo.",
        )


def ensure_activity_access(user: models.User, activity: models.Activity, *, manage: bool = False) -> None:
    if manage:
        ensure_node_eixo_access(user, activity.eixo)
    else:
        _ensure_eixo_visible(user, activity.eixo)


def ensure_material_type_access(user: models.User, material_type: str, *, manage: bool = False) -> None:
    if material_type not in MATERIAL_TYPES:
        raise HTTPException(status_code=422, detail="Tipo de material inválido.")
    if manage and user.type not in STAFF:
        raise HTTPException(status_code=403, detail="Você não pode gerenciar materiais.")
    allowed = allowed_material_types(user)
    if allowed is not None and material_type not in allowed:
        raise HTTPException(status_code=403, detail="Você não tem acesso a este material.")


def ensure_material_access(user: models.User, material, *, manage: bool = False) -> None:
    """Check a stored material or an incoming payload: both carry type and axis.

    The type alone does not isolate managers, since every member material has
    type "membro"; for them the axis must match as well.
    """
    ensure_material_type_access(user, material.type, manage=manage)
    if user.type == "gerente":
        ensure_node_eixo_access(user, material.eixo)


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
    if not require_unlocked or user.type in STAFF:
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




# ---------------------------------------------------------------------------
# People management
# ---------------------------------------------------------------------------

def can_manage_user(actor: models.User, target: models.User | None) -> bool:
    """Admin manages everyone; organizers, trainees; managers, members of their axis."""
    if target is None:
        return False
    if actor.type == "admin":
        return True
    if actor.type == "organizador":
        return target.type == "trainee"
    axis = manager_axis(actor)
    return axis is not None and target.type == "membro" and normalize_axis(target.eixo) == axis


def ensure_user_access(actor: models.User, target: models.User | None) -> None:
    if not can_manage_user(actor, target):
        raise HTTPException(status_code=403, detail="Você não pode gerenciar este usuário.")


def managed_users(db: Session, actor: models.User) -> list[models.User]:
    query = db.query(models.User)
    if actor.type == "organizador":
        query = query.filter(models.User.type == "trainee")
    elif actor.type == "gerente":
        # O eixo é comparado em Python: registros antigos guardam o nome de exibição
        # e o lower() do SQLite ignora letras acentuadas.
        query = query.filter(models.User.type == "membro")
    elif actor.type != "admin":
        return []
    return [user for user in query.all() if can_manage_user(actor, user)]


def managed_user_ids(db: Session, actor: models.User) -> set[str] | None:
    """IDs the actor may follow in queues and spreadsheets. None means everyone."""
    if actor.type == "admin":
        return None
    return {user.id for user in managed_users(db, actor)}


def validate_user_assignment(actor: models.User, *, role: str, eixo, current: models.User | None = None) -> str | None:
    """Validate the final role/axis of a user and return the axis to store.

    Runs before any write, so a refused request leaves the row untouched. Managers
    can only keep people as members of their own axis; naming managers is an
    administrator decision, as is moving someone between axes.
    """
    code = normalize_axis(eixo)
    if actor.type == "gerente":
        if role != "membro" or code != manager_axis(actor):
            raise HTTPException(
                status_code=403,
                detail="Gerentes só podem manter membros no próprio eixo. Promoções e transferências ficam com o administrador.",
            )
    if role == "gerente" and code is None:
        raise HTTPException(status_code=422, detail="Escolha o eixo do gerente: Vendas, Conexões ou Experiência do Consumidor.")
    if role == "membro" and code is None:
        # Um eixo antigo que já estava gravado continua como está até o administrador
        # corrigi-lo; um valor novo precisa ser um dos três eixos.
        if current is not None and current.type == "membro" and eixo == current.eixo:
            return current.eixo
        raise HTTPException(status_code=422, detail="Escolha o eixo do membro: Vendas, Conexões ou Experiência do Consumidor.")
    if role in {"membro", "gerente"}:
        return code
    return None


# ---------------------------------------------------------------------------
# Cross-axis containment
# ---------------------------------------------------------------------------

_SHARED_LINK = "Este conteúdo também é usado em outro eixo; peça ao administrador para alterá-lo."


def ensure_contained_in_axis(db: Session, actor: models.User, resource) -> None:
    """Refuse a manager's change whose effects would reach another axis.

    Content created through the API cannot be linked across axes, but older rows
    can share a material, activity or game with another trail. Changing them would
    alter a trail the manager does not administer, so that stays with the admin.
    """
    if actor.type != "gerente":
        return
    ensure_node_eixo_access(actor, resource.eixo)
    axis = manager_axis(actor)
    nodes = db.query(models.TrainingNode)
    if isinstance(resource, models.Material):
        for activity in db.query(models.Activity).filter(models.Activity.material_id == resource.id).all():
            if activity.eixo != axis:
                raise HTTPException(status_code=403, detail=_SHARED_LINK)
            ensure_contained_in_axis(db, actor, activity)
        nodes = nodes.filter(models.TrainingNode.reference_id == resource.id)
    elif isinstance(resource, models.Activity):
        nodes = nodes.filter(or_(models.TrainingNode.activity_id == resource.id,
                                 models.TrainingNode.reference_id == resource.id))
    elif isinstance(resource, models.Game):
        nodes = nodes.join(models.GameRevision).filter(models.GameRevision.game_id == resource.id)
    elif isinstance(resource, models.TrainingNode):
        nodes = nodes.filter(models.TrainingNode.prerequisite_node_id == resource.id)
    else:
        raise TypeError(f"Unsupported resource: {type(resource).__name__}")
    if any(node.eixo != axis for node in nodes.all()):
        raise HTTPException(status_code=403, detail=_SHARED_LINK)


def ensure_no_foreign_submissions(actor: models.User, activity: models.Activity) -> None:
    """Deleting or reweighting an activity changes every grade on it.

    Members see the trails of every member axis, so an activity can hold
    deliveries from people another manager follows.
    """
    if actor.type == "gerente" and any(not can_manage_user(actor, sub.user) for sub in activity.submissions):
        raise HTTPException(
            status_code=403,
            detail="Esta atividade tem entregas de pessoas de outro eixo; peça ao administrador para alterá-la.",
        )
