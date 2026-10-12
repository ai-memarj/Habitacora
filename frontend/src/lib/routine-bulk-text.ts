/**
 * Formato de texto para pegar/exportar un mes entero de una rutina tipo
 * "checklist" de golpe, en vez de añadir cada inicial a mano día a día.
 *
 * Una línea por día del mes:
 *   <día>. <inicial1>, <inicial2>, ...
 *
 * El número identifica el día del mes (no el orden de las líneas), así
 * que se pueden pegar solo algunos días, en cualquier orden, y los
 * demás quedan intactos. Las iniciales de una misma línea, separadas
 * por coma, se convierten cada una en un item tachable independiente
 * (lo que en la celda del calendario se ve como líneas distintas). Un
 * día sin iniciales después del número (p. ej. "6." solo) dice
 * explícitamente "sin iniciales ese día"; un día que ni siquiera
 * aparece en el texto se deja como estaba.
 *
 * Ejemplo:
 *   1. V-M, F-K
 *   2. V-M, H
 *   3. V-M
 */
import { daysInMonth, isoFromYMD } from "@/lib/date";
import type { RoutineItem } from "@/types";

export interface ParsedBulkDay {
  day: number;
  date: string; // ISO "YYYY-MM-DD"
  labels: string[];
}

export interface ParseBulkResult {
  days: ParsedBulkDay[];
  errors: string[];
}

const LINE_RE = /^\s*(\d{1,2})\s*[.\):-]?\s*(.*)$/;

/** Convierte el texto pegado por el usuario en días+iniciales para un año/mes dados. */
export function parseRoutineBulkText(text: string, year: number, month: number): ParseBulkResult {
  const total = daysInMonth(year, month);
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

    const labels = match[2]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const entry: ParsedBulkDay = { day, date: isoFromYMD(year, month, day), labels };
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
 */
export function formatRoutineBulkText(
  year: number,
  month: number,
  itemsByDate: Map<string, RoutineItem[]>
): string {
  const total = daysInMonth(year, month);
  const lines: string[] = [];
  for (let day = 1; day <= total; day++) {
    const iso = isoFromYMD(year, month, day);
    const labels = (itemsByDate.get(iso) ?? [])
      .map((it) => it.label ?? "")
      .filter(Boolean);
    lines.push(`${day}. ${labels.join(", ")}`.trimEnd());
  }
  return lines.join("\n");
}
