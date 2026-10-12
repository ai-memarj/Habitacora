import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind de forma segura (resuelve conflictos,
 * p. ej. "p-2 p-4" -> "p-4"). Convención estándar en todo el ecosistema
 * shadcn/ui — la usaremos en cada componente de UI.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
