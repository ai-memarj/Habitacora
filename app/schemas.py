"""Esquemas Pydantic: forma de los datos que entran y salen de la API."""
from datetime import date, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


# ---------- Category ----------
class CategoryCreate(BaseModel):
    name: str
    color: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: Optional[str] = None


# ---------- Task ----------
class TaskCreate(BaseModel):
    date: date
    name: str
    minutes: int
    category_id: int

    @field_validator("minutes")
    @classmethod
    def minutes_positive(cls, v):
        if v <= 0:
            raise ValueError("Los minutos dedicados deben ser mayores que 0")
        return v


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    minutes: Optional[int] = None
    category_id: Optional[int] = None
    date: Optional[date] = None


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


# ---------- Vista agregada de un día completo ----------
class DaySummary(BaseModel):
    date: date
    tasks: list[TaskOut]
    sleep: Optional[SleepLogOut] = None
    entry: Optional[DailyEntryOut] = None
    total_minutes: int
