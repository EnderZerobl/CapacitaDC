"""
main.py — Application entry point.

Responsibilities:
  - Create the FastAPI instance
  - Register middleware
  - Mount static file directories
  - Include all API routers

Business logic lives in app/services/*.py
HTTP routing lives in app/api/*.py
"""

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine
from app import models
from app.api import auth, users, materials, nodes, activities, grades

# Ensure all tables exist (idempotent — safe to run every startup)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Capacita DC API")

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ──────────────────────────────────────────────────────────────

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router,       prefix="/api/auth",       tags=["auth"])
app.include_router(users.router,      prefix="/api/users",      tags=["users"])
app.include_router(materials.router,  prefix="/api/materials",  tags=["materials"])
app.include_router(nodes.router,      prefix="/api/nodes",      tags=["nodes"])
app.include_router(activities.router, prefix="/api/activities", tags=["activities"])
app.include_router(grades.router,     prefix="/api",            tags=["grades"])
