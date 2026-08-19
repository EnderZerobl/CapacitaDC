"""
api/grades.py — Grades, leaderboard and file upload endpoints.
"""

import uuid
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, get_current_organizador_or_admin

router = APIRouter()

# ── Upload ────────────────────────────────────────────────────────────────────

ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "png", "jpg", "jpeg", "gif", "webp", "zip", "txt", "csv",
}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, detail=f"Tipo de arquivo .{ext} não permitido."
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Arquivo muito grande. Limite: 20 MB.")

    safe_name = f"{uuid.uuid4().hex}_{file.filename.replace(' ', '_')}"
    dest = UPLOAD_DIR / safe_name
    with open(dest, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/{safe_name}", "name": file.filename}


# ── Leaderboard ───────────────────────────────────────────────────────────────

@router.get("/leaderboard", response_model=List[schemas.LeaderboardEntry])
def get_leaderboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.User).filter(
        models.User.type.in_(["trainee", "membro"])
    ).order_by(models.User.pontos_acumulados.desc()).all()


# ── Grades spreadsheet ────────────────────────────────────────────────────────

@router.get("/grades", response_model=List[schemas.GradeRow])
def get_grades(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    if current_user.type == "organizador":
        users = db.query(models.User).filter(models.User.type == "trainee").all()
        total_nodes_map = {
            u.id: db.query(models.TrainingNode).filter(
                models.TrainingNode.eixo == "trainee"
            ).count()
            for u in users
        }
    else:
        users = db.query(models.User).filter(
            models.User.type.in_(["trainee", "membro"])
        ).all()
        total_nodes_map = {}
        for u in users:
            if u.type == "trainee":
                total_nodes_map[u.id] = db.query(models.TrainingNode).filter(
                    models.TrainingNode.eixo == "trainee"
                ).count()
            else:
                eixo_key = (u.eixo or "").lower()
                total_nodes_map[u.id] = 0
                for e in ["vendas", "conexoes", "experiencia"]:
                    if e in eixo_key:
                        total_nodes_map[u.id] = db.query(models.TrainingNode).filter(
                            models.TrainingNode.eixo == e
                        ).count()
                        break

    result = []
    for u in users:
        progress = db.query(models.UserNodeProgress).filter(
            models.UserNodeProgress.user_id == u.id,
            models.UserNodeProgress.completed == True,
        ).count()
        subs = db.query(models.ActivitySubmission).filter(
            models.ActivitySubmission.user_id == u.id
        ).all()
        graded = [s for s in subs if s.grade is not None]
        avg_grade = sum(s.grade for s in graded) / len(graded) if graded else None

        result.append(schemas.GradeRow(
            id=u.id,
            name=u.name,
            email=u.email,
            cargo=u.cargo,
            type=u.type,
            eixo=u.eixo,
            rotacao=u.rotacao,
            nota_rotacao=u.nota_rotacao,
            pontos_acumulados=u.pontos_acumulados,
            nodes_completed=progress,
            nodes_total=total_nodes_map.get(u.id, 0),
            activities_submitted=len(subs),
            activities_graded=len(graded),
            avg_activity_grade=avg_grade,
        ))
    return result
