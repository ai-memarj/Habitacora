"""Endpoints de registro de sueño: un registro por noche (upsert por fecha)."""
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/sleep", tags=["sleep"])


@router.get("", response_model=list[schemas.SleepLogOut])
def list_sleep_logs(db: Session = Depends(get_db)):
    return db.query(models.SleepLog).order_by(models.SleepLog.date.desc()).all()


@router.get("/{for_date}", response_model=schemas.SleepLogOut)
def get_sleep_log(for_date: date_type, db: Session = Depends(get_db)):
    log = db.query(models.SleepLog).filter(models.SleepLog.date == for_date).first()
    if not log:
        raise HTTPException(status_code=404, detail="No hay registro de sueño para ese día")
    return log


@router.put("", response_model=schemas.SleepLogOut)
def upsert_sleep_log(payload: schemas.SleepLogUpsert, db: Session = Depends(get_db)):
    """Crea o actualiza (upsert) el registro de sueño de un día concreto."""
    log = db.query(models.SleepLog).filter(models.SleepLog.date == payload.date).first()
    if not log:
        log = models.SleepLog(date=payload.date)
        db.add(log)

    log.sleep_time = payload.sleep_time
    log.wake_time = payload.wake_time
    log.light_pct = payload.light_pct
    log.deep_pct = payload.deep_pct
    log.rem_pct = payload.rem_pct

    db.commit()
    db.refresh(log)
    return log
