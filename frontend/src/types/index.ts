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

export type RoutineType = "checklist" | "simple";

export interface Routine {
  id: number;
  name: string;
  type: RoutineType;
  color: string | null;
  position: number;
}

export interface RoutineItem {
  id: number;
  routine_id: number;
  date: string; // ISO date "YYYY-MM-DD"
  label: string | null; // iniciales/texto corto; null en rutinas "simple"
  done: boolean;
  position: number;
}
