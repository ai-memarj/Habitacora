"""Esquemas Pydantic: forma de los datos que entran y salen de la API."""
import re
from datetime import date, time
from datetime import date as date_type  # alias: en clases con un campo llamado `date`, el nombre del campo tapa al del tipo
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _validate_hex_color(v: Optional[str]) -> Optional[str]:
    if v is not None and not HEX_COLOR_RE.match(v):
        raise ValueError("El color debe ser un hex de 6 dígitos, p. ej. '#6C5CE7'")
    return v


# ---------- Category ----------
class CategoryCreate(BaseModel):
    name: str
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def color_is_hex(cls, v):
        return _validate_hex_color(v)


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def color_is_hex(cls, v):
        return _validate_hex_color(v)


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: Optional[str] = None


MINUTES_PER_DAY = 24 * 60
MAX_CYCLE_LENGTH = 366  # un ciclo más largo que un año no es un ciclo


def _validate_quota(v: Optional[int]) -> Optional[int]:
    if v is not None and v < 1:
        raise ValueError("Un cupo debe ser al menos 1 (deja vacío para no tener cupo)")
    return v


def _validate_task_minutes(v: int) -> int:
    if v <= 0:
        raise ValueError("Los minutos dedicados deben ser mayores que 0")
    if v > MINUTES_PER_DAY:
        raise ValueError("Una sola tarea no puede durar más de 24 horas")
    return v


# ---------- Task ----------
class TaskCreate(BaseModel):
    date: date
    name: str
    minutes: int
    category_id: int

    @field_validator("minutes")
    @classmethod
    def minutes_positive(cls, v):
        return _validate_task_minutes(v)


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    minutes: Optional[int] = None
    category_id: Optional[int] = None
    date: Optional[date] = None

    @field_validator("minutes")
    @classmethod
    def minutes_positive(cls, v):
        if v is None:
            return v
        return _validate_task_minutes(v)


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    date: date
    name: str
    minutes: int
    category_id: int
    category: CategoryOut


# ---------- Sleep ----------
class SleepLogUpsert(BaseModel):
    date: date
    sleep_time: Optional[time] = None
    wake_time: Optional[time] = None
    light_pct: Optional[float] = None
    deep_pct: Optional[float] = None
    rem_pct: Optional[float] = None

    @field_validator("light_pct", "deep_pct", "rem_pct")
    @classmethod
    def pct_range(cls, v):
        if v is not None and not (0 <= v <= 100):
            raise ValueError("Los porcentajes deben estar entre 0 y 100")
        return v


class SleepLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    date: date
    sleep_time: Optional[time] = None
    wake_time: Optional[time] = None
    light_pct: Optional[float] = None
    deep_pct: Optional[float] = None
    rem_pct: Optional[float] = None


# ---------- Daily entry (frase, ánimo, notas) ----------
class DailyEntryUpsert(BaseModel):
    date: date
    quote: Optional[str] = None
    mood: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("mood")
    @classmethod
    def mood_range(cls, v):
        if v is not None and not (1 <= v <= 5):
            raise ValueError("El ánimo debe estar entre 1 y 5")
        return v


class DailyEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    date: date
    quote: Optional[str] = None
    mood: Optional[int] = None
    notes: Optional[str] = None


# ---------- Routines (calendarios de hábitos) ----------
#
# No hay campo `type`: el modo (pauta / cupo / reto) se DEDUCE en el
# frontend de qué campos están rellenos. Ver el docstring de `Routine`
# en app/models.py.


class RoutineActivityCreate(BaseModel):
    name: str
    short_label: Optional[str] = None
    color: Optional[str] = None
    quota: Optional[int] = None

    @field_validator("color")
    @classmethod
    def color_is_hex(cls, v):
        return _validate_hex_color(v)

    @field_validator("quota")
    @classmethod
    def quota_positive(cls, v):
        return _validate_quota(v)


class RoutineActivityUpdate(BaseModel):
    name: Optional[str] = None
    short_label: Optional[str] = None
    color: Optional[str] = None
    quota: Optional[int] = None
    position: Optional[int] = None

    @field_validator("color")
    @classmethod
    def color_is_hex(cls, v):
        return _validate_hex_color(v)

    @field_validator("quota")
    @classmethod
    def quota_positive(cls, v):
        return _validate_quota(v)


class RoutineActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    routine_id: int
    name: str
    short_label: Optional[str] = None
    color: Optional[str] = None
    position: int
    quota: Optional[int] = None


class RoutineCycleSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    routine_id: int
    activity_id: int
    day_index: int
    position: int


class RoutineCycleSlotIn(BaseModel):
    activity_id: int
    day_index: int


class RoutineCycleSet(BaseModel):
    """Sustituye el ciclo ENTERO de una rutina.

    Reemplazar todo en vez de hacer CRUD slot a slot es lo que encaja con
    el editor de patrón del frontend, que mantiene el ciclo completo en
    estado local y lo guarda de una vez.
    """
    cycle_length: int
    cycle_start: Optional[date] = None
    slots: list[RoutineCycleSlotIn] = []

    @field_validator("cycle_length")
    @classmethod
    def cycle_length_sane(cls, v):
        if v < 1:
            raise ValueError("El ciclo debe durar al menos 1 día")
        if v > MAX_CYCLE_LENGTH:
            raise ValueError(f"El ciclo no puede durar más de {MAX_CYCLE_LENGTH} días")
        return v


class RoutineCreate(BaseModel):
    name: str
    color: Optional[str] = None
    cycle_length: Optional[int] = None
    cycle_start: Optional[date] = None
    goal_days: Optional[int] = None

    @field_validator("color")
    @classmethod
    def color_is_hex(cls, v):
        return _validate_hex_color(v)


class RoutineUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    position: Optional[int] = None
    cycle_length: Optional[int] = None
    cycle_start: Optional[date] = None
    goal_days: Optional[int] = None
    # `goal_days`/`cycle_start` se quitan mandando null explícito; ver
    # `clear_fields` en el router (Pydantic no distingue "ausente" de
    # "null" sin model_fields_set, que es justo lo que usa el router).

    @field_validator("color")
    @classmethod
    def color_is_hex(cls, v):
        return _validate_hex_color(v)


class RoutineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: Optional[str] = None
    position: int
    cycle_length: Optional[int] = None
    cycle_start: Optional[date] = None
    goal_days: Optional[int] = None
    # Anidados: el frontend necesita el vocabulario y el ciclo para pintar
    # cualquier cosa, así que mandarlos aquí ahorra dos peticiones por
    # pantalla y mantiene un solo tipo en el cliente.
    activities: list[RoutineActivityOut] = []
    cycle_slots: list[RoutineCycleSlotOut] = []


class RoutineItemCreate(BaseModel):
    date: date
    activity_id: Optional[int] = None
    label: Optional[str] = None
    done: Optional[bool] = None


class RoutineItemUpdate(BaseModel):
    activity_id: Optional[int] = None
    label: Optional[str] = None
    done: Optional[bool] = None
    position: Optional[int] = None
    date: Optional[date_type] = None  # mover un item a otro día (reparto de cupos)


class RoutineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    routine_id: int
    date: date
    activity_id: Optional[int] = None
    label: Optional[str] = None
    done: bool
    position: int


class RoutineBulkDay(BaseModel):
    """Un día dentro de un pegado masivo: sustituye TODOS los items de ese
    día por esta lista (incluido si alguno ya estaba tachado).

    `activity_ids` es la vía normal (estampado del ciclo e importación por
    texto resuelta contra el vocabulario); `labels` se mantiene para
    items sueltos sin actividad."""
    date: date
    activity_ids: list[int] = []
    labels: list[str] = []


class RoutineBulkSet(BaseModel):
    days: list[RoutineBulkDay]


# ---------- Vista agregada de un día completo ----------
class DaySummary(BaseModel):
    date: date
    tasks: list[TaskOut]
    sleep: Optional[SleepLogOut] = None
    entry: Optional[DailyEntryOut] = None
    total_minutes: int
