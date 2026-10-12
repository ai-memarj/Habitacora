import axios from "axios";
import type { Category, Task, SleepLog, DailyEntry, DaySummary, Streak } from "@/types";

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
  create: (data: { date: string; name: string; minutes: number; category_id: number }) =>
    api.post<Task>("/api/tasks", data).then((r) => r.data),
  remove: (id: number) => api.delete(`/api/tasks/${id}`),
};

// ---------- Sueño ----------
export const sleepApi = {
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
  upsert: (data: { date: string; quote?: string | null; mood?: number | null; notes?: string | null }) =>
    api.put<DailyEntry>("/api/daily", data).then((r) => r.data),
};

// Re-exportados por conveniencia, para quien importe solo desde aquí.
export type { Category, Task, SleepLog, DailyEntry, DaySummary, Streak };
