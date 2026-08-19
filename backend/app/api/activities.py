"""
api/activities.py — Activity & submission endpoints (/api/activities/*)
"""

import uuid
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, get_current_organizador_or_admin
from app.services.activity_service import is_effectively_open

router = APIRouter()


@router.get("/", response_model=List[schemas.ActivityOut])
def get_activities(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    is_privileged = current_user.type in ["admin", "organizador"]

    if current_user.type == "trainee":
        allowed_eixos = ["trainee", "all"]
    elif current_user.type == "membro":
        allowed_eixos = ["vendas", "conexoes", "experiencia", "all"]
    elif current_user.type == "organizador":
        allowed_eixos = ["pluginfo", "trainee", "all"]
    else:
        allowed_eixos = None

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
        effective_open = is_effectively_open(act)
        submission_count = len(act.submissions)

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
                    user_name=current_user.name,
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
            my_submission=my_submission,
        ))
    return result


@router.post("/", response_model=schemas.ActivityOut)
def create_activity(
    activity_in: schemas.ActivityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
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
        effective_open=True,
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
    db.delete(activity)
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
            user_name=user.name if user else None,
        ))
    return result


@router.post("/{activity_id}/submit", response_model=schemas.ActivitySubmissionOut)
def submit_activity(
    activity_id: str,
    submission_in: schemas.SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    if not is_effectively_open(activity):
        raise HTTPException(
            status_code=400, detail="Esta atividade está fechada e não aceita mais envios"
        )
    if activity.accepts_file and not submission_in.file_url:
        raise HTTPException(
            status_code=400, detail="Esta atividade exige o envio de um arquivo (URL)"
        )

    existing = db.query(models.ActivitySubmission).filter(
        models.ActivitySubmission.activity_id == activity_id,
        models.ActivitySubmission.user_id == current_user.id,
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
            user_name=current_user.name,
        )

    new_sub = models.ActivitySubmission(
        id=str(uuid.uuid4()),
        activity_id=activity_id,
        user_id=current_user.id,
        file_url=submission_in.file_url,
        comment=submission_in.comment or "",
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)

    return schemas.ActivitySubmissionOut(
        id=new_sub.id,
        activity_id=new_sub.activity_id,
        user_id=new_sub.user_id,
        file_url=new_sub.file_url,
        comment=new_sub.comment,
        submitted_at=new_sub.submitted_at,
        grade=new_sub.grade,
        feedback=new_sub.feedback,
        user_name=current_user.name,
    )


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
    submission = db.query(models.ActivitySubmission).filter(
        models.ActivitySubmission.id == submission_id,
        models.ActivitySubmission.activity_id == activity_id,
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
        user_name=user.name if user else None,
    )
