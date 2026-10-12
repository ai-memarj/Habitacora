"""
Punto de entrada de la aplicación FastAPI.

A partir de la refactorización a frontend desacoplado (Next.js), esta
app es exclusivamente una API REST que sirve y recibe JSON. No sirve
HTML ni archivos estáticos — eso ahora vive en /frontend (Next.js).

Arranque local:
    uvicorn app.main:app --reload --port 8000
La API queda en http://localhost:8000 (documentación interactiva en /docs).
El frontend (Next.js) se arranca por separado, ver /frontend/README.md.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, SessionLocal
from app.seed import seed_default_categories
from app.routers import categories, tasks, sleep, daily, stats

# Crea las tablas si no existen (para el prototipo; en producción se usarían
# migraciones con Alembic en vez de create_all).
Base.metadata.create_all(bind=engine)

# Siembra las categorías por defecto una sola vez.
_db = SessionLocal()
try:
    seed_default_categories(_db)
finally:
    _db.close()

app = FastAPI(title="Bitácora API")

# CORS: el frontend de Next.js corre en un origen distinto (localhost:3000
# en desarrollo) al de esta API (localhost:8000), así que el navegador
# bloquea las peticiones fetch/axios si no lo habilitamos explícitamente.
#
# FRONTEND_ORIGINS admite una lista separada por comas vía variable de
# entorno, para añadir el dominio real una vez desplegado sin tocar código
# (p. ej. FRONTEND_ORIGINS="https://bitacora.midominio.com").
_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
origins = os.environ.get("FRONTEND_ORIGINS", _default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router)
app.include_router(tasks.router)
app.include_router(sleep.router)
app.include_router(daily.router)
app.include_router(daily.summary_router)
app.include_router(stats.router)


@app.get("/health")
def health():
    return {"status": "ok"}
