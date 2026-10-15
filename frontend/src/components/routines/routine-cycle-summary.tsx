"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { QuotaTally } from "@/lib/routine-cycle";

interface RoutineCycleSummaryProps {
  tally: QuotaTally;
  /** Etiqueta de la ventana: "Semana 1", "12–18 oct"... */
  label: string;
  /** `compact` = va dentro de la cuadrícula (columna extra); si no, en una tira debajo. */
  compact?: boolean;
  className?: string;
}

const DEFAULT_COLOR = "#6C5CE7";

/**
 * Lo hecho frente al cupo en una repetición del ciclo.
 *
 * Se cuenta por ventana de ciclo y no por día a propósito: si el plan
 * decía boxeo el martes y lo hiciste el miércoles, has cumplido. Pintar
 * un hueco el martes y un extra el miércoles serían dos errores donde no
 * hubo ninguno.
 */
export function RoutineCycleSummary({ tally, label, compact, className }: RoutineCycleSummaryProps) {
  if (tally.rows.length === 0) return null;

  const completa = tally.doneTotal >= tally.quotaTotal;

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        compact ? "border-b border-r border-border p-1.5" : "rounded-lg border border-border p-2.5",
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-semibold text-muted-foreground">{label}</span>
        <span
          className={cn(
            "shrink-0 text-xs font-bold tabular-nums",
            completa ? "text-emerald-500" : "text-foreground"
          )}
        >
          {tally.doneTotal}/{tally.quotaTotal}
        </span>
      </div>

      <div className={cn("flex flex-wrap gap-1", compact ? "gap-0.5" : "gap-1.5")}>
        {tally.rows.map((row) => {
          const cumplido = row.done >= row.quota;
          const extra = row.done - row.quota;
          return (
            <span
              key={row.activity.id}
              className={cn(
                "flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium tabular-nums",
                cumplido ? "bg-emerald-500/15 text-emerald-500" : "bg-accent text-muted-foreground"
              )}
              title={`${row.activity.name}: ${row.done} de ${row.quota}${
                extra > 0 ? ` (${extra} de más)` : ""
              }`}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.activity.color ?? DEFAULT_COLOR }}
              />
              {row.activity.short_label || row.activity.name.slice(0, 3).toUpperCase()}{" "}
              {row.done}/{row.quota}
              {/* Hacer de más no se regaña: se muestra como extra. */}
              {extra > 0 && <span className="opacity-70">+{extra}</span>}
              {cumplido && extra <= 0 && <Check className="size-2.5" />}
            </span>
          );
        })}
      </div>
    </div>
  );
}
