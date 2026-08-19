"""
api/auth.py — Authentication endpoints (/api/auth/*)
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter()


class LoginRequest(schemas.BaseModel):
    email: str
    password: str


@router.post("/register", response_model=schemas.UserOut)
def register_user(user_in: schemas.UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Este email já está cadastrado")

    user_type = "trainee"
    eixo = None
    if user_in.email.endswith("@infoej.com.br"):
        if user_in.email.startswith("admin@"):
            user_type = "admin"
        elif user_in.email.startswith("organizador@"):
            user_type = "organizador"
        else:
            user_type = "membro"
            eixo = "Vendas"

    new_user = models.User(
        id=str(uuid.uuid4()),
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        cargo=user_in.cargo,
        type=user_type,
        eixo=eixo,
        photo="",
        nota_rotacao=0.0 if user_type == "trainee" else None,
        pontos_acumulados=0,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=schemas.Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ou senha incorretos",
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user
