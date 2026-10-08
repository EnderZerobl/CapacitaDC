"""
api/gamification.py — Points, level, achievements and ranking, for members only.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.database import get_db
from app.services import gamification

router = APIRouter()


@router.get("")
def member_gamification(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.type != "membro":
        raise HTTPException(403, "A gamificação é exclusiva para membros.")
    return gamification.summary(db, current_user)
