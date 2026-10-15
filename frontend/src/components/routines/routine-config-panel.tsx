"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Separator } from "@/components/ui/separator";
import { RoutineActivitiesPanel } from "@/components/routines/routine-activities-panel";
import { RoutineCycleEditor } from "@/components/routines/routine-cycle-editor";
import type { Routine } from "@/types";

interface RoutineConfigPanelProps {
  routine: Routine;
  open: boolean;
  onChanged: () => void;
  onStamp: () => void;
}

/**
 * El diseño de la rutina: vocabulario + patrón, en la MISMA pantalla que
 * el calendario y plegado por defecto.
 *
 * Es deliberado que no sea un diálogo ni otra ruta: una rutina se diseña
 * mirando su calendario, y lo que se hace el 95% de las veces (tachar)
 * debe seguir siendo un clic sin capas de por medio. Es también lo que
 * permite que no haya tipos de rutina — se rellena lo que haga falta
 * aquí y la rutina toma la forma que le corresponda.
 */
export function RoutineConfigPanel({ routine, open, onChanged, onStamp }: RoutineConfigPanelProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="mb-5 space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <RoutineActivitiesPanel routine={routine} onChanged={onChanged} />
            <Separator />
            <RoutineCycleEditor routine={routine} onChanged={onChanged} onStamp={onStamp} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Una línea con la forma de la rutina, para cuando el panel está plegado. */
export function routineShapeLabel(routine: Routine): string {
  const partes: string[] = [];
  const n = routine.activities.length;
  if (n > 0) partes.push(`${n} actividad${n === 1 ? "" : "es"}`);
  if (routine.cycle_length) {
    const desde = routine.cycle_start
      ? ` desde el ${new Date(routine.cycle_start + "T00:00:00").toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        })}`
      : "";
    partes.push(`ciclo de ${routine.cycle_length} día${routine.cycle_length === 1 ? "" : "s"}${desde}`);
  }
  if (routine.goal_days) partes.push(`meta de ${routine.goal_days} días`);
  return partes.length > 0 ? partes.join(" · ") : "Sin configurar todavía";
}
