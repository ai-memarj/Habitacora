"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Stamp, X, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routineCycleApi, routinesApi } from "@/lib/api";
import { cycleBalance } from "@/lib/routine-cycle";
import { cn } from "@/lib/utils";
import type { Routine } from "@/types";

interface RoutineCycleEditorProps {
  routine: Routine;
  onChanged: () => void;
  onStamp: () => void;
}

const DEFAULT_COLOR = "#6C5CE7";
const MAX_CYCLE_LENGTH = 366;
const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Un slot del borrador en edición: sin id, porque el ciclo se guarda entero. */
interface DraftSlot {
  activity_id: number;
  day_index: number;
}

export function RoutineCycleEditor({ routine, onChanged, onStamp }: RoutineCycleEditorProps) {
  const [length, setLength] = useState(String(routine.cycle_length ?? 7));
  const [start, setStart] = useState(routine.cycle_start ?? "");
  const [goal, setGoal] = useState(routine.goal_days != null ? String(routine.goal_days) : "");
  const [slots, setSlots] = useState<DraftSlot[]>(
    routine.cycle_slots.map((s) => ({ activity_id: s.activity_id, day_index: s.day_index }))
  );
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Patrón "ajustar estado durante el render" del proyecto (ver
  // CLAUDE.md): cuando llega una rutina nueva de SWR hay que resincronizar
  // el borrador, pero sin useEffect + setState (lint
  // react-hooks/set-state-in-effect).
  const [prevRoutine, setPrevRoutine] = useState(routine);
  if (routine !== prevRoutine) {
    setPrevRoutine(routine);
    setLength(String(routine.cycle_length ?? 7));
    setStart(routine.cycle_start ?? "");
    setGoal(routine.goal_days != null ? String(routine.goal_days) : "");
    setSlots(routine.cycle_slots.map((s) => ({ activity_id: s.activity_id, day_index: s.day_index })));
  }

  const lengthNum = Number(length) || 0;
  const validLength = lengthNum >= 1 && lengthNum <= MAX_CYCLE_LENGTH;

  const activityById = useMemo(
    () => new Map(routine.activities.map((a) => [a.id, a])),
    [routine.activities]
  );

  const balance = useMemo(
    () => cycleBalance(routine.activities, slots),
    [routine.activities, slots]
  );

  /**
   * Un ciclo de 7 días anclado a un lunes ES una plantilla semanal, así
   * que en ese caso las columnas se nombran con los días de la semana en
   * vez de "Día 1..7" — se lee como lo que realmente es.
   */
  const weekdayNames = useMemo(() => {
    if (lengthNum !== 7 || !start) return null;
    const anchor = new Date(start + "T00:00:00");
    const offset = (anchor.getDay() + 6) % 7; // 0 = lunes
    return Array.from({ length: 7 }, (_, i) => WEEKDAYS[(offset + i) % 7]);
  }, [lengthNum, start]);

  function addSlot(dayIndex: number, activityId: number) {
    setSlots((prev) => [...prev, { day_index: dayIndex, activity_id: activityId }]);
    setPickerDay(null);
  }

  function removeSlot(dayIndex: number, nth: number) {
    setSlots((prev) => {
      let visto = -1;
      return prev.filter((s) => {
        if (s.day_index !== dayIndex) return true;
        visto += 1;
        return visto !== nth;
      });
    });
  }

  async function handleSave() {
    if (!validLength) {
      toast.error(`El ciclo debe durar entre 1 y ${MAX_CYCLE_LENGTH} días`);
      return;
    }
    // Un ciclo sin ancla no se puede proyectar sobre el calendario (no se
    // sabe desde qué día contar), así que se exige en cuanto hay patrón.
    if (!start) {
      toast.error("Elige el día en el que empieza el ciclo");
      return;
    }
    setSaving(true);
    try {
      await routineCycleApi.set(routine.id, {
        cycle_length: lengthNum,
        cycle_start: start,
        slots: slots.filter((s) => s.day_index < lengthNum),
      });
      const goalValue = goal.trim() === "" ? null : Number(goal);
      if (goalValue !== routine.goal_days) {
        await routinesApi.update(routine.id, { goal_days: goalValue });
      }
      onChanged();
      toast.success("Patrón guardado");
    } catch {
      toast.error("No se pudo guardar el patrón");
    } finally {
      setSaving(false);
    }
  }

  const sinVocabulario = routine.activities.length === 0;
  const dias = validLength ? Array.from({ length: lengthNum }, (_, i) => i) : [];
  const guardado =
    lengthNum === routine.cycle_length &&
    start === (routine.cycle_start ?? "") &&
    slots.length === routine.cycle_slots.length &&
    goal === (routine.goal_days != null ? String(routine.goal_days) : "");

  return (
    <section>
      <h3 className="text-sm font-semibold">Cómo se reparten</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Un patrón de N días que se repite. Si dura 7 y empieza en lunes, es una plantilla semanal.
        Déjalo sin guardar si prefieres rellenar el calendario a mano día a día.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        <span className="text-muted-foreground">Mi ciclo dura</span>
        <Input
          type="number"
          min={1}
          max={MAX_CYCLE_LENGTH}
          value={length}
          onChange={(e) => setLength(e.target.value.slice(0, 3))}
          className="w-16 text-center"
          aria-label="Días que dura el ciclo"
        />
        <span className="text-muted-foreground">días, empieza el</span>
        <Input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-40"
          aria-label="Día en el que empieza el ciclo"
        />
        <span className="ml-2 text-muted-foreground">Meta (opcional)</span>
        <Input
          type="number"
          min={1}
          placeholder="—"
          value={goal}
          onChange={(e) => setGoal(e.target.value.slice(0, 4))}
          className="w-20"
          title='Días a cumplir, para retos tipo "30 días sin fumar"'
          aria-label="Meta en días"
        />
      </div>

      {sinVocabulario ? (
        <p className="mt-3 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Añade antes alguna actividad arriba: el patrón se construye colocándolas en los días del
          ciclo.
        </p>
      ) : (
        validLength && (
          <div className="mt-3 overflow-x-auto">
            <div
              className="grid min-w-fit gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${Math.min(lengthNum, 7)}, minmax(5.5rem, 1fr))`,
              }}
            >
              {dias.map((dayIndex) => {
                const delDia = slots.filter((s) => s.day_index === dayIndex);
                return (
                  <div
                    key={dayIndex}
                    className="flex min-h-24 flex-col gap-1 rounded-lg border border-border bg-card p-1.5"
                  >
                    <span className="truncate text-[11px] font-semibold text-muted-foreground">
                      {weekdayNames ? weekdayNames[dayIndex] : `Día ${dayIndex + 1}`}
                    </span>

                    {delDia.map((slot, nth) => {
                      const a = activityById.get(slot.activity_id);
                      return (
                        <button
                          key={`${slot.activity_id}-${nth}`}
                          type="button"
                          onClick={() => removeSlot(dayIndex, nth)}
                          className="group flex items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-destructive/15"
                          title={`Quitar ${a?.name ?? "actividad"} de este día`}
                        >
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: a?.color ?? DEFAULT_COLOR }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                            {a?.short_label || a?.name || "?"}
                          </span>
                          <X className="size-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      );
                    })}

                    {pickerDay === dayIndex ? (
                      <div className="mt-auto flex flex-wrap gap-1">
                        {routine.activities.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => addSlot(dayIndex, a.id)}
                            className="rounded px-1 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: a.color ?? DEFAULT_COLOR }}
                            title={a.name}
                          >
                            {a.short_label || a.name.slice(0, 3).toUpperCase()}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPickerDay(null)}
                          className="rounded px-1 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPickerDay(dayIndex)}
                        className="mt-auto flex items-center gap-0.5 self-start rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                        title={`Añadir actividad al día ${dayIndex + 1}`}
                      >
                        <Plus className="size-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* El validador del reparto: evita llevar la cuenta en la cabeza. */}
      {balance.quotaTotal > 0 && (
        <p
          className={cn(
            "mt-2 flex items-center justify-end gap-1.5 text-xs",
            balance.balanced ? "text-emerald-500" : "text-amber-500"
          )}
        >
          {balance.balanced ? (
            <>
              <Check className="size-3.5" />
              cuadra — {balance.placedTotal} de {balance.quotaTotal} repartidas
            </>
          ) : (
            <>
              <AlertTriangle className="size-3.5" />
              {balance.problems.join(", ")}
            </>
          )}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Button onClick={handleSave} disabled={saving || guardado} size="sm">
          <Check className="size-4" />
          Guardar patrón
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onStamp}
          disabled={!routine.cycle_length || !routine.cycle_start || !guardado}
          title={
            !guardado
              ? "Guarda el patrón antes de estamparlo"
              : "Rellenar un mes del calendario con este patrón"
          }
        >
          <Stamp className="size-4" />
          Estampar sobre un mes
        </Button>
      </div>
    </section>
  );
}
