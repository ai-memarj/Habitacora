/**
 * Formato de texto para pegar/exportar un mes entero de una rutina de
 * golpe, en vez de ir día a día por el calendario.
 *
 * Una línea por día del mes:
 *   <día>. <actividad1>, <actividad2>, ...
 *
 * El número identifica el día del mes (no el orden de las líneas), así
 * que se pueden pegar solo algunos días, en cualquier orden, y los
 * demás quedan intactos. Cada nombre de una misma línea, separado por
 * coma, se convierte en un item tachable independiente. Un día sin nada
 * después del número (p. ej. "6." solo) dice explícitamente "ese día no
 * toca nada"; un día que ni siquiera aparece en el texto se deja como
 * estaba.
 *
 * Los nombres se resuelven contra el VOCABULARIO de la rutina (sus
 * `RoutineActivity`), aceptando tanto las iniciales como el nombre
 * completo y sin distinguir mayúsculas ni acentos. Antes se aceptaba
 * cualquier string, y eso hacía que "Boxeo", "boxeo" y "box" fueran tres
 * cosas distintas para la base de datos: imposible contar cupos y
 * cualquier falta de ortografía partía los datos en silencio.
 *
 * Si la rutina todavía no tiene vocabulario, se mantiene el
 * comportamiento anterior (texto suelto), para no bloquear a quien aún
 * no lo ha definido.
 *
 * Ejemplo:
 *   1. BOX, MOV
 *   2. Carrera continua
 *   3.
 */
import { daysInMonth, isoFromYMD } from "@/lib/date";
import type { RoutineActivity, RoutineItem } from "@/types";

export interface ParsedBulkDay {
  day: number;
  date: string; // ISO "YYYY-MM-DD"
  activityIds: number[];
  /** Solo se usa si la rutina no tiene vocabulario todavía. */
  labels: string[];
}

export interface ParseBulkResult {
  days: ParsedBulkDay[];
  errors: string[];
}

const LINE_RE = /^\s*(\d{1,2})\s*[.\):-]?\s*(.*)$/;

/** Normaliza para comparar: sin acentos, sin mayúsculas, sin espacios de sobra. */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Índice de búsqueda del vocabulario: iniciales y nombre completo apuntan a la misma actividad. */
function buildIndex(activities: RoutineActivity[]): Map<string, RoutineActivity> {
  const index = new Map<string, RoutineActivity>();
  for (const a of activities) {
    index.set(normalize(a.name), a);
    if (a.short_label) index.set(normalize(a.short_label), a);
  }
  return index;
}

/** Convierte el texto pegado por el usuario en días+actividades para un año/mes dados. */
export function parseRoutineBulkText(
  text: string,
  year: number,
  month: number,
  activities: RoutineActivity[] = []
): ParseBulkResult {
  const total = daysInMonth(year, month);
  const index = buildIndex(activities);
  const usarVocabulario = activities.length > 0;
  const days: ParsedBulkDay[] = [];
  const errors: string[] = [];

  text.split("\n").forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;

    const match = line.match(LINE_RE);
    if (!match) {
      errors.push(`Línea ${idx + 1}: no reconozco el número de día ("${rawLine.trim()}")`);
      return;
    }

    const day = Number(match[1]);
    if (day < 1 || day > total) {
      errors.push(`Línea ${idx + 1}: el día ${day} no existe ese mes (máximo ${total})`);
      return;
    }

    const tokens = match[2]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const activityIds: number[] = [];
    const labels: string[] = [];
    for (const token of tokens) {
      if (!usarVocabulario) {
        labels.push(token);
        continue;
      }
      const activity = index.get(normalize(token));
      if (activity) {
        activityIds.push(activity.id);
      } else {
        // Permisivo como el resto del parser: el token no se inventa una
        // actividad nueva, se avisa y el día importa con lo que sí se
        // reconoció.
        errors.push(`Línea ${idx + 1}: "${token}" no está en las actividades de esta rutina`);
      }
    }

    const entry: ParsedBulkDay = {
      day,
      date: isoFromYMD(year, month, day),
      activityIds,
      labels,
    };
    const existingIdx = days.findIndex((d) => d.day === day);
    if (existingIdx >= 0) {
      errors.push(`Línea ${idx + 1}: el día ${day} está repetido, se queda con la última`);
      days[existingIdx] = entry;
    } else {
      days.push(entry);
    }
  });

  return { days, errors };
}

/**
 * Genera el texto de partida para un mes a partir de lo que ya hay
 * guardado (una línea por cada día del mes, en orden) — así el panel de
 * pegado se abre ya relleno con el estado actual y es tan fácil editar
 * como escribir desde cero.
 *
 * Se escriben las iniciales cuando la actividad las tiene, porque es lo
 * más corto de teclear y `parseRoutineBulkText` acepta las dos formas.
 */
export function formatRoutineBulkText(
  year: number,
  month: number,
  itemsByDate: Map<string, RoutineItem[]>,
  activities: RoutineActivity[] = []
): string {
  const porId = new Map(activities.map((a) => [a.id, a]));
  const total = daysInMonth(year, month);
  const lines: string[] = [];
  for (let day = 1; day <= total; day++) {
    const iso = isoFromYMD(year, month, day);
    const nombres = (itemsByDate.get(iso) ?? [])
      .map((it) => {
        const a = it.activity_id != null ? porId.get(it.activity_id) : undefined;
        return a ? a.short_label || a.name : (it.label ?? "");
      })
      .filter(Boolean);
    lines.push(`${day}. ${nombres.join(", ")}`.trimEnd());
  }
  return lines.join("\n");
}
