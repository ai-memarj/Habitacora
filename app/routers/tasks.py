"""Endpoints de tareas diarias (Casa, Rutina, Coche, Guitarra, Deporte, Trabajo...)."""
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(for_date: date_type | None = None, db: Session = Depends(get_db)):
    """Lista tareas. Si se pasa ?for_date=YYYY-MM-DD, filtra por ese día."""
    query = db.query(models.Task).options(joinedload(models.Task.category))
    if for_date is not None:
        query = query.filter(models.Task.date == for_date)
    return query.order_by(models.Task.date.desc(), models.Task.id.desc()).all()


@router.post("", response_model=schemas.TaskOut, status_code=201)
def create_task(payload: schemas.TaskCreate, db: Session = Depends(get_db)):
    category = db.get(models.Category, payload.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    task = models.Task(
        date=payload.date,
        name=payload.name.strip(),
        minutes=payload.minutes,
        category_id=payload.category_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, payload: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(models.Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    if payload.category_id is not None:
        category = db.get(models.Category, payload.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")
        task.category_id = payload.category_id
    if payload.name is not None:
        task.name = payload.name.strip()
    if payload.minutes is not None:
        task.minutes = payload.minutes
    if payload.date is not None:
        task.date = payload.date
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(models.Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    db.delete(task)
    db.commit()
    return None
