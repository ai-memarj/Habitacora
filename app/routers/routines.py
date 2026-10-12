"""
Endpoints de Rutinas: calendarios de hábitos.

Dos tipos de rutina (campo `type` en Routine), mismo almacenamiento en
ambos casos (RoutineItem) — ver docstring de `Routine` en app/models.py:
- "checklist": varios items por día, cada uno con su `label` (iniciales
  tipo "V-M") y tachable por separado.
- "simple": como mucho un item por día (label=None), tachar el día
  entero equivale a tachar ese único item.

Los items se consultan por rango de fechas (?start=...&end=...) porque
el frontend pinta un mes completo del calendario de una sola vez, no
día a día.
"""
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/routines", tags=["routines"])


@router.get("", response_model=list[schemas.RoutineOut])
def list_routines(db: Session = Depends(get_db)):
    return (
        db.query(models.Routine)
        .order_by(models.Routine.position, models.Routine.id)
        .all()
    )


@router.post("", response_model=schemas.RoutineOut, status_code=201)
def create_routine(payload: schemas.RoutineCreate, db: Session = Depends(get_db)):
    next_position = db.query(models.Routine).count()
    routine = models.Routine(
        name=payload.name.strip(),
        type=payload.type,
        color=payload.color,
        position=next_position,
    )
    db.add(routine)
    db.commit()
    db.refresh(routine)
    return routine


@router.get("/{routine_id}", response_model=schemas.RoutineOut)
def get_routine(routine_id: int, db: Session = Depends(get_db)):
    routine = db.get(models.Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    return routine


@router.put("/{routine_id}", response_model=schemas.RoutineOut)
def update_routine(routine_id: int, payload: schemas.RoutineUpdate, db: Session = Depends(get_db)):
    routine = db.get(models.Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    if payload.name is not None:
        routine.name = payload.name.strip()
    if payload.color is not None:
        routine.color = payload.color
    if payload.position is not None:
        routine.position = payload.position
    db.commit()
    db.refresh(routine)
    return routine


@router.delete("/{routine_id}", status_code=204)
def delete_routine(routine_id: int, db: Session = Depends(get_db)):
    routine = db.get(models.Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    db.delete(routine)  # cascade="all, delete-orphan" se lleva sus items
    db.commit()
    return None


@router.get("/{routine_id}/items", response_model=list[schemas.RoutineItemOut])
def list_routine_items(
    routine_id: int,
    start: date_type,
    end: date_type,
    db: Session = Depends(get_db),
):
    routine = db.get(models.Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    return (
        db.query(models.RoutineItem)
        .filter(
            models.RoutineItem.routine_id == routine_id,
            models.RoutineItem.date >= start,
            models.RoutineItem.date <= end,
        )
        .order_by(models.RoutineItem.date, models.RoutineItem.position, models.RoutineItem.id)
        .all()
    )


@router.post("/{routine_id}/items", response_model=schemas.RoutineItemOut, status_code=201)
def create_routine_item(
    routine_id: int, payload: schemas.RoutineItemCreate, db: Session = Depends(get_db)
):
    routine = db.get(models.Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    label = (payload.label or "").strip() or None

    if routine.type == "simple":
        # Como mucho un item por día: si ya existe, no duplicamos —
        # devolvemos el existente tal cual (idempotente ante doble click).
        existing = (
            db.query(models.RoutineItem)
            .filter(models.RoutineItem.routine_id == routine_id, models.RoutineItem.date == payload.date)
            .first()
        )
        if existing:
            return existing

    same_day_count = (
        db.query(models.RoutineItem)
        .filter(models.RoutineItem.routine_id == routine_id, models.RoutineItem.date == payload.date)
        .count()
    )
    item = models.RoutineItem(
        routine_id=routine_id,
        date=payload.date,
        label=label,
        position=same_day_count,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/items/{item_id}", response_model=schemas.RoutineItemOut)
def update_routine_item(
    item_id: int, payload: schemas.RoutineItemUpdate, db: Session = Depends(get_db)
):
    item = db.get(models.RoutineItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Elemento no encontrado")
    if payload.label is not None:
        item.label = payload.label.strip() or None
    if payload.done is not None:
        item.done = payload.done
    if payload.position is not None:
        item.position = payload.position
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
def delete_routine_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.RoutineItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Elemento no encontrado")
    db.delete(item)
    db.commit()
    return None
