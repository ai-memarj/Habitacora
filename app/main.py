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

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import SessionLocal
from app.seed import seed_default_categories
from app.routers import categories, tasks, sleep, daily, stats, routines

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _run_migrations() -> None:
    """Lleva la base de datos a la última migración al arrancar.

    Sustituye al `Base.metadata.create_all()` que había aquí: en cuanto
    hubo datos reales que no se pueden perder (2026-10-15), `create_all`
    dejó de ser suficiente — crea tablas nuevas pero NO altera las que ya
    existen, así que un campo añadido a un modelo se quedaba sin reflejar
    en la base de datos sin que nada avisara.

    Se ejecuta automáticamente en vez de dejarlo como paso manual porque
    esto es una app personal de un solo desarrollador y olvidarse de
    `alembic upgrade head` tras un `git pull` es el fallo más probable.
    Es idempotente, así que con `--reload` no molesta. En Fase 3
    (servidor propio) conviene hacerlo explícito en el despliegue y
    quitarlo de aquí, para no migrar en caliente al reiniciar.
    """
    cfg = Config(os.path.join(BASE_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BASE_DIR, "migrations"))
    command.upgrade(cfg, "head")


_run_migrations()

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
app.include_router(routines.router)


@app.get("/health")
def health():
    return {"status": "ok"}
