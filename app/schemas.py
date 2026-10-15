"""Esquemas Pydantic: forma de los datos que entran y salen de la API."""
import re
from datetime import date, time
from typing import Literal, Optional

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
class RoutineCreate(BaseModel):
    name: str
    type: Literal["checklist", "simple"] = "checklist"
    color: Optional[str] = None


class RoutineUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    position: Optional[int] = None


class RoutineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    type: str
    color: Optional[str] = None
    position: int


class RoutineItemCreate(BaseModel):
    date: date
    label: Optional[str] = None


class RoutineItemUpdate(BaseModel):
    label: Optional[str] = None
    done: Optional[bool] = None
    position: Optional[int] = None


class RoutineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    routine_id: int
    date: date
    label: Optional[str] = None
    done: bool
    position: int


class RoutineBulkDay(BaseModel):
    """Un día dentro de un pegado masivo: sustituye TODOS los items de ese
    día por esta lista (incluido si alguno ya estaba tachado)."""
    date: date
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
