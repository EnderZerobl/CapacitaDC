"""
api/activities.py — Activity & submission endpoints (/api/activities/*)
"""

import uuid
from typing import List
from datetime import datetime, timezone
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, get_current_organizador_or_admin
from app.services import blob_storage
from app.services.node_service import blocked_content_ids
from app.services.activity_service import (
    activity_weight, graded_user_ids, is_effectively_open,
    recompute_user_grade, recompute_users_grades, submission_to_out,
)
from app.services.access import (
    allowed_activity_eixos,
    ensure_activity_access,
    ensure_material_access,
    ensure_node_access,
    ensure_node_eixo_access,
)

router = APIRouter()

SUBMISSION_BLOB_PREFIX = "submissions"
MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024
ATTACHMENT_EXTENSIONS = {"pdf", "doc", "docx", "odt", "xls", "xlsx", "ods", "ppt", "pptx", "odp", "png", "jpg", "jpeg", "gif", "webp", "zip", "txt", "csv"}


def _submission_activity(db, activity_id, user, node_id=None):
    if user.type not in {"membro", "trainee"}:
        raise HTTPException(403, "Somente participantes podem enviar anexos.")
    activity = db.get(models.Activity, activity_id)
    if activity is None:
        raise HTTPException(404, "Atividade não encontrada")
    ensure_activity_access(user, activity)
    if not is_effectively_open(activity):
        raise HTTPException(400, "Esta atividade está fechada e não aceita mais envios")
    _submission_nodes(db, activity, user, node_id)
    return activity


@router.post("/{activity_id}/attachments", response_model=schemas.SubmissionAttachmentOut)
async def upload_submission_attachment(
    activity_id: str, file: UploadFile = File(...), node_id: str | None = Form(None),
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    _submission_activity(db, activity_id, current_user, node_id)
    name = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if extension not in ATTACHMENT_EXTENSIONS or len(name) > 200:
        raise HTTPException(400, "Formato não permitido. Envie PDF, documentos, planilhas, apresentações, imagens, TXT, CSV ou ZIP.")
    data = await file.read(MAX_ATTACHMENT_SIZE + 1)
    if len(data) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(413, "O arquivo excede o limite de 20 MB.")
    if not data:
        raise HTTPException(400, "O arquivo está vazio.")
    attachment = models.SubmissionAttachment(id=str(uuid.uuid4()), activity_id=activity_id,
        user_id=current_user.id, name=name, size=len(data),
        storage_key=f"{SUBMISSION_BLOB_PREFIX}/{uuid.uuid4().hex}.{extension}")
    try:
        attachment.storage_key = blob_storage.upload(attachment.storage_key, data)
        db.add(attachment)
        db.commit()
        db.refresh(attachment)
    except Exception:
        db.rollback()
        blob_storage.delete(attachment.storage_key)
        raise
    return attachment


@router.get("/{activity_id}/attachments/{attachment_id}")
def download_submission_attachment(
    activity_id: str, attachment_id: str,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    attachment = db.get(models.SubmissionAttachment, attachment_id)
    if attachment is None or attachment.activity_id != activity_id:
        raise HTTPException(404, "Anexo não encontrado")
    activity = db.get(models.Activity, activity_id)
    if current_user.id != attachment.user_id:
        if current_user.type not in {"admin", "organizador"} or not attachment.submission_id:
            raise HTTPException(403, "Você não tem acesso a este anexo.")
        ensure_activity_access(current_user, activity, manage=True)
        owner = db.get(models.User, attachment.user_id)
        if current_user.type == "organizador" and owner.type != "trainee":
            raise HTTPException(403, "Você não tem acesso a este anexo.")
    data = blob_storage.download(attachment.storage_key)
    if data is None:
        raise HTTPException(404, "Arquivo não encontrado")
    safe_name = attachment.name.replace('"', "'")
    return Response(content=data, media_type="application/octet-stream", headers={
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Disposition": f"attachment; filename=\"{safe_name}\"; filename*=UTF-8''{quote(attachment.name)}",
    })



def _validate_material_link(db: Session, user: models.User, material_id: str | None) -> None:
    if material_id is None:
        return
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if material is None:
        raise HTTPException(status_code=404, detail="Material não encontrado")
    ensure_material_access(user, material)


def _submission_nodes(
    db: Session,
    activity: models.Activity,
    user: models.User,
    node_id: str | None,
) -> list[models.TrainingNode]:
    """Enforce trail gates even when an older client sends no explicit node ID."""
    if node_id:
        node = db.query(models.TrainingNode).filter(models.TrainingNode.id == node_id).first()
        if node is None:
            raise HTTPException(status_code=404, detail="Etapa não encontrada")
        if node.type != "activity" or node.activity_id != activity.id:
            raise HTTPException(status_code=400, detail="Esta etapa não pertence à atividade enviada.")
        ensure_node_access(db, node, user, require_unlocked=True)
        return [node]

    linked = db.query(models.TrainingNode).filter(
        models.TrainingNode.type == "activity",
        models.TrainingNode.activity_id == activity.id,
    ).all()
    available = []
    for node in linked:
        try:
            ensure_node_access(db, node, user, require_unlocked=True)
        except HTTPException as exc:
            if exc.status_code != 403:
                raise
        else:
            available.append(node)
    if linked and not available:
        raise HTTPException(status_code=403, detail="A etapa desta atividade ainda não está disponível para você.")
    return available


def _complete_activity_nodes(db: Session, nodes: list[models.TrainingNode], user: models.User) -> None:
    # The accepted delivery is the completion criterion. This does not award
    # extra points or carry an assessor's grade over to the trail score.
    for node in nodes:
        progress = db.query(models.UserNodeProgress).filter(
            models.UserNodeProgress.user_id == user.id,
            models.UserNodeProgress.node_id == node.id,
        ).first()
        if progress is None:
            progress = models.UserNodeProgress(
                id=str(uuid.uuid4()), user_id=user.id, node_id=node.id, score=0,
            )
            db.add(progress)
        if not progress.completed:
            progress.completed = True
            progress.completed_at = datetime.now(timezone.utc)


@router.get("", response_model=List[schemas.ActivityOut])
@router.get("/", response_model=List[schemas.ActivityOut], include_in_schema=False)
def get_activities(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    is_privileged = current_user.type in ["admin", "organizador"]

    allowed_eixos = allowed_activity_eixos(current_user)

    if allowed_eixos is not None:
        activities = db.query(models.Activity).filter(
            models.Activity.eixo.in_(allowed_eixos)
        ).order_by(models.Activity.created_at.desc()).all()
    else:
        activities = db.query(models.Activity).order_by(
            models.Activity.created_at.desc()
        ).all()

    _, blocked_activities = blocked_content_ids(db, current_user)
    result = []
    for act in activities:
        if act.id in blocked_activities:
            continue
        effective_open = is_effectively_open(act)
        submission_count = len(act.submissions)

        my_submission = None
        if not is_privileged:
            sub = next((s for s in act.submissions if s.user_id == current_user.id), None)
            if sub:
                my_submission = submission_to_out(sub, user=current_user, activity=act)

        result.append(schemas.ActivityOut(
            id=act.id,
            title=act.title,
            description=act.description,
            eixo=act.eixo,
            accepts_file=act.accepts_file,
            deadline=act.deadline,
            is_open=act.is_open,
            weight=activity_weight(act),
            created_by=act.created_by,
            created_at=act.created_at,
            material_id=act.material_id,
            effective_open=effective_open,
            submission_count=submission_count,
            my_submission=my_submission,
        ))
    return result


@router.post("", response_model=schemas.ActivityOut)
@router.post("/", response_model=schemas.ActivityOut, include_in_schema=False)
def create_activity(
    activity_in: schemas.ActivityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    ensure_node_eixo_access(current_user, activity_in.eixo)
    _validate_material_link(db, current_user, activity_in.material_id)
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
        created_at=datetime.now(timezone.utc),
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
        effective_open=is_effectively_open(new_activity),
        submission_count=0,
        my_submission=None,
    )


@router.patch("/{activity_id}", response_model=schemas.ActivityOut)
def update_activity(
    activity_id: str,
    update_data: schemas.ActivityUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    ensure_activity_access(current_user, activity, manage=True)
    if "material_id" in update_data.model_fields_set:
        _validate_material_link(db, current_user, update_data.material_id)

    if update_data.is_open is not None:
        activity.is_open = update_data.is_open
    if "deadline" in update_data.model_fields_set:
        activity.deadline = update_data.deadline
    if update_data.title is not None:
        activity.title = update_data.title
    if update_data.description is not None:
        activity.description = update_data.description
    if update_data.accepts_file is not None:
        activity.accepts_file = update_data.accepts_file
    if "material_id" in update_data.model_fields_set:
        activity.material_id = update_data.material_id
    reweighted = update_data.weight is not None and update_data.weight != activity.weight
    affected = graded_user_ids(db, activity.id) if reweighted else []
    if update_data.weight is not None:
        activity.weight = update_data.weight

    recompute_users_grades(db, affected)
    db.commit()
    db.refresh(activity)

    return schemas.ActivityOut(
        id=activity.id,
        title=activity.title,
        description=activity.description,
        eixo=activity.eixo,
        accepts_file=activity.accepts_file,
        deadline=activity.deadline,
        is_open=activity.is_open,
        weight=activity_weight(activity),
        created_by=activity.created_by,
        created_at=activity.created_at,
        material_id=activity.material_id,
        effective_open=is_effectively_open(activity),
        submission_count=len(activity.submissions),
        my_submission=None,
    )


@router.delete("/{activity_id}")
def delete_activity(
    activity_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    ensure_activity_access(current_user, activity, manage=True)
    affected = graded_user_ids(db, activity.id)
    db.delete(activity)
    db.commit()
    recompute_users_grades(db, affected)
    db.commit()
    return {"detail": "Atividade deletada com sucesso"}


@router.get("/{activity_id}/submissions", response_model=List[schemas.ActivitySubmissionOut])
def get_activity_submissions(
    activity_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    ensure_activity_access(current_user, activity, manage=True)

    return [submission_to_out(sub, activity=activity) for sub in activity.submissions
            if sub.user and (current_user.type == "admin" or sub.user.type == "trainee")]


@router.post("/{activity_id}/submit", response_model=schemas.ActivitySubmissionOut)
def submit_activity(
    activity_id: str,
    submission_in: schemas.SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.type not in {"membro", "trainee"}:
        raise HTTPException(status_code=403, detail="Somente membros e trainees entregam atividades. Organizadores e administradores fazem a gestão e a correção.")
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    ensure_activity_access(current_user, activity)
    if not is_effectively_open(activity):
        raise HTTPException(
            status_code=400, detail="Esta atividade está fechada e não aceita mais envios"
        )
    file_url = (submission_in.file_url or "").strip() or None
    comment = (submission_in.comment or "").strip()
    attachment_ids = submission_in.attachment_ids
    attachments = db.query(models.SubmissionAttachment).filter(models.SubmissionAttachment.id.in_(attachment_ids)).all() if attachment_ids else []
    if len(attachments) != len(attachment_ids) or any(a.user_id != current_user.id or a.activity_id != activity_id for a in attachments):
        raise HTTPException(400, "Um dos anexos não pertence a este envio.")
    links = submission_in.links
    if activity.accepts_file and not attachments:
        raise HTTPException(
            status_code=400, detail="Esta atividade exige pelo menos um anexo."
        )
    if not attachments and not links and not file_url and not comment:
        raise HTTPException(status_code=400, detail="Inclua um anexo, link ou comentário para entregar a atividade.")

    nodes = _submission_nodes(db, activity, current_user, getattr(submission_in, "node_id", None))

    # Serialize deliveries for the same user, including the first submission and
    # progress record, so concurrent retries cannot create duplicates.
    current_user = db.query(models.User).filter(
        models.User.id == current_user.id,
    ).populate_existing().with_for_update().one()
    existing = db.query(models.ActivitySubmission).filter(
        models.ActivitySubmission.activity_id == activity_id,
        models.ActivitySubmission.user_id == current_user.id,
    ).first()

    if existing is None:
        existing = models.ActivitySubmission(
            id=str(uuid.uuid4()), activity_id=activity_id, user_id=current_user.id,
        )
        db.add(existing)
    elif (existing.file_url != file_url or existing.comment != comment or (existing.links or []) != links
          or {a.id for a in existing.attachments} != set(attachment_ids)):
        existing.grade = None
        existing.feedback = ""
    existing.attachments = attachments
    existing.links = links
    existing.file_url = file_url
    existing.comment = comment
    existing.submitted_at = datetime.now(timezone.utc)
    _complete_activity_nodes(db, nodes, current_user)
    recompute_user_grade(db, current_user.id)
    db.commit()
    db.refresh(existing)

    return submission_to_out(existing, user=current_user, activity=activity)


@router.delete("/{activity_id}/submissions/{submission_id}")
def delete_submission(
    activity_id: str,
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    """Remove one delivery so the queue can be cleaned up (tests, duplicates, mistakes).

    The linked trail step goes back to not completed: with the delivery gone, a
    completed step would be a dead end the person could never resubmit into.
    """
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    ensure_activity_access(current_user, activity, manage=True)
    submission = db.query(models.ActivitySubmission).filter(
        models.ActivitySubmission.id == submission_id,
        models.ActivitySubmission.activity_id == activity_id,
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submissão não encontrada")
    if current_user.type == "organizador" and (not submission.user or submission.user.type != "trainee"):
        raise HTTPException(status_code=403, detail="Organizadores só podem excluir entregas de trainees.")

    user_id = submission.user_id
    for attachment in list(submission.attachments):
        blob_storage.delete(attachment.storage_key)
        db.delete(attachment)

    node_ids = [row[0] for row in db.query(models.TrainingNode.id).filter(
        models.TrainingNode.type == "activity",
        models.TrainingNode.activity_id == activity_id,
    ).all()]
    if node_ids:
        db.query(models.UserNodeProgress).filter(
            models.UserNodeProgress.user_id == user_id,
            models.UserNodeProgress.node_id.in_(node_ids),
        ).delete(synchronize_session=False)

    db.delete(submission)
    db.commit()
    recompute_user_grade(db, user_id)
    db.commit()
    return {"detail": "Envio excluído com sucesso"}


@router.patch(
    "/{activity_id}/submissions/{submission_id}",
    response_model=schemas.ActivitySubmissionOut,
)
def grade_submission(
    activity_id: str,
    submission_id: str,
    grade_data: schemas.SubmissionGrade,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if activity is None:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    ensure_activity_access(current_user, activity, manage=True)
    submission = db.query(models.ActivitySubmission).filter(
        models.ActivitySubmission.id == submission_id,
        models.ActivitySubmission.activity_id == activity_id,
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submissão não encontrada")
    if current_user.type == "organizador" and (not submission.user or submission.user.type != "trainee"):
        raise HTTPException(status_code=403, detail="Organizadores só podem corrigir entregas de trainees.")

    submission.grade = grade_data.grade
    submission.feedback = grade_data.feedback or ""
    # A média ponderada da pessoa deriva das notas: recalcular junto evita que a
    # planilha e o perfil mostrem um número velho até alguém recarregar.
    recompute_user_grade(db, submission.user_id)
    db.commit()
    db.refresh(submission)
    return submission_to_out(submission, activity=activity)
