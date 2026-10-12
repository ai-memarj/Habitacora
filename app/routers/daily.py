"""Endpoints de la entrada diaria (frase motivacional, ánimo, notas) y el resumen del día."""
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/daily", tags=["daily"])


@router.get("/{for_date}", response_model=schemas.DailyEntryOut)
def get_daily_entry(for_date: date_type, db: Session = Depends(get_db)):
    entry = db.query(models.DailyEntry).filter(models.DailyEntry.date == for_date).first()
    if not entry:
        raise HTTPException(status_code=404, detail="No hay entrada registrada para ese día")
    return entry


@router.put("", response_model=schemas.DailyEntryOut)
def upsert_daily_entry(payload: schemas.DailyEntryUpsert, db: Session = Depends(get_db)):
    entry = db.query(models.DailyEntry).filter(models.DailyEntry.date == payload.date).first()
    if not entry:
        entry = models.DailyEntry(date=payload.date)
        db.add(entry)

    entry.quote = payload.quote
    entry.mood = payload.mood
    entry.notes = payload.notes

    db.commit()
    db.refresh(entry)
    return entry


summary_router = APIRouter(prefix="/api/summary", tags=["summary"])


@summary_router.get("/{for_date}", response_model=schemas.DaySummary)
def day_summary(for_date: date_type, db: Session = Depends(get_db)):
    """Vista agregada de un día: tareas + sueño + frase/ánimo/notas. Útil para la UI y para
    exportar un resumen de consulta más adelante."""
    tasks = (
        db.query(models.Task)
        .options(joinedload(models.Task.category))
        .filter(models.Task.date == for_date)
        .order_by(models.Task.id)
        .all()
    )
    sleep = db.query(models.SleepLog).filter(models.SleepLog.date == for_date).first()
    entry = db.query(models.DailyEntry).filter(models.DailyEntry.date == for_date).first()

    return schemas.DaySummary(
        date=for_date,
        tasks=tasks,
        sleep=sleep,
        entry=entry,
        total_minutes=sum(t.minutes for t in tasks),
    )
