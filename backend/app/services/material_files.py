"""Authorization for material files kept in private storage.

A file is readable through the material that lists it, never by knowing its URL:
participants need a trail step that already reached that material, staff need
the material inside their own scope. A file uploaded but not linked yet is only
readable by whoever uploaded it (or another manager of the same axis).
External links (http/https to other sites) are outside the application's control.
"""

from urllib.parse import unquote, urlsplit

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.services import access
from app.services.node_service import library_material_ids
from app.services.roles import STAFF, manager_axis

UPLOAD_ROUTE = "/api/uploads/"


def upload_url(storage_key: str) -> str:
    return f"{UPLOAD_ROUTE}{storage_key}"


def storage_key_of(url: str) -> str | None:
    """The private storage key an internal file URL points to, whatever its host.

    An absolute URL to this same API must count as internal too, otherwise it could
    be used to link another axis's file into one's own material.
    """
    path = unquote(urlsplit((url or "").strip()).path)
    if not path.startswith(UPLOAD_ROUTE):
        return None
    return path[len(UPLOAD_ROUTE):] or None


def record_upload(db: Session, user: models.User, storage_key: str) -> None:
    db.add(models.MaterialUpload(storage_key=storage_key, user_id=user.id, eixo=manager_axis(user)))


def can_read_material(db: Session, user: models.User, material: models.Material) -> bool:
    try:
        access.ensure_material_access(user, material)
    except HTTPException:
        return False
    if user.type in STAFF:
        return True
    return material.id in library_material_ids(db, user)


def _materials_listing(db: Session, storage_key: str) -> list[models.Material]:
    candidates = db.query(models.Document).filter(
        models.Document.url.contains(storage_key, autoescape=True),
    ).all()
    return [doc.material for doc in candidates if storage_key_of(doc.url) == storage_key and doc.material]


def can_read_file(db: Session, user: models.User, storage_key: str) -> bool:
    if user.type == "admin":
        return True
    upload = db.query(models.MaterialUpload).filter(models.MaterialUpload.storage_key == storage_key).first()
    if upload is not None and (upload.user_id == user.id
                               or (manager_axis(user) is not None and upload.eixo == manager_axis(user))):
        return True
    # Arquivos antigos não têm registro de envio: valem os documentos já cadastrados.
    return any(can_read_material(db, user, material) for material in _materials_listing(db, storage_key))


def ensure_file_access(db: Session, user: models.User, storage_key: str) -> None:
    if not can_read_file(db, user, storage_key):
        raise HTTPException(status_code=403, detail="Você não tem acesso a este arquivo.")


def validate_document_links(db: Session, user: models.User, documents, material: models.Material | None = None) -> None:
    """A material may only list internal files the person saving it can read.

    Files the material already had stay allowed, so editing its text never
    requires re-uploading an older document.
    """
    if user.type == "admin":
        return
    kept = {storage_key_of(doc.url) for doc in material.documents} if material is not None else set()
    for document in documents:
        key = storage_key_of(document.url)
        if key is not None and key not in kept and not can_read_file(db, user, key):
            raise HTTPException(
                status_code=403,
                detail=f"O documento \"{document.name}\" não foi enviado por você nem pertence a um material do seu escopo.",
            )
