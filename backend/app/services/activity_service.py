"""
activity_service.py — Business logic for activities, submissions and grades.

The rotation grade is not typed by anyone: it is the weighted average of the
submissions already corrected, recomputed here whenever something can change it.
"""

from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app import models, schemas
from app.services.node_service import lock_user


def is_effectively_open(activity: models.Activity) -> bool:
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


# ---------------------------------------------------------------------------
# Weighted grade
# ---------------------------------------------------------------------------

def normalize_weight(value) -> float:
    """A missing weight counts as 1; a negative one cannot subtract from the average.

    Never written as `value or 1.0`: a deliberate weight of 0 must stay 0, meaning
    the activity gets corrected but does not influence the average.
    """
    if value is None:
        return 1.0
    return max(0.0, float(value))


def activity_weight(activity) -> float:
    return normalize_weight(getattr(activity, "weight", None))


def weighted_average(pairs: Iterable[tuple[float, float]]) -> float | None:
    """Average of (grade, weight) pairs, or None when there is nothing to average.

    None is not zero: someone with no corrected submission has no grade yet, and
    showing 0 would read as a failing mark.
    """
    total_weight = 0.0
    total = 0.0
    for grade, weight in pairs:
        total += grade * weight
        total_weight += weight
    if total_weight == 0:
        return None
    return round(total / total_weight, 2)


def graded_pairs(db: Session, user_id: str) -> list[tuple[float, float]]:
    rows = db.query(models.ActivitySubmission, models.Activity).join(
        models.Activity, models.Activity.id == models.ActivitySubmission.activity_id,
    ).filter(
        models.ActivitySubmission.user_id == user_id,
        models.ActivitySubmission.grade.isnot(None),
    ).all()
    return [(float(submission.grade), activity_weight(activity)) for submission, activity in rows]


def recompute_user_grade(db: Session, user_id: str) -> float | None:
    """Recompute and store one person's grade. The caller commits.

    Locks the row first: two people correcting the same person at the same time
    would otherwise both read the pre-other-grade set and drop one grade.
    """
    # A sessão do projeto não tem autoflush: sem esta descarga a consulta abaixo
    # leria o estado anterior à nota que acabou de ser atribuída.
    db.flush()
    user = lock_user(db, user_id)
    user.nota_rotacao = weighted_average(graded_pairs(db, user_id))
    return user.nota_rotacao


def recompute_users_grades(db: Session, user_ids: Iterable[str]) -> None:
    for user_id in sorted(set(user_ids)):
        recompute_user_grade(db, user_id)


def recompute_all_grades(db: Session) -> None:
    """Used by the migration backfill, so stored values cannot drift from the formula."""
    for (user_id,) in db.query(models.User.id).all():
        recompute_user_grade(db, user_id)


def graded_user_ids(db: Session, activity_id: str) -> list[str]:
    """Who has a grade on this activity — collect before deleting or reweighting it."""
    rows = db.query(models.ActivitySubmission.user_id).filter(
        models.ActivitySubmission.activity_id == activity_id,
        models.ActivitySubmission.grade.isnot(None),
    ).all()
    return [user_id for (user_id,) in rows]


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def submission_to_out(submission, *, user=None, activity=None) -> schemas.ActivitySubmissionOut:
    """One contract for every submission response, so no caller forgets a field."""
    result = schemas.ActivitySubmissionOut.model_validate(submission)
    person = user if user is not None else submission.user
    if person is not None:
        result.user_name = person.name
        result.user_type = person.type
    subject = activity if activity is not None else submission.activity
    if subject is not None:
        result.activity_title = subject.title
        result.activity_weight = activity_weight(subject)
        result.activity_eixo = subject.eixo
    return result
