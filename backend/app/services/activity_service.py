"""
activity_service.py — Business logic for activities and submissions.
"""

from datetime import datetime, timezone
from app import models


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
