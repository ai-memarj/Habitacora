"""
Modelos de la base de datos (SQLAlchemy ORM).

Entidades:
- Category: categorías de tareas, editables por el usuario (Casa, Rutina, Coche...)
- Task: una tarea registrada en un día concreto, con categoría, nombre y minutos dedicados
- SleepLog: registro de sueño de una noche (hora de dormir/despertar y % de fases)
- DailyEntry: lo "no estructurado" del día -> frase motivacional, estado de ánimo, notas
- Routine / RoutineActivity / RoutineCycleSlot / RoutineItem: calendarios
  de hábitos (p. ej. "Rutina capilar"), ver el docstring de Routine.
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
    """Un calendario de hábito/rutina (p. ej. "Rutina capilar", "Entrenos",
    "No fumar").

    **No hay tipos de rutina.** Antes había un campo `type`
    ("checklist" | "simple") que obligaba a clasificar la rutina al
    crearla, justo cuando menos claro se tiene qué forma va a tener. Las
    tres formas que surgen en la práctica son la misma estructura
    rellenada a distintos niveles:

    - *Pauta* (rutina capilar): vocabulario de varias actividades + ciclo
      de N días. El ciclo dice qué toca cada día.
    - *Cupo* (entrenos de la semana): lo anterior + `quota` en las
      actividades. El ciclo propone un reparto y los cupos se verifican
      por repetición del ciclo, no por semana natural — así un ciclo de
      4 días no necesita inventarse dónde empieza "la semana".
    - *Reto* ("30 días sin fumar"): una sola actividad, ciclo de 1 día y
      `goal_days`.

    Así que el modo de visualización se DEDUCE en el frontend de qué
    campos están rellenos (ver `routineMode()` en
    frontend/src/lib/routine-cycle.ts), no se almacena.

    `cycle_length`/`cycle_start` definen el patrón; `cycle_start` es el
    ancla desde la que se cuenta el día del ciclo, lo que permite que un
    ciclo de 7 días anclado a un lunes se comporte exactamente como una
    plantilla semanal.
    """
    __tablename__ = "routines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    color = Column(String(20), nullable=True)
    position = Column(Integer, nullable=False, default=0)  # orden en el listado de rutinas

    # Patrón. Ambos NULL = rutina sin plan: se rellena a mano día a día
    # (válido, para cuando aún no sabes qué forma tendrá).
    cycle_length = Column(Integer, nullable=True)  # N días que dura el ciclo
    cycle_start = Column(Date, nullable=True)      # ancla desde la que se cuenta

    goal_days = Column(Integer, nullable=True)  # "30 días sin fumar"; NULL = sin meta

    activities = relationship(
        "RoutineActivity",
        back_populates="routine",
        cascade="all, delete-orphan",
        order_by="RoutineActivity.position",
    )
    cycle_slots = relationship(
        "RoutineCycleSlot",
        back_populates="routine",
        cascade="all, delete-orphan",
        order_by="RoutineCycleSlot.day_index",
    )
    items = relationship(
        "RoutineItem", back_populates="routine", cascade="all, delete-orphan"
    )


class RoutineActivity(Base):
    """El vocabulario de una rutina: las cosas concretas que se hacen en ella.

    Sustituye al `label` de texto libre que tenía RoutineItem. Con texto
    libre, "Boxeo", "boxeo" y "box" eran tres cosas distintas para la base
    de datos, así que no se podía contar nada ni colorear por tipo; y
    había que reescribir lo mismo decenas de veces al mes.

    `quota` es "cuántas veces por repetición del ciclo" y es lo único que
    convierte una rutina en un Cupo. NULL = sin cupo (no se cuenta).
    """
    __tablename__ = "routine_activities"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    short_label = Column(String(8), nullable=True)  # lo que se pinta en la celda del calendario
    color = Column(String(20), nullable=True)
    position = Column(Integer, nullable=False, default=0)
    quota = Column(Integer, nullable=True)  # veces por ciclo; NULL = sin cupo

    routine = relationship("Routine", back_populates="activities")
    cycle_slots = relationship(
        "RoutineCycleSlot", back_populates="activity", cascade="all, delete-orphan"
    )
    items = relationship("RoutineItem", back_populates="activity")


class RoutineCycleSlot(Base):
    """Una actividad colocada en un día del ciclo (el patrón, no el calendario).

    `day_index` va de 0 a `Routine.cycle_length - 1`. Un día del ciclo
    puede tener varias actividades (el caso de los entrenos: 9 sesiones en
    7 días), de ahí que esto sea una tabla y no una columna.

    El patrón no se pinta al vuelo sobre el calendario: se "estampa"
    (genera RoutineItem reales) sobre un mes concreto. Así cambiar el
    ciclo no reescribe el pasado — el historial sigue diciendo lo que de
    verdad tocaba entonces.
    """
    __tablename__ = "routine_cycle_slots"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("routine_activities.id"), nullable=False, index=True)
    day_index = Column(Integer, nullable=False)  # 0..cycle_length-1
    position = Column(Integer, nullable=False, default=0)  # orden dentro del día del ciclo

    routine = relationship("Routine", back_populates="cycle_slots")
    activity = relationship("RoutineActivity", back_populates="cycle_slots")


class RoutineItem(Base):
    """Lo que realmente pasó (o está planificado) un día concreto.

    Es a la vez plan y registro: que el item exista significa "esto
    tocaba"; `done` dice si se hizo. En rutinas con meta (retos) eso da
    tres estados sin necesidad de más columnas: sin item = sin registrar,
    `done=True` = cumplido, `done=False` = roto explícitamente. Sin esa
    distinción la racha tendría que adivinar si un hueco es un fallo o un
    día que simplemente no se registró.

    `activity_id` es lo normal; `label` se mantiene para items sueltos
    escritos a mano y para los datos anteriores al vocabulario.
    """
    __tablename__ = "routine_items"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("routine_activities.id"), nullable=True, index=True)
    label = Column(String(60), nullable=True)  # texto suelto si no hay actividad
    done = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)  # orden dentro del día

    routine = relationship("Routine", back_populates="items")
    activity = relationship("RoutineActivity", back_populates="items")
