"""
Modelos de la base de datos (SQLAlchemy ORM).

Entidades:
- Category: categorías de tareas, editables por el usuario (Casa, Rutina, Coche...)
- Task: una tarea registrada en un día concreto, con categoría, nombre y minutos dedicados
- SleepLog: registro de sueño de una noche (hora de dormir/despertar y % de fases)
- DailyEntry: lo "no estructurado" del día -> frase motivacional, estado de ánimo, notas
"""
from datetime import date as date_type

from sqlalchemy import (
    Column, Integer, String, Float, Date, Time, Text, ForeignKey, UniqueConstraint
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
