/**
 * Utilidades de fecha en zona horaria LOCAL.
 *
 * `Date#toISOString()` convierte a UTC antes de formatear, así que en
 * cualquier zona horaria con offset positivo (p. ej. Europe/Madrid,
 * UTC+1/+2) restar un día o sumar un día cerca de medianoche puede dar
 * la misma fecha que ya teníamos, o saltarse una fecha entera, porque
 * la conversión a UTC cruza el límite del día de forma distinta a como
 * lo hace el reloj local del usuario. Todo el manejo de fechas "qué día
 * es hoy" / "qué día es el siguiente/anterior" debe pasar por estas
 * funciones, que solo usan los componentes LOCALES del `Date`
 * (getFullYear/getMonth/getDate), nunca `toISOString()`.
 */

/** Formatea un `Date` como "YYYY-MM-DD" usando sus componentes locales. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** La fecha de hoy ("YYYY-MM-DD") en la zona horaria local del navegador. */
export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * Suma (o resta, con delta negativo) días a una fecha ISO
 * ("YYYY-MM-DD"), devolviendo otra fecha ISO. El `T00:00:00` (sin "Z")
 * fuerza que el string se parsee como medianoche LOCAL en vez de UTC.
 */
export function shiftISODate(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

/** Suma (o resta) `delta` meses a un año/mes (mes 0-11), con acarreo de año. */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = month + delta;
  const year2 = year + Math.floor(total / 12);
  const month2 = ((total % 12) + 12) % 12;
  return { year: year2, month: month2 };
}

/** Cuántos días tiene un año/mes (mes 0-11). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Fecha ISO ("YYYY-MM-DD") a partir de año/mes (0-11)/día — constructor numérico, siempre hora local. */
export function isoFromYMD(year: number, month: number, day: number): string {
  return toISODate(new Date(year, month, day));
}

export interface CalendarDay {
  iso: string; // "YYYY-MM-DD"
  day: number; // día del mes (1-31)
  monthShort: string; // "ene", "feb"... en minúscula, para las celdas fuera del mes actual
  inMonth: boolean; // true si pertenece al mes que se está mostrando
  isToday: boolean;
  weekday: number; // 0 = lunes ... 6 = domingo
}

/**
 * Construye la cuadrícula de un mes para un calendario semanas
 * Lunes-Domingo: incluye los días de relleno del mes anterior/siguiente
 * necesarios para completar la primera y la última semana (igual que
 * cualquier calendario tipo Google Calendar). Longitud siempre múltiplo
 * de 7. Todos los `Date` se construyen con el constructor numérico
 * (año, mes, día), que SIEMPRE es hora local — nunca se parsea un
 * string ni se usa `toISOString()` aquí, así que no hay riesgo del bug
 * de zona horaria que tuvo la navegación de fecha del dashboard diario.
 */
export function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekdayMon0 = (firstOfMonth.getDay() + 6) % 7; // 0=lunes
  const gridStart = new Date(year, month, 1 - firstWeekdayMon0);

  const lastOfMonth = new Date(year, month + 1, 0);
  const lastWeekdayMon0 = (lastOfMonth.getDay() + 6) % 7;
  const gridEnd = new Date(year, month, lastOfMonth.getDate() + (6 - lastWeekdayMon0));

  const todayIso = todayISO();
  const days: CalendarDay[] = [];
  const cursor = new Date(gridStart);
  while (cursor.getTime() <= gridEnd.getTime()) {
    const iso = toISODate(cursor);
    days.push({
      iso,
      day: cursor.getDate(),
      monthShort: cursor.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
      inMonth: cursor.getMonth() === month,
      isToday: iso === todayIso,
      weekday: (cursor.getDay() + 6) % 7,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
