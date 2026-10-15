"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Stamp } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { routineItemsApi } from "@/lib/api";
import { buildStampDays } from "@/lib/routine-cycle";
import { daysInMonth, isoFromYMD } from "@/lib/date";
import type { Routine, RoutineItem } from "@/types";

interface RoutineStampDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: Routine;
  year: number;
  month: number; // 0-11
  monthLabel: string;
  itemsByDate: Map<string, RoutineItem[]>;
  onStamped: () => void;
}

export function RoutineStampDialog({
  open,
  onOpenChange,
  routine,
  year,
  month,
  monthLabel,
  itemsByDate,
  onStamped,
}: RoutineStampDialogProps) {
  const [overwrite, setOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Solo el mes natural, no la cuadrícula completa: estampar los días de
  // relleno del mes anterior/siguiente sorprendería al usuario, que está
  // pidiendo "rellena octubre".
  const monthStart = isoFromYMD(year, month, 1);
  const monthEnd = isoFromYMD(year, month, daysInMonth(year, month));

  /** Días del mes que ya tienen algo registrado: estampar los borraría. */
  const ocupados = useMemo(() => {
    const set = new Set<string>();
    for (const [iso, items] of itemsByDate) {
      if (iso >= monthStart && iso <= monthEnd && items.length > 0) set.add(iso);
    }
    return set;
  }, [itemsByDate, monthStart, monthEnd]);

  const days = useMemo(
    () => buildStampDays(routine, monthStart, monthEnd, overwrite ? new Set() : ocupados),
    [routine, monthStart, monthEnd, overwrite, ocupados]
  );

  const conActividades = days.filter((d) => d.activity_ids.length > 0).length;

  async function handleStamp() {
    if (days.length === 0) {
      toast.error("No hay ningún día que rellenar este mes");
      return;
    }
    setSubmitting(true);
    try {
      await routineItemsApi.bulkSet(routine.id, days);
      onStamped();
      onOpenChange(false);
      toast.success(`${conActividades} días rellenados en ${monthLabel}`);
    } catch {
      toast.error("No se pudo estampar el patrón");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="capitalize">Estampar sobre {monthLabel}</DialogTitle>
          <DialogDescription>
            Proyecta el patrón ({routine.cycle_length} días desde el {routine.cycle_start}) sobre
            este mes, creando los días del calendario para que solo tengas que ir tachando.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p>
            Se rellenarán <strong>{conActividades}</strong> días de {monthLabel}.
          </p>

          {ocupados.size > 0 && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
              />
              <span className="text-xs">
                <span className="font-medium text-foreground">
                  Sustituir también los {ocupados.size} días que ya tienen algo
                </span>
                <br />
                <span className="text-muted-foreground">
                  Por defecto esos días no se tocan, para no borrar lo que ya hayas tachado.
                  Marcando esto se reemplazan por lo que diga el patrón y se pierde su estado.
                </span>
              </span>
            </label>
          )}

          <p className="text-xs text-muted-foreground">
            Cambiar el patrón más adelante no reescribe lo ya estampado: el historial se queda
            diciendo lo que de verdad tocaba entonces.
          </p>
        </div>

        <Button onClick={handleStamp} disabled={submitting || days.length === 0} className="mt-3 w-full">
          <Stamp className="size-4" />
          Estampar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
