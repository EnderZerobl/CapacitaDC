"""Shared rules for required assessments and normalized game grades."""

from fastapi import HTTPException


def validate_settings(subject, changes):
    required = changes.get("is_required", subject.is_required)
    weight = changes.get("weight", subject.weight)
    if required and weight <= 0:
        raise HTTPException(422, "Atividades e jogos obrigatórios precisam de peso maior que zero")


MIN_PASSING_GRADE = 7.0


def min_grade_for(node):
    """Repeatable games require this best grade to conclude the step.

    A single-attempt game cannot be retried, so any grade concludes it.
    """
    return MIN_PASSING_GRADE if node.allow_retry else None


def passes(node, best_grade):
    minimum = min_grade_for(node)
    return minimum is None or (best_grade is not None and best_grade >= minimum)


def normalized_grade(score, maximum):
    return round(min(10.0, max(0.0, 10.0 * score / maximum)), 2) if maximum > 0 else 0.0


def effective_grade(submission):
    grades = [grade for grade in (submission.grade, submission.previous_grade) if grade is not None]
    return max(grades) if grades else None
