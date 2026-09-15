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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app import models
from app.api import auth, users, materials, nodes, activities, grades, games
from app.migrations import migrate

# Ensure all tables exist (idempotent — safe to run every startup)
migrate(engine)

app = FastAPI(title="Capacita DC API")

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
# Uploaded files are served through app.api.grades (GET /api/uploads/{pathname})
# and app.api.activities, both backed by private Vercel Blob storage — compute
# here is stateless, so there is no local directory to mount.

app.include_router(auth.router,       prefix="/api/auth",       tags=["auth"])
app.include_router(users.router,      prefix="/api/users",      tags=["users"])
app.include_router(materials.router,  prefix="/api/materials",  tags=["materials"])
app.include_router(nodes.router,      prefix="/api/nodes",      tags=["nodes"])
app.include_router(activities.router, prefix="/api/activities", tags=["activities"])
app.include_router(grades.router,     prefix="/api",            tags=["grades"])
app.include_router(games.router,      prefix="/api",            tags=["games"])
