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
