"""
Endpoints de Rutinas: calendarios de hábitos.

No hay tipos de rutina. Una rutina es un nombre + un vocabulario de
actividades (`RoutineActivity`) + opcionalmente un patrón (`cycle_length`
/ `cycle_start` + `RoutineCycleSlot`), cupos (`RoutineActivity.quota`) y
una meta (`goal_days`). Las tres formas que aparecen en la práctica
(pauta, cupo, reto) son esa misma estructura rellenada a distintos
niveles, y el frontend deduce cómo pintarla — ver el docstring de
`Routine` en app/models.py.

Los items se consultan por rango de fechas (?start=...&end=...) porque
el frontend pinta un mes completo del calendario de una sola vez, no
día a día.

El "estampado" del ciclo sobre un mes NO tiene endpoint propio: el
frontend genera los días a partir del ciclo y los manda al pegado
masivo (`PUT /{id}/items/bulk`) que ya existía. Coherente con "backend
como API pura" — la orquestación vive en el cliente, igual que en la
importación de días desde Markdown.
"""
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/routines", tags=["routines"])


def _get_routine(db: Session, routine_id: int) -> models.Routine:
    routine = db.get(models.Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    return routine


def _get_activity(db: Session, activity_id: int) -> models.RoutineActivity:
    activity = db.get(models.RoutineActivity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    return activity


def _check_activity_belongs(activity_id: int, routine_id: int, db: Session) -> None:
    """Una actividad de otra rutina en los items/ciclo de esta sería un dato
    corrupto silencioso (contaría en cupos ajenos), así que se rechaza."""
    activity = _get_activity(db, activity_id)
    if activity.routine_id != routine_id:
        raise HTTPException(
            status_code=400, detail="Esa actividad pertenece a otra rutina"
        )


# ---------- Rutinas ----------
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
        color=payload.color,
        cycle_length=payload.cycle_length,
        cycle_start=payload.cycle_start,
        goal_days=payload.goal_days,
        position=next_position,
    )
    db.add(routine)
    db.commit()
    db.refresh(routine)
    return routine


@router.get("/{routine_id}", response_model=schemas.RoutineOut)
def get_routine(routine_id: int, db: Session = Depends(get_db)):
    return _get_routine(db, routine_id)


@router.put("/{routine_id}", response_model=schemas.RoutineOut)
def update_routine(
    routine_id: int, payload: schemas.RoutineUpdate, db: Session = Depends(get_db)
):
    routine = _get_routine(db, routine_id)
    if payload.name is not None:
        routine.name = payload.name.strip()
    if payload.color is not None:
        routine.color = payload.color
    if payload.position is not None:
        routine.position = payload.position

    # `goal_days`, `cycle_length` y `cycle_start` SÍ se pueden querer poner
    # a NULL (quitar la meta, quitar el ciclo), así que aquí no vale el
    # patrón "if x is not None" del resto: se mira si el campo venía en el
    # JSON (model_fields_set) en vez de si su valor es None.
    enviados = payload.model_fields_set
    if "goal_days" in enviados:
        routine.goal_days = payload.goal_days
    if "cycle_length" in enviados:
        routine.cycle_length = payload.cycle_length
    if "cycle_start" in enviados:
        routine.cycle_start = payload.cycle_start

    db.commit()
    db.refresh(routine)
    return routine


@router.delete("/{routine_id}", status_code=204)
def delete_routine(routine_id: int, db: Session = Depends(get_db)):
    routine = _get_routine(db, routine_id)
    db.delete(routine)  # cascade se lleva actividades, slots e items
    db.commit()
    return None


# ---------- Vocabulario (actividades) ----------
@router.post(
    "/{routine_id}/activities", response_model=schemas.RoutineActivityOut, status_code=201
)
def create_activity(
    routine_id: int, payload: schemas.RoutineActivityCreate, db: Session = Depends(get_db)
):
    _get_routine(db, routine_id)
    next_position = (
        db.query(models.RoutineActivity)
        .filter(models.RoutineActivity.routine_id == routine_id)
        .count()
    )
    activity = models.RoutineActivity(
        routine_id=routine_id,
        name=payload.name.strip(),
        short_label=(payload.short_label or "").strip() or None,
        color=payload.color,
        quota=payload.quota,
        position=next_position,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.put("/activities/{activity_id}", response_model=schemas.RoutineActivityOut)
def update_activity(
    activity_id: int, payload: schemas.RoutineActivityUpdate, db: Session = Depends(get_db)
):
    activity = _get_activity(db, activity_id)
    if payload.name is not None:
        activity.name = payload.name.strip()
    if payload.short_label is not None:
        activity.short_label = payload.short_label.strip() or None
    if payload.color is not None:
        activity.color = payload.color
    if payload.position is not None:
        activity.position = payload.position
    # `quota` a NULL = quitar el cupo, así que mismo trato que goal_days.
    if "quota" in payload.model_fields_set:
        activity.quota = payload.quota
    db.commit()
    db.refresh(activity)
    return activity


@router.delete("/activities/{activity_id}", status_code=204)
def delete_activity(activity_id: int, db: Session = Depends(get_db)):
    """Borra una actividad del vocabulario.

    Se niega si tiene items registrados, misma regla que las categorías
    de tareas (`app/routers/categories.py`): borrarla se llevaría por
    delante historial real. Los slots del ciclo sí caen en cascada —
    esos son plan, no registro.
    """
    activity = _get_activity(db, activity_id)
    items = (
        db.query(models.RoutineItem)
        .filter(models.RoutineItem.activity_id == activity_id)
        .count()
    )
    if items > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"'{activity.name}' tiene {items} día(s) registrados. "
                "Bórralos del calendario antes de quitar la actividad."
            ),
        )
    db.delete(activity)
    db.commit()
    return None


# ---------- Ciclo (el patrón) ----------
@router.put("/{routine_id}/cycle", response_model=schemas.RoutineOut)
def set_cycle(
    routine_id: int, payload: schemas.RoutineCycleSet, db: Session = Depends(get_db)
):
    """Sustituye el ciclo entero (longitud, ancla y slots) de una rutina.

    Cambiar el ciclo NO reescribe lo ya estampado en el calendario: eso
    son `RoutineItem`, que se quedan como están. Es deliberado — el
    historial debe seguir diciendo lo que de verdad tocaba entonces.
    """
    routine = _get_routine(db, routine_id)

    for slot in payload.slots:
        if slot.day_index < 0 or slot.day_index >= payload.cycle_length:
            raise HTTPException(
                status_code=400,
                detail=f"Día {slot.day_index + 1} fuera de un ciclo de {payload.cycle_length} días",
            )
        _check_activity_belongs(slot.activity_id, routine_id, db)

    db.query(models.RoutineCycleSlot).filter(
        models.RoutineCycleSlot.routine_id == routine_id
    ).delete()

    por_dia: dict[int, int] = {}
    for slot in payload.slots:
        position = por_dia.get(slot.day_index, 0)
        por_dia[slot.day_index] = position + 1
        db.add(
            models.RoutineCycleSlot(
                routine_id=routine_id,
                activity_id=slot.activity_id,
                day_index=slot.day_index,
                position=position,
            )
        )

    routine.cycle_length = payload.cycle_length
    routine.cycle_start = payload.cycle_start
    db.commit()
    db.refresh(routine)
    return routine


# ---------- Items (el calendario) ----------
@router.get("/{routine_id}/items", response_model=list[schemas.RoutineItemOut])
def list_routine_items(
    routine_id: int,
    start: date_type,
    end: date_type,
    db: Session = Depends(get_db),
):
    _get_routine(db, routine_id)
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
    _get_routine(db, routine_id)
    if payload.activity_id is not None:
        _check_activity_belongs(payload.activity_id, routine_id, db)

    same_day_count = (
        db.query(models.RoutineItem)
        .filter(
            models.RoutineItem.routine_id == routine_id,
            models.RoutineItem.date == payload.date,
        )
        .count()
    )
    item = models.RoutineItem(
        routine_id=routine_id,
        date=payload.date,
        activity_id=payload.activity_id,
        label=(payload.label or "").strip() or None,
        done=payload.done if payload.done is not None else False,
        position=same_day_count,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{routine_id}/items/bulk", response_model=list[schemas.RoutineItemOut])
def bulk_set_routine_items(
    routine_id: int, payload: schemas.RoutineBulkSet, db: Session = Depends(get_db)
):
    """Pegado masivo: para cada día de `payload.days`, sustituye TODOS sus
    items existentes por los dados (borra y recrea, perdiendo el estado
    `done` que tuvieran ese día — es "fijar el plan", no un toggle). Un día
    que no aparece en `payload.days` no se toca.

    Lo usan el estampado del ciclo y la importación por texto. Que el
    estampado no pise días ya tachados se decide en el cliente, que sabe
    qué días del mes tienen algo y los excluye de la lista salvo que el
    usuario pida explícitamente sustituirlos.
    """
    _get_routine(db, routine_id)
    for day in payload.days:
        for activity_id in day.activity_ids:
            _check_activity_belongs(activity_id, routine_id, db)

    created: list[models.RoutineItem] = []
    for day in payload.days:
        db.query(models.RoutineItem).filter(
            models.RoutineItem.routine_id == routine_id,
            models.RoutineItem.date == day.date,
        ).delete()

        position = 0
        for activity_id in day.activity_ids:
            item = models.RoutineItem(
                routine_id=routine_id,
                date=day.date,
                activity_id=activity_id,
                position=position,
            )
            db.add(item)
            created.append(item)
            position += 1
        for raw_label in day.labels:
            label = raw_label.strip() or None
            if label is None:
                continue
            item = models.RoutineItem(
                routine_id=routine_id, date=day.date, label=label, position=position
            )
            db.add(item)
            created.append(item)
            position += 1

    db.commit()
    for item in created:
        db.refresh(item)
    return created


@router.put("/items/{item_id}", response_model=schemas.RoutineItemOut)
def update_routine_item(
    item_id: int, payload: schemas.RoutineItemUpdate, db: Session = Depends(get_db)
):
    item = db.get(models.RoutineItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Elemento no encontrado")
    if payload.activity_id is not None:
        _check_activity_belongs(payload.activity_id, item.routine_id, db)
        item.activity_id = payload.activity_id
    if payload.label is not None:
        item.label = payload.label.strip() or None
    if payload.done is not None:
        item.done = payload.done
    if payload.position is not None:
        item.position = payload.position
    if payload.date is not None:
        item.date = payload.date
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
