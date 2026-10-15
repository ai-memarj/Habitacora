"use client";

import { Flame, Target, CalendarCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  routineMode,
  cycleWindow,
  cycleWindowIndex,
  quotaTally,
  streakInfo,
} from "@/lib/routine-cycle";
import { todayISO } from "@/lib/date";
import type { Routine, RoutineItem } from "@/types";

interface RoutineHeaderSummaryProps {
  routine: Routine;
  /** Items del mes visible. En modo reto se usan para la racha. */
  items: RoutineItem[];
  monthLabel: string;
}

/**
 * La línea de "dónde estás" de una rutina.
 *
 * No hay tres cabeceras distintas: es una sola que muestra lo que
 * aplique según lo que el usuario haya rellenado (ver `routineMode()`).
 * Con meta sale el progreso y la racha; con cupos, el estado del ciclo
 * actual; sin ninguno de los dos, cuántos días del mes se han cumplido.
 */
export function RoutineHeaderSummary({ routine, items, monthLabel }: RoutineHeaderSummaryProps) {
  const mode = routineMode(routine);

  if (mode === "reto") {
    const { current, best, doneTotal } = streakInfo(items);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {routine.goal_days != null && (
          <Badge variant="soft" className="gap-1">
            <Target className="size-3" />
            Día {Math.min(doneTotal, routine.goal_days)} de {routine.goal_days}
          </Badge>
        )}
        <Badge variant="soft" className="gap-1">
          <Flame className="size-3" />
          racha {current}
        </Badge>
        {best > current && <Badge variant="soft">mejor {best}</Badge>}
      </div>
    );
  }

  if (mode === "cupo") {
    // La ventana "actual" es la de hoy; si hoy cae fuera del mes que se
    // está mirando, se muestra la primera ventana del mes visible, que es
    // lo que el usuario tiene delante.
    const hoy = todayISO();
    const idxHoy = cycleWindowIndex(routine, hoy);
    const idxVisible =
      items.length > 0 ? cycleWindowIndex(routine, items[0].date) : idxHoy;
    const dentroDelMes = items.some((it) => it.date === hoy);
    const idx = dentroDelMes ? idxHoy : (idxVisible ?? idxHoy);
    if (idx === null) return null;

    const window = cycleWindow(routine, idx);
    if (!window) return null;
    const tally = quotaTally(routine, items, window);
    if (tally.rows.length === 0) return null;

    const pendientes = tally.rows.filter((r) => r.done < r.quota);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="soft" className="gap-1">
          <CalendarCheck className="size-3" />
          Ciclo del {formatCorto(window.startISO)} · {tally.doneTotal}/{tally.quotaTotal}
        </Badge>
        {pendientes.length > 0 && (
          <span className="text-xs text-muted-foreground">
            falta{pendientes.length > 1 ? "n" : ""}{" "}
            {pendientes
              .map((r) => r.activity.short_label || r.activity.name)
              .join(", ")}
          </span>
        )}
      </div>
    );
  }

  // Pauta: cuántos de los días planificados del mes se han cumplido.
  const total = items.length;
  const hechos = items.filter((it) => it.done).length;
  if (total === 0) return null;
  return (
    <Badge variant="soft" className="gap-1 capitalize">
      <CalendarCheck className="size-3" />
      {monthLabel} · {hechos}/{total} cumplidos
    </Badge>
  );
}

function formatCorto(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}
