"""
Modelos de la base de datos (SQLAlchemy ORM).

Entidades:
- Category: categorías de tareas, editables por el usuario (Casa, Rutina, Coche...)
- Task: una tarea registrada en un día concreto, con categoría, nombre y minutos dedicados
- SleepLog: registro de sueño de una noche (hora de dormir/despertar y % de fases)
- DailyEntry: lo "no estructurado" del día -> frase motivacional, estado de ánimo, notas
- Routine / RoutineItem: calendarios de hábitos (p. ej. "Rutina capilar"),
  ver el docstring de Routine para el porqué del modelo.
"""
from datetime import date as date_type

from sqlalchemy import (
    Boolean, Column, Integer, String, Float, Date, Time, Text, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), unique=True, nullable=False)
    color = Column(String(20), nullable=True)  # color hex opcional para la UI, p.ej. "#6C5CE7"

    tasks = relationship("Task", back_populates="category")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, default=date_type.today, index=True)
    name = Column(String(200), nullable=False)
    minutes = Column(Integer, nullable=False)  # tiempo dedicado, en minutos

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    category = relationship("Category", back_populates="tasks")


class SleepLog(Base):
    __tablename__ = "sleep_logs"

    id = Column(Integer, primary_key=True, index=True)
    # La noche se identifica por la fecha en la que te acuestas (noche del 12 al 13 -> date=12)
    date = Column(Date, nullable=False, unique=True, index=True)

    sleep_time = Column(Time, nullable=True)   # hora a la que te dormiste
    wake_time = Column(Time, nullable=True)    # hora a la que te despertaste

    light_pct = Column(Float, nullable=True)   # % sueño ligero
    deep_pct = Column(Float, nullable=True)    # % sueño profundo
    rem_pct = Column(Float, nullable=True)     # % sueño REM


class DailyEntry(Base):
    """Una fila por día con lo que no encaja como 'tarea': ánimo, frase, notas."""
    __tablename__ = "daily_entries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, unique=True, index=True)

    quote = Column(Text, nullable=True)        # frase motivacional del día
    mood = Column(Integer, nullable=True)       # estado de ánimo, escala 1-5
    notes = Column(Text, nullable=True)         # notas libres del día

    __table_args__ = (UniqueConstraint("date", name="uq_daily_entries_date"),)


class Routine(Base):
    """Un calendario de hábito/rutina (p. ej. "Rutina capilar", "No fumar").

    `type` solo cambia cómo se comporta la UI, no el almacenamiento (ambos
    tipos usan RoutineItem):
    - "checklist": cada día puede tener varios RoutineItem con su propio
      `label` (las iniciales tipo "V-M", "F-K" del calendario de ejemplo
      del usuario), cada uno tachable por separado.
    - "simple": cada día tiene como mucho un RoutineItem (label=None), y
      tachar el día entero es tachar ese único item — para calendarios
      tipo racha donde solo importa "hecho / no hecho" ese día.
    """
    __tablename__ = "routines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    type = Column(String(20), nullable=False, default="checklist")  # "checklist" | "simple"
    color = Column(String(20), nullable=True)
    position = Column(Integer, nullable=False, default=0)  # orden en el listado de rutinas

    items = relationship(
        "RoutineItem", back_populates="routine", cascade="all, delete-orphan"
    )


class RoutineItem(Base):
    """Una entrada de una Routine en un día concreto (ver docstring de Routine)."""
    __tablename__ = "routine_items"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    label = Column(String(60), nullable=True)  # iniciales/texto corto; None en rutinas "simple"
    done = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)  # orden dentro del día

    routine = relationship("Routine", back_populates="items")
