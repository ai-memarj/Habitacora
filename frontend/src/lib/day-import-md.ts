/**
 * Formato de importación masiva del dashboard diario ("Hoy") en Markdown:
 * uno o varios días en un solo archivo, legible y editable a mano (en
 * Obsidian, un editor de texto, etc.) — no es un formato binario ni
 * específico de esta app, es Markdown normal con una convención fija.
 *
 * Un día:
 *
 *   ## 2026-10-13
 *
 *   ### Tareas
 *   - Trabajo: Reunión de equipo (1h30m)
 *   - Deporte: Correr (45m)
 *
 *   ### Sueño
 *   - Dormir: 23:30
 *   - Despertar: 07:15
 *   - Ligero: 55%
 *   - Profundo: 30%
 *   - REM: 15%
 *
 *   ### Frase
 *   > Hoy ha sido un buen día para empezar de nuevo.
 *
 * Reglas (deliberadamente permisivas, en la línea de
 * `routine-bulk-text.ts`): cada día es un encabezado `## YYYY-MM-DD`;
 * dentro, las tres secciones son opcionales y en cualquier orden. Una
 * sección que no aparece ese día no se toca al importar (ni sueño, ni
 * frase, ni tareas) — importar no es "sobrescribir con vacío". El
 * nombre de categoría de cada tarea se resuelve contra las categorías
 * ya existentes (no se crean categorías nuevas desde el importador);
 * una categoría que no exista es un error de esa línea, no bloquea el
 * resto. "Sueño" acepta "Sueno" sin tilde (y cualquier mayúscula/
 * minúscula) para no depender de que el teclado escriba bien la ñ.
 */

export interface ParsedDayTask {
  category: string;
  name: string;
  minutes: number;
}

export interface ParsedDaySleep {
  sleep_time?: string; // "HH:MM", sin segundos (se añaden al llamar a la API)
  wake_time?: string;
  light_pct?: number;
  deep_pct?: number;
  rem_pct?: number;
}

export interface ParsedDayImport {
  date: string; // ISO "YYYY-MM-DD"
  tasks: ParsedDayTask[];
  sleep?: ParsedDaySleep;
  quote?: string;
}

export interface ParseDayImportResult {
  days: ParsedDayImport[];
  errors: string[];
}

const DAY_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const SECTION_RE = /^###\s+(.+)$/;
const TASK_RE = /^-\s*([^:]+):\s*(.+?)\s*\(([^)]+)\)\s*$/;
const SLEEP_FIELD_RE = /^-\s*([A-Za-zÀ-ÿ]+)\s*:\s*(.+)$/;
const QUOTE_LINE_RE = /^>\s?(.*)$/;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DURATION_RE = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?$/i;

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizeWord(s: string): string {
  return stripAccents(s).toLowerCase().trim();
}

function isRealCalendarDate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** "1h30m" / "1h" / "45m" / "90min" -> minutos totales, o null si no se reconoce o es 0. */
export function parseDurationToMinutes(raw: string): number | null {
  const s = raw.trim();
  const match = s.match(DURATION_RE);
  if (!match || (!match[1] && !match[2])) return null;
  const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
  return minutes > 0 ? minutes : null;
}

/** "23:30" -> "23:30" normalizado, o null si no es una hora válida. */
function parseTimeValue(raw: string): string | null {
  const match = raw.trim().match(TIME_RE);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

/** "55%" / "55" -> 55, o null si no está entre 0 y 100. */
function parsePercentValue(raw: string): number | null {
  const n = Number(raw.trim().replace("%", "").trim());
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return n;
}

type Section = "tareas" | "sueno" | "frase" | null;

export function parseDayImportMarkdown(text: string): ParseDayImportResult {
  const days: ParsedDayImport[] = [];
  const errors: string[] = [];

  let current: ParsedDayImport | null = null;
  let section: Section = null;
  let quoteLines: string[] = [];

  function flushQuote() {
    if (current && quoteLines.length > 0) {
      const joined = quoteLines.join(" ").trim();
      if (joined) current.quote = joined;
    }
    quoteLines = [];
  }

  text.split("\n").forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    const dayMatch = trimmed.match(DAY_RE);
    if (dayMatch) {
      flushQuote();
      const iso = dayMatch[1];
      if (!isRealCalendarDate(iso)) {
        errors.push(`Línea ${lineNo}: "${iso}" no es una fecha real`);
        current = null;
        section = null;
        return;
      }
      current = { date: iso, tasks: [] };
      days.push(current);
      section = null;
      return;
    }

    const sectionMatch = trimmed.match(SECTION_RE);
    if (sectionMatch) {
      flushQuote();
      if (!current) {
        errors.push(`Línea ${lineNo}: sección "${sectionMatch[1]}" antes de ningún "## YYYY-MM-DD"`);
        return;
      }
      const normalized = normalizeWord(sectionMatch[1]);
      if (normalized === "tareas") section = "tareas";
      else if (normalized === "sueno") section = "sueno";
      else if (normalized === "frase") section = "frase";
      else {
        errors.push(`Línea ${lineNo}: sección "${sectionMatch[1]}" no reconocida (usa Tareas, Sueño o Frase)`);
        section = null;
      }
      return;
    }

    if (!current) {
      errors.push(`Línea ${lineNo}: contenido fuera de cualquier día ("${trimmed}")`);
      return;
    }

    if (section === "frase") {
      const quoteMatch = trimmed.match(QUOTE_LINE_RE);
      if (!quoteMatch) {
        errors.push(`Línea ${lineNo}: dentro de "Frase" se esperaba una cita con "> " ("${trimmed}")`);
        return;
      }
      quoteLines.push(quoteMatch[1]);
      return;
    }

    if (section === "tareas") {
      const match = trimmed.match(TASK_RE);
      if (!match) {
        errors.push(`Línea ${lineNo}: no reconozco la tarea ("${trimmed}"); formato: "- Categoría: Nombre (1h30m)"`);
        return;
      }
      const [, categoryRaw, nameRaw, durationRaw] = match;
      const minutes = parseDurationToMinutes(durationRaw);
      if (minutes === null) {
        errors.push(`Línea ${lineNo}: duración no reconocida ("${durationRaw.trim()}"); usa "1h30m", "1h" o "45m"`);
        return;
      }
      if (minutes > 24 * 60) {
        errors.push(`Línea ${lineNo}: una tarea no puede durar más de 24h`);
        return;
      }
      current.tasks.push({ category: categoryRaw.trim(), name: nameRaw.trim(), minutes });
      return;
    }

    if (section === "sueno") {
      const match = trimmed.match(SLEEP_FIELD_RE);
      if (!match) {
        errors.push(`Línea ${lineNo}: no reconozco el dato de sueño ("${trimmed}")`);
        return;
      }
      const key = normalizeWord(match[1]);
      const value = match[2].trim();
      current.sleep = current.sleep ?? {};
      if (key === "dormir" || key === "despertar") {
        const time = parseTimeValue(value);
        if (!time) {
          errors.push(`Línea ${lineNo}: hora no reconocida ("${value}"), usa HH:MM`);
          return;
        }
        if (key === "dormir") current.sleep.sleep_time = time;
        else current.sleep.wake_time = time;
      } else if (key === "ligero" || key === "profundo" || key === "rem") {
        const pct = parsePercentValue(value);
        if (pct === null) {
          errors.push(`Línea ${lineNo}: porcentaje no reconocido ("${value}"), debe estar entre 0 y 100`);
          return;
        }
        if (key === "ligero") current.sleep.light_pct = pct;
        else if (key === "profundo") current.sleep.deep_pct = pct;
        else current.sleep.rem_pct = pct;
      } else {
        errors.push(`Línea ${lineNo}: campo de sueño "${match[1]}" no reconocido (Dormir, Despertar, Ligero, Profundo o REM)`);
      }
      return;
    }

    errors.push(`Línea ${lineNo}: contenido fuera de una sección ("### Tareas", "### Sueño" o "### Frase")`);
  });
  flushQuote();

  return { days, errors };
}
