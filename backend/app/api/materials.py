"""
api/materials.py — Material/content endpoints (/api/materials/*)
"""

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, get_current_organizador_or_admin

router = APIRouter()


@router.get("/", response_model=List[schemas.MaterialOut])
def get_materials(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.type == "trainee":
        return db.query(models.Material).filter(models.Material.type == "trainee").all()
    elif current_user.type == "membro":
        return db.query(models.Material).filter(
            models.Material.type.in_(["trainee", "membro"])
        ).all()
    elif current_user.type == "organizador":
        return db.query(models.Material).filter(
            models.Material.type.in_(["trainee", "pluginfo"])
        ).all()
    return db.query(models.Material).all()


@router.post("/", response_model=schemas.MaterialOut)
def create_material(
    material_in: schemas.MaterialCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    if current_user.type == "organizador" and material_in.type not in ["pluginfo", "trainee"]:
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem gerenciar conteúdos do PlugInfo e Trainees.",
        )

    new_material = models.Material(
        id=str(uuid.uuid4()),
        name=material_in.name,
        type=material_in.type,
        eixo=material_in.eixo,
        text=material_in.text or "",
    )
    db.add(new_material)
    db.flush()

    for doc in material_in.documents:
        db.add(models.Document(
            id=str(uuid.uuid4()),
            material_id=new_material.id,
            name=doc.name,
            url=doc.url,
        ))

    for video_url in material_in.videos:
        db.add(models.Video(
            id=str(uuid.uuid4()),
            material_id=new_material.id,
            url=video_url,
        ))

    db.commit()
    db.refresh(new_material)
    return new_material


@router.put("/{material_id}", response_model=schemas.MaterialOut)
def update_material(
    material_id: str,
    material_in: schemas.MaterialCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado")

    if current_user.type == "organizador" and (
        material.type not in ["pluginfo", "trainee"]
        or material_in.type not in ["pluginfo", "trainee"]
    ):
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem gerenciar conteúdos do PlugInfo e Trainees.",
        )

    material.name = material_in.name
    material.type = material_in.type
    material.eixo = material_in.eixo
    material.text = material_in.text or ""

    db.query(models.Document).filter(models.Document.material_id == material_id).delete()
    db.query(models.Video).filter(models.Video.material_id == material_id).delete()

    for doc in material_in.documents:
        db.add(models.Document(
            id=str(uuid.uuid4()),
            material_id=material_id,
            name=doc.name,
            url=doc.url,
        ))

    for video_url in material_in.videos:
        db.add(models.Video(
            id=str(uuid.uuid4()),
            material_id=material_id,
            url=video_url,
        ))

    db.commit()
    db.refresh(material)
    return material


@router.delete("/{material_id}")
def delete_material(
    material_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado")

    if current_user.type == "organizador" and material.type not in ["pluginfo", "trainee"]:
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado. Organizadores só podem gerenciar conteúdos do PlugInfo e Trainees.",
        )

    db.delete(material)
    db.commit()
    return {"detail": "Material deletado com sucesso"}
