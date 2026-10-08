"""Member-only gamification derived from grades: points, level, achievements and ranking.

Nothing is stored. Every value is recomputed from game progress and corrected
deliveries, so a correction or a better retry shows up on the next request.
"""

from collections import defaultdict

from sqlalchemy.orm import Session

from app import models
from app.services.access import is_required_step
from app.services.assessment_service import MIN_PASSING_GRADE, effective_grade, normalized_grade
from app.services.roles import normalize_axis

POINTS_PER_GRADE_POINT = 10  # Grade 0–10 becomes 0–100 points per assessment.
LEVELS = [(0, "Iniciante"), (100, "Aprendiz"), (250, "Praticante"), (450, "Competente"),
          (700, "Avançado"), (1000, "Especialista"), (1400, "Mestre")]
CONSISTENT_TARGET = 5


def member_grades(db: Session) -> dict[str, list[float]]:
    """Best game grades and effective delivery grades of every member."""
    grades = defaultdict(list)
    games = db.query(models.UserNodeProgress.user_id, models.UserNodeProgress.grade).join(
        models.TrainingNode, models.TrainingNode.id == models.UserNodeProgress.node_id,
    ).join(models.User, models.User.id == models.UserNodeProgress.user_id).filter(
        models.User.type == "membro", models.TrainingNode.type == "game",
        models.UserNodeProgress.grade.isnot(None),
    )
    for user_id, grade in games:
        grades[user_id].append(grade)
    submissions = db.query(models.ActivitySubmission).join(
        models.User, models.User.id == models.ActivitySubmission.user_id,
    ).filter(models.User.type == "membro")
    for submission in submissions:
        grade = effective_grade(submission)
        if grade is not None:
            grades[submission.user_id].append(grade)
    return grades


def points_for(grades) -> int:
    return round(sum(grades) * POINTS_PER_GRADE_POINT)


def level_for(points: int) -> dict:
    index = max(i for i, (minimum, _) in enumerate(LEVELS) if points >= minimum)
    minimum, name = LEVELS[index]
    following = LEVELS[index + 1][0] if index + 1 < len(LEVELS) else None
    return {"number": index + 1, "name": name, "min_points": minimum, "next_points": following}


def ranking(db: Session, grades: dict[str, list[float]]) -> list[dict]:
    members = db.query(models.User).filter(models.User.type == "membro").all()
    rows = sorted(({"user_id": member.id, "name": member.name, "eixo": normalize_axis(member.eixo),
                    "points": points_for(grades.get(member.id, []))} for member in members),
                  key=lambda row: (-row["points"], row["name"].lower(), row["user_id"]))
    for index, row in enumerate(rows):
        # Ties share a position: 1, 1, 3.
        tied = index and rows[index - 1]["points"] == row["points"]
        row["position"] = rows[index - 1]["position"] if tied else index + 1
        row["level"] = level_for(row["points"])["number"]
    return rows


def _attempt_grade(result) -> float:
    return result["grade"] if "grade" in result else normalized_grade(result["attempt_score"], result["max_score"])


def achievements(db: Session, user: models.User, grades: list[float]) -> list[dict]:
    progress = db.query(models.UserNodeProgress).filter(models.UserNodeProgress.user_id == user.id).all()
    completed = {item.node_id for item in progress if item.completed}
    passed = {item.node_id for item in progress if item.completed and (item.grade or 0) >= MIN_PASSING_GRADE}
    failed_before = any(
        attempt.node_id in passed and attempt.result and _attempt_grade(attempt.result) < MIN_PASSING_GRADE
        for attempt in db.query(models.GameAttempt).filter(
            models.GameAttempt.user_id == user.id, models.GameAttempt.status == "completed")
    )
    axis = normalize_axis(user.eixo)
    trail = [node for node in db.query(models.TrainingNode).filter(models.TrainingNode.eixo == axis).all()
             if is_required_step(node)] if axis else []
    good = sum(grade >= MIN_PASSING_GRADE for grade in grades)

    def item(key, title, description, earned, current=None, target=None):
        entry = {"id": key, "title": title, "description": description, "earned": bool(earned)}
        if target is not None:
            entry["progress"] = {"current": min(current, target), "target": target}
        return entry

    return [
        item("first_step", "Primeiro passo", "Concluir a primeira etapa de uma trilha.", completed),
        item("perfect_grade", "Nota máxima", "Tirar 10 em um jogo ou em uma entrega.", any(grade >= 10 for grade in grades)),
        item("persistent", "Persistente", "Ser aprovado em um jogo depois de uma tentativa abaixo de 7.", failed_before),
        item("consistent", "Consistente", f"Tirar 7 ou mais em {CONSISTENT_TARGET} avaliações.",
             good >= CONSISTENT_TARGET, good, CONSISTENT_TARGET),
        item("trail_complete", "Trilha concluída", "Concluir todas as etapas obrigatórias da trilha do seu eixo.",
             trail and all(node.id in completed for node in trail),
             sum(node.id in completed for node in trail), len(trail) or None),
    ]


def summary(db: Session, user: models.User) -> dict:
    grades = member_grades(db)
    own = grades.get(user.id, [])
    points = points_for(own)
    rows = ranking(db, grades)
    for row in rows:
        row["is_me"] = row["user_id"] == user.id
    return {
        "points": points, "level": level_for(points), "eixo": normalize_axis(user.eixo),
        "achievements": achievements(db, user, own), "ranking": rows,
    }
