"""Pequeñas estadísticas derivadas, pensadas para dar feedback motivacional
sin añadir complejidad al modelo de datos (se calculan al vuelo)."""
from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/streak")
def current_streak(db: Session = Depends(get_db)):
    """Racha de días consecutivos con al menos una tarea registrada.

    Cuenta hacia atrás desde hoy. Si hoy todavía no hay nada registrado,
    no rompe la racha (el día no ha terminado) y se cuenta desde ayer.
    """
    days_with_tasks = {
        row[0]
        for row in db.query(models.Task.date).distinct().all()
    }

    today = date_type.today()
    cursor = today
    if cursor not in days_with_tasks:
        cursor -= timedelta(days=1)

    streak = 0
    while cursor in days_with_tasks:
        streak += 1
        cursor -= timedelta(days=1)

    return {"streak": streak, "today_logged": today in days_with_tasks}
