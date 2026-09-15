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
from app.services.node_service import blocked_content_ids
from app.services.access import (
    allowed_material_types,
    ensure_material_access,
    ensure_material_type_access,
)

router = APIRouter()


@router.get("", response_model=List[schemas.MaterialOut])
@router.get("/", response_model=List[schemas.MaterialOut], include_in_schema=False)
def get_materials(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Material)
    allowed = allowed_material_types(current_user)
    if allowed is not None:
        query = query.filter(models.Material.type.in_(allowed))
    blocked_materials, _ = blocked_content_ids(db, current_user)
    if blocked_materials:
        query = query.filter(models.Material.id.notin_(blocked_materials))
    return query.all()


@router.post("", response_model=schemas.MaterialOut)
@router.post("/", response_model=schemas.MaterialOut, include_in_schema=False)
def create_material(
    material_in: schemas.MaterialCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_organizador_or_admin),
):
    ensure_material_type_access(current_user, material_in.type, manage=True)

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

    ensure_material_access(current_user, material, manage=True)
    ensure_material_type_access(current_user, material_in.type, manage=True)

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

    ensure_material_access(current_user, material, manage=True)

    db.delete(material)
    db.commit()
    return {"detail": "Material deletado com sucesso"}
