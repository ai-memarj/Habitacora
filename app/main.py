"""
Punto de entrada de la aplicación FastAPI.

Arranque local:
    uvicorn app.main:app --reload --port 8000
Luego abre http://localhost:8000
"""
import os

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.database import Base, engine, SessionLocal
from app.seed import seed_default_categories
from app.routers import categories, tasks, sleep, daily, stats

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Crea las tablas si no existen (para el prototipo; en producción se usarían
# migraciones con Alembic en vez de create_all).
Base.metadata.create_all(bind=engine)

# Siembra las categorías por defecto una sola vez.
_db = SessionLocal()
try:
    seed_default_categories(_db)
finally:
    _db.close()

app = FastAPI(title="Hábitos, objetivos y salud mental")

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

app.include_router(categories.router)
app.include_router(tasks.router)
app.include_router(sleep.router)
app.include_router(daily.router)
app.include_router(daily.summary_router)
app.include_router(stats.router)


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
def health():
    return {"status": "ok"}
