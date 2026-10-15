/**
 * Lógica de ciclos, cupos y rachas de una rutina.
 *
 * Todo lo de aquí son funciones PURAS sobre los datos que devuelve la
 * API, por el mismo motivo que `day-import-md.ts` y
 * `routine-bulk-text.ts`: son las reglas que más fácil es equivocar
 * (aritmética de fechas, módulos negativos, ventanas de ciclo) y así se
 * pueden razonar y probar sin montar un componente.
 *
 * Toda la aritmética de fechas pasa por `lib/date.ts` — nunca
 * `toISOString()`, ver la cabecera de ese fichero.
 */
import { shiftISODate, toISODate } from "@/lib/date";
import type { Routine, RoutineActivity, RoutineItem } from "@/types";

/**
 * Cómo se pinta una rutina. NO se almacena: se deduce de qué campos
 * rellenó el usuario, que es lo que permite que crear una rutina no
 * obligue a clasificarla antes de tener claro qué forma tendrá.
 *
 * - `reto`: hay meta en días ("30 días sin fumar").
 * - `cupo`: alguna actividad tiene cupo ("2 boxeos por ciclo").
 * - `pauta`: el resto — el ciclo dice qué toca cada día.
 */
export type RoutineMode = "pauta" | "cupo" | "reto";

export function routineMode(routine: Routine): RoutineMode {
  if (routine.goal_days != null) return "reto";
  if (routine.activities.some((a) => a.quota != null)) return "cupo";
  return "pauta";
}

/** Días completos entre dos fechas ISO (b - a). Negativo si b es anterior. */
export function daysBetweenISO(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  // Redondeo porque el cambio de hora (DST) hace que algunos "días"
  // duren 23 o 25 horas, y una división cruda daría 0.958 o 1.04.
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/**
 * Qué día del ciclo (0..cycle_length-1) le toca a una fecha, contando
 * desde el ancla. Devuelve `null` si la rutina no tiene patrón.
 *
 * El módulo se normaliza a positivo porque las fechas ANTERIORES al
 * ancla dan diferencia negativa, y en JS `-1 % 7` es `-1`, no `6`.
 */
export function cycleDayIndex(routine: Routine, iso: string): number | null {
  if (!routine.cycle_length || routine.cycle_length < 1) return null;
  const anchor = routine.cycle_start;
  if (!anchor) return null;
  const diff = daysBetweenISO(anchor, iso);
  const n = routine.cycle_length;
  return ((diff % n) + n) % n;
}

/**
 * En qué repetición del ciclo cae una fecha (0 = la que empieza en el
 * ancla, -1 = la anterior). Es la "semana" de los cupos: con un ciclo de
 * 7 días anclado a un lunes coincide con la semana natural, y con un
 * ciclo de 4 días no hace falta inventarse dónde empieza una semana.
 */
export function cycleWindowIndex(routine: Routine, iso: string): number | null {
  if (!routine.cycle_length || routine.cycle_length < 1 || !routine.cycle_start) return null;
  return Math.floor(daysBetweenISO(routine.cycle_start, iso) / routine.cycle_length);
}

export interface CycleWindow {
  index: number;
  startISO: string;
  endISO: string;
}

/** La ventana de ciclo número `index`, en fechas ISO. */
export function cycleWindow(routine: Routine, index: number): CycleWindow | null {
  if (!routine.cycle_length || !routine.cycle_start) return null;
  const startISO = shiftISODate(routine.cycle_start, index * routine.cycle_length);
  return {
    index,
    startISO,
    endISO: shiftISODate(startISO, routine.cycle_length - 1),
  };
}

/** Las ventanas de ciclo que tocan el rango [startISO, endISO] (el mes visible). */
export function cycleWindowsInRange(
  routine: Routine,
  startISO: string,
  endISO: string
): CycleWindow[] {
  const first = cycleWindowIndex(routine, startISO);
  const last = cycleWindowIndex(routine, endISO);
  if (first === null || last === null) return [];
  const windows: CycleWindow[] = [];
  for (let i = first; i <= last; i++) {
    const w = cycleWindow(routine, i);
    if (w) windows.push(w);
  }
  return windows;
}

/**
 * ¿Las repeticiones del ciclo caen exactamente sobre las filas de la
 * cuadrícula mensual (lunes a domingo)? Solo si el ciclo dura 7 días y
 * el ancla es un lunes. Cuando pasa, el resumen de cada ventana se puede
 * pintar al final de su propia fila del calendario; cuando no, va en una
 * tira aparte debajo.
 */
export function cycleAlignsWithWeeks(routine: Routine): boolean {
  if (routine.cycle_length !== 7 || !routine.cycle_start) return false;
  const anchor = new Date(routine.cycle_start + "T00:00:00");
  return (anchor.getDay() + 6) % 7 === 0; // 0 = lunes
}

// ---------- Cupos ----------

export interface QuotaTallyRow {
  activity: RoutineActivity;
  quota: number;
  done: number;
  planned: number; // items existentes (hechos o no) de esa actividad en la ventana
}

export interface QuotaTally {
  rows: QuotaTallyRow[];
  doneTotal: number;
  quotaTotal: number;
}

/**
 * Cuenta lo hecho frente al cupo dentro de una ventana de ciclo. Solo
 * entran las actividades CON cupo: las que no lo tienen no se cuentan
 * (no son parte del compromiso de la ventana).
 */
export function quotaTally(
  routine: Routine,
  items: RoutineItem[],
  window: CycleWindow
): QuotaTally {
  const enWindow = items.filter((it) => it.date >= window.startISO && it.date <= window.endISO);
  const rows: QuotaTallyRow[] = [];
  for (const activity of routine.activities) {
    if (activity.quota == null) continue;
    const suyos = enWindow.filter((it) => it.activity_id === activity.id);
    rows.push({
      activity,
      quota: activity.quota,
      done: suyos.filter((it) => it.done).length,
      planned: suyos.length,
    });
  }
  return {
    rows,
    doneTotal: rows.reduce((acc, r) => acc + r.done, 0),
    quotaTotal: rows.reduce((acc, r) => acc + r.quota, 0),
  };
}

// ---------- Validación del patrón ("¿cuadra?") ----------

export interface CycleBalanceRow {
  activity: RoutineActivity;
  quota: number;
  placed: number;
}

export interface CycleBalance {
  rows: CycleBalanceRow[];
  placedTotal: number;
  quotaTotal: number;
  balanced: boolean;
  /** Mensajes tipo "falta 1 BOX", "sobra 1 MOV" — vacío si cuadra. */
  problems: string[];
}

/**
 * Compara el reparto del ciclo (cuántas veces aparece cada actividad en
 * los slots) con los cupos declarados. Es lo que hace que no tengas que
 * llevar la cuenta en la cabeza mientras repartes los entrenos.
 *
 * `slots` se pasa aparte (y no se lee de `routine.cycle_slots`) porque
 * el editor valida el borrador que hay en pantalla, no lo guardado.
 */
export function cycleBalance(
  activities: RoutineActivity[],
  slots: { activity_id: number }[]
): CycleBalance {
  const colocados = new Map<number, number>();
  for (const slot of slots) {
    colocados.set(slot.activity_id, (colocados.get(slot.activity_id) ?? 0) + 1);
  }

  const rows: CycleBalanceRow[] = [];
  const problems: string[] = [];
  for (const activity of activities) {
    if (activity.quota == null) continue;
    const placed = colocados.get(activity.id) ?? 0;
    rows.push({ activity, quota: activity.quota, placed });
    const etiqueta = activity.short_label || activity.name;
    if (placed < activity.quota) {
      problems.push(`falta ${activity.quota - placed} ${etiqueta}`);
    } else if (placed > activity.quota) {
      problems.push(`sobra ${placed - activity.quota} ${etiqueta}`);
    }
  }

  return {
    rows,
    placedTotal: rows.reduce((acc, r) => acc + r.placed, 0),
    quotaTotal: rows.reduce((acc, r) => acc + r.quota, 0),
    balanced: problems.length === 0,
    problems,
  };
}

// ---------- Estampado ----------

export interface StampDay {
  date: string;
  activity_ids: number[];
}

/**
 * Genera los días a mandar al pegado masivo para "estampar" el ciclo
 * sobre un rango de fechas.
 *
 * `skipDates` son los días que NO hay que tocar: por defecto el diálogo
 * le pasa todos los que ya tienen algo registrado, para que estampar no
 * borre tachones que ya habías hecho (el pegado masivo sustituye el día
 * entero). Es el mismo criterio de "no destructivo por omisión" de la
 * importación de días desde Markdown.
 *
 * Un día del ciclo sin ninguna actividad asignada se devuelve con
 * `activity_ids` vacío a propósito: eso vacía ese día en el calendario,
 * que es lo que significa "ese día del ciclo no toca nada".
 */
export function buildStampDays(
  routine: Routine,
  startISO: string,
  endISO: string,
  skipDates: Set<string> = new Set()
): StampDay[] {
  if (!routine.cycle_length || !routine.cycle_start) return [];

  const porDia = new Map<number, number[]>();
  for (const slot of [...routine.cycle_slots].sort((a, b) => a.position - b.position)) {
    const lista = porDia.get(slot.day_index) ?? [];
    lista.push(slot.activity_id);
    porDia.set(slot.day_index, lista);
  }

  const days: StampDay[] = [];
  let cursor = startISO;
  while (cursor <= endISO) {
    if (!skipDates.has(cursor)) {
      const idx = cycleDayIndex(routine, cursor);
      days.push({ date: cursor, activity_ids: idx === null ? [] : (porDia.get(idx) ?? []) });
    }
    cursor = shiftISODate(cursor, 1);
  }
  return days;
}

// ---------- Rachas (retos) ----------

export interface StreakInfo {
  current: number;
  best: number;
  doneTotal: number;
}

/**
 * Racha de días consecutivos cumplidos, contando hacia atrás desde hoy.
 *
 * Un día sin item es "sin registrar" y corta la racha igual que uno
 * roto, pero NO cuenta como cumplido — la distinción importa para que
 * `doneTotal` (el progreso hacia la meta) no mienta.
 *
 * `items` debe venir ordenado o no, da igual: se indexa por fecha.
 */
export function streakInfo(items: RoutineItem[]): StreakInfo {
  const porFecha = new Map<string, boolean>();
  for (const it of items) {
    // Si un día tuviera varios items (rutina con vocabulario y meta a la
    // vez), basta con que uno esté hecho para contar el día.
    porFecha.set(it.date, (porFecha.get(it.date) ?? false) || it.done);
  }

  const doneTotal = [...porFecha.values()].filter(Boolean).length;

  let current = 0;
  let cursor = toISODate(new Date());
  while (porFecha.get(cursor)) {
    current += 1;
    cursor = shiftISODate(cursor, -1);
  }

  // Mejor racha: recorre las fechas cumplidas en orden y mide los tramos
  // consecutivos.
  const cumplidas = [...porFecha.entries()]
    .filter(([, done]) => done)
    .map(([iso]) => iso)
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const iso of cumplidas) {
    run = prev !== null && daysBetweenISO(prev, iso) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = iso;
  }

  return { current, best: Math.max(best, current), doneTotal };
}
