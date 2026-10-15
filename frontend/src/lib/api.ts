import axios from "axios";
import type {
  Category,
  Task,
  SleepLog,
  DailyEntry,
  DaySummary,
  Streak,
  Routine,
  RoutineActivity,
  RoutineItem,
} from "@/types";

/**
 * Cliente HTTP único hacia la API de FastAPI. La URL base viene de una
 * variable de entorno pública (NEXT_PUBLIC_*, visible en el bundle de
 * cliente) para poder apuntar a localhost en desarrollo y al dominio real
 * una vez desplegado, sin tocar código.
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

/** Fetcher que SWR usa por defecto para las claves de tipo string (rutas de la API). */
export const fetcher = (url: string) => api.get(url).then((res) => res.data);

/**
 * Funciones de mutación, agrupadas por recurso. Cada hook de `src/hooks/`
 * las usa y llama a `mutate()` de SWR después para revalidar. Mantenerlas
 * aquí (en vez de inline en los componentes) es lo que permite que un
 * mismo endpoint se reutilice desde distintas pantallas sin duplicar la
 * llamada a axios.
 */

// ---------- Categorías ----------
export const categoriesApi = {
  create: (data: { name: string; color?: string | null }) =>
    api.post<Category>("/api/categories", data).then((r) => r.data),
  update: (id: number, data: { name?: string; color?: string | null }) =>
    api.put<Category>(`/api/categories/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/api/categories/${id}`),
};

// ---------- Tareas ----------
export const tasksApi = {
  list: (for_date: string) => api.get<Task[]>("/api/tasks", { params: { for_date } }).then((r) => r.data),
  create: (data: { date: string; name: string; minutes: number; category_id: number }) =>
    api.post<Task>("/api/tasks", data).then((r) => r.data),
  update: (id: number, data: { name?: string; minutes?: number; category_id?: number }) =>
    api.put<Task>(`/api/tasks/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/api/tasks/${id}`),
};

// ---------- Sueño ----------
export const sleepApi = {
  /** `null` si ese día no tiene sueño registrado (404), en vez de lanzar. */
  get: (for_date: string) =>
    api
      .get<SleepLog>(`/api/sleep/${for_date}`)
      .then((r) => r.data)
      .catch((err) => (err.response?.status === 404 ? null : Promise.reject(err))),
  upsert: (data: {
    date: string;
    sleep_time?: string | null;
    wake_time?: string | null;
    light_pct?: number | null;
    deep_pct?: number | null;
    rem_pct?: number | null;
  }) => api.put<SleepLog>("/api/sleep", data).then((r) => r.data),
};

// ---------- Entrada diaria (frase / ánimo / notas) ----------
export const dailyApi = {
  /** `null` si ese día no tiene entrada registrada (404), en vez de lanzar. */
  get: (for_date: string) =>
    api
      .get<DailyEntry>(`/api/daily/${for_date}`)
      .then((r) => r.data)
      .catch((err) => (err.response?.status === 404 ? null : Promise.reject(err))),
  upsert: (data: { date: string; quote?: string | null; mood?: number | null; notes?: string | null }) =>
    api.put<DailyEntry>("/api/daily", data).then((r) => r.data),
};

// ---------- Rutinas (calendarios de hábitos) ----------
//
// Una rutina no tiene tipo: se crea solo con nombre y color, y va
// tomando forma según se le añadan actividades, ciclo o meta. Ver
// `routineMode()` en src/lib/routine-cycle.ts.
export const routinesApi = {
  create: (data: { name: string; color?: string | null }) =>
    api.post<Routine>("/api/routines", data).then((r) => r.data),
  /**
   * `goal_days`, `cycle_length` y `cycle_start` se pueden poner a `null`
   * explícitamente para quitar la meta o el patrón; el backend distingue
   * "no enviado" de "enviado como null" (ver `model_fields_set` en
   * app/routers/routines.py), así que omitir un campo lo deja intacto.
   */
  update: (
    id: number,
    data: {
      name?: string;
      color?: string | null;
      position?: number;
      goal_days?: number | null;
      cycle_length?: number | null;
      cycle_start?: string | null;
    }
  ) => api.put<Routine>(`/api/routines/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/api/routines/${id}`),
};

// ---------- Vocabulario de una rutina ----------
export const routineActivitiesApi = {
  create: (
    routineId: number,
    data: { name: string; short_label?: string | null; color?: string | null; quota?: number | null }
  ) =>
    api
      .post<RoutineActivity>(`/api/routines/${routineId}/activities`, data)
      .then((r) => r.data),
  update: (
    activityId: number,
    data: {
      name?: string;
      short_label?: string | null;
      color?: string | null;
      quota?: number | null;
      position?: number;
    }
  ) => api.put<RoutineActivity>(`/api/routines/activities/${activityId}`, data).then((r) => r.data),
  /** Devuelve 400 si la actividad tiene días registrados (igual que las categorías con tareas). */
  remove: (activityId: number) => api.delete(`/api/routines/activities/${activityId}`),
};

// ---------- Ciclo (el patrón) ----------
export const routineCycleApi = {
  /** Sustituye el ciclo entero. No reescribe lo ya estampado en el calendario. */
  set: (
    routineId: number,
    data: {
      cycle_length: number;
      cycle_start?: string | null;
      slots: { activity_id: number; day_index: number }[];
    }
  ) => api.put<Routine>(`/api/routines/${routineId}/cycle`, data).then((r) => r.data),
};

export const routineItemsApi = {
  create: (
    routineId: number,
    data: { date: string; activity_id?: number | null; label?: string | null; done?: boolean }
  ) => api.post<RoutineItem>(`/api/routines/${routineId}/items`, data).then((r) => r.data),
  update: (
    itemId: number,
    data: {
      activity_id?: number | null;
      label?: string | null;
      done?: boolean;
      position?: number;
      date?: string;
    }
  ) => api.put<RoutineItem>(`/api/routines/items/${itemId}`, data).then((r) => r.data),
  remove: (itemId: number) => api.delete(`/api/routines/items/${itemId}`),
  /**
   * Pegado masivo: sustituye TODOS los items de cada día listado. Lo usan
   * el estampado del ciclo (`buildStampDays` en src/lib/routine-cycle.ts)
   * y la importación por texto. Un día que no se mande no se toca.
   */
  bulkSet: (
    routineId: number,
    days: { date: string; activity_ids?: number[]; labels?: string[] }[]
  ) => api.put<RoutineItem[]>(`/api/routines/${routineId}/items/bulk`, { days }).then((r) => r.data),
};

// Re-exportados por conveniencia, para quien importe solo desde aquí.
export type {
  Category,
  Task,
  SleepLog,
  DailyEntry,
  DaySummary,
  Streak,
  Routine,
  RoutineActivity,
  RoutineItem,
};
