/**
 * Tipos que reflejan los esquemas Pydantic del backend (app/schemas.py).
 * Mantener sincronizados a mano por ahora; si el proyecto crece, valorar
 * generarlos automáticamente desde el OpenAPI de FastAPI (openapi-typescript).
 */

export interface Category {
  id: number;
  name: string;
  color: string | null;
}

export interface Task {
  id: number;
  date: string; // ISO date "YYYY-MM-DD"
  name: string;
  minutes: number;
  category_id: number;
  category: Category;
}

export interface SleepLog {
  id: number;
  date: string;
  sleep_time: string | null; // "HH:MM:SS"
  wake_time: string | null;
  light_pct: number | null;
  deep_pct: number | null;
  rem_pct: number | null;
}

export interface DailyEntry {
  id: number;
  date: string;
  quote: string | null;
  mood: number | null; // 1-5
  notes: string | null;
}

export interface DaySummary {
  date: string;
  tasks: Task[];
  sleep: SleepLog | null;
  entry: DailyEntry | null;
  total_minutes: number;
}

export interface Streak {
  streak: number;
  today_logged: boolean;
}

/**
 * Una rutina NO tiene tipo. El modo con el que se pinta (pauta / cupo /
 * reto) se deduce de qué campos están rellenos — ver `routineMode()` en
 * src/lib/routine-cycle.ts y el docstring de `Routine` en app/models.py.
 */
export interface Routine {
  id: number;
  name: string;
  color: string | null;
  position: number;
  cycle_length: number | null; // N días que dura el ciclo; null = sin patrón
  cycle_start: string | null; // ISO "YYYY-MM-DD": ancla desde la que se cuenta el día del ciclo
  goal_days: number | null; // "30 días sin fumar"; null = sin meta
  activities: RoutineActivity[];
  cycle_slots: RoutineCycleSlot[];
}

/** El vocabulario de una rutina: las cosas concretas que se hacen en ella. */
export interface RoutineActivity {
  id: number;
  routine_id: number;
  name: string;
  short_label: string | null; // lo que se pinta en la celda del calendario
  color: string | null;
  position: number;
  quota: number | null; // veces por repetición del ciclo; null = sin cupo
}

/** Una actividad colocada en un día del ciclo (el patrón, no el calendario). */
export interface RoutineCycleSlot {
  id: number;
  routine_id: number;
  activity_id: number;
  day_index: number; // 0..cycle_length-1
  position: number;
}

export interface RoutineItem {
  id: number;
  routine_id: number;
  date: string; // ISO date "YYYY-MM-DD"
  activity_id: number | null;
  label: string | null; // texto suelto si no hay actividad
  done: boolean;
  position: number;
}
