"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardPaste, Settings2 } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { RoutineDayCell } from "@/components/routines/routine-day-cell";
import { RoutineImportDialog } from "@/components/routines/routine-import-dialog";
import {
  RoutineConfigPanel,
  routineShapeLabel,
} from "@/components/routines/routine-config-panel";
import { RoutineCycleSummary } from "@/components/routines/routine-cycle-summary";
import { RoutineHeaderSummary } from "@/components/routines/routine-header-summary";
import { RoutineStampDialog } from "@/components/routines/routine-stamp-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoutine } from "@/hooks/use-routines";
import { useRoutineItems } from "@/hooks/use-routine-items";
import { routineItemsApi } from "@/lib/api";
import { buildMonthGrid, addMonths, todayISO } from "@/lib/date";
import {
  cycleAlignsWithWeeks,
  cycleDayIndex,
  cycleWindow,
  cycleWindowsInRange,
  quotaTally,
  routineMode,
} from "@/lib/routine-cycle";
import type { RoutineActivity, RoutineItem } from "@/types";

const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DEFAULT_COLOR = "#6C5CE7";

interface RoutineDetailClientProps {
  routineId: number;
}

export function RoutineDetailClient({ routineId }: RoutineDetailClientProps) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [importOpen, setImportOpen] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const { routine, isLoading: routineLoading, mutate: mutateRoutine } = useRoutine(routineId);
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const gridStart = grid[0]?.iso ?? todayISO();
  const gridEnd = grid[grid.length - 1]?.iso ?? todayISO();

  const { items, mutate: mutateItems } = useRoutineItems(routineId, gridStart, gridEnd);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, RoutineItem[]>();
    for (const it of items) {
      const list = map.get(it.date) ?? [];
      list.push(it);
      map.set(it.date, list);
    }
    return map;
  }, [items]);

  const mode = routine ? routineMode(routine) : "pauta";

  /** Qué actividad toca cada día del ciclo, para la pista de los días vacíos. */
  const previstasPorDiaDeCiclo = useMemo(() => {
    const map = new Map<number, RoutineActivity[]>();
    if (!routine) return map;
    const porId = new Map(routine.activities.map((a) => [a.id, a]));
    for (const slot of [...routine.cycle_slots].sort((a, b) => a.position - b.position)) {
      const a = porId.get(slot.activity_id);
      if (!a) continue;
      const lista = map.get(slot.day_index) ?? [];
      lista.push(a);
      map.set(slot.day_index, lista);
    }
    return map;
  }, [routine]);

  function previstasDe(iso: string): RoutineActivity[] {
    if (!routine) return [];
    const idx = cycleDayIndex(routine, iso);
    return idx === null ? [] : (previstasPorDiaDeCiclo.get(idx) ?? []);
  }

  function goToMonth(delta: number) {
    const next = addMonths(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  async function handleAddActivity(date: string, activityId: number) {
    try {
      await routineItemsApi.create(routineId, { date, activity_id: activityId });
      mutateItems();
    } catch {
      toast.error("No se pudo añadir");
    }
  }

  async function handleAddLabel(date: string, label: string) {
    try {
      await routineItemsApi.create(routineId, { date, label });
      mutateItems();
    } catch {
      toast.error("No se pudo añadir");
    }
  }

  async function handleToggleItem(item: RoutineItem) {
    try {
      await routineItemsApi.update(item.id, { done: !item.done });
      mutateItems();
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  async function handleDeleteItem(item: RoutineItem) {
    try {
      await routineItemsApi.remove(item.id);
      mutateItems();
    } catch {
      toast.error("No se pudo borrar");
    }
  }

  /**
   * Modo reto: el día entero cicla entre los tres estados. Crear el item
   * con la primera actividad del vocabulario si la hay (así el día queda
   * identificado), o sin ninguna si la rutina no tiene vocabulario.
   */
  async function handleCycleDay(date: string) {
    const existing = (itemsByDate.get(date) ?? [])[0];
    try {
      if (!existing) {
        const activityId = routine?.activities[0]?.id ?? null;
        await routineItemsApi.create(routineId, { date, activity_id: activityId, done: true });
      } else if (existing.done) {
        await routineItemsApi.update(existing.id, { done: false });
      } else {
        await routineItemsApi.remove(existing.id);
      }
      mutateItems();
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  // Resumen de cupos: si el ciclo dura 7 días y empieza en lunes, cada
  // repetición coincide con una fila del calendario y el resumen va al
  // final de su propia fila (columna extra). Si no, no hay alineación
  // posible y va en una tira debajo.
  const alineado = routine ? cycleAlignsWithWeeks(routine) : false;
  const mostrarCupos = routine != null && mode === "cupo";
  const ventanas = useMemo(
    () => (routine && mostrarCupos ? cycleWindowsInRange(routine, gridStart, gridEnd) : []),
    [routine, mostrarCupos, gridStart, gridEnd]
  );

  const filas = useMemo(() => {
    const out: typeof grid[] = [];
    for (let i = 0; i < grid.length; i += 7) out.push(grid.slice(i, i + 7));
    return out;
  }, [grid]);

  const conColumnaResumen = mostrarCupos && alineado;

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <main className="mx-auto max-w-6xl px-5 pt-6 sm:px-8">
        <Link
          href="/routines"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Rutinas
        </Link>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {routineLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <div className="flex items-center gap-2.5">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: routine?.color ?? DEFAULT_COLOR }}
              />
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{routine?.name}</h1>
            </div>
          )}

          <Button
            variant={configOpen ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => setConfigOpen((v) => !v)}
            title="Diseñar esta rutina: actividades, ciclo, cupos y meta"
            aria-label="Configurar rutina"
          >
            <Settings2 className="size-3.5" />
            Configurar
          </Button>
        </div>

        {routine && (
          <>
            {!configOpen && (
              <button
                type="button"
                onClick={() => setConfigOpen(true)}
                className="mb-4 block text-left text-xs text-muted-foreground hover:text-foreground"
                title="Abrir la configuración de esta rutina"
              >
                ▸ {routineShapeLabel(routine)}
              </button>
            )}

            <RoutineConfigPanel
              routine={routine}
              open={configOpen}
              onChanged={mutateRoutine}
              onStamp={() => setStampOpen(true)}
            />

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <RoutineHeaderSummary routine={routine} items={items} monthLabel={monthLabel} />

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => goToMonth(-1)}
                  title="Mes anterior"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="w-36 text-center text-sm font-medium capitalize">{monthLabel}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => goToMonth(1)}
                  title="Mes siguiente"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
                {mode !== "reto" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-1 h-8"
                    onClick={() => setImportOpen(true)}
                    title="Pegar un mes entero como texto"
                  >
                    <ClipboardPaste className="size-3.5" />
                    Importar
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border-l border-t border-border shadow-sm">
              <div
                className="grid bg-primary text-primary-foreground"
                style={{
                  gridTemplateColumns: conColumnaResumen
                    ? "repeat(7, minmax(0, 1fr)) minmax(8rem, 0.9fr)"
                    : "repeat(7, minmax(0, 1fr))",
                }}
              >
                {WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    className="border-b border-r border-primary-foreground/10 px-2 py-2 text-center text-xs font-semibold sm:text-sm"
                  >
                    {w}
                  </div>
                ))}
                {conColumnaResumen && (
                  <div className="border-b border-r border-primary-foreground/10 px-2 py-2 text-center text-xs font-semibold sm:text-sm">
                    Ciclo
                  </div>
                )}
              </div>

              <div
                className="grid bg-card"
                style={{
                  gridTemplateColumns: conColumnaResumen
                    ? "repeat(7, minmax(0, 1fr)) minmax(8rem, 0.9fr)"
                    : "repeat(7, minmax(0, 1fr))",
                }}
              >
                {filas.map((fila, filaIdx) => (
                  <RowFragment key={fila[0]?.iso ?? filaIdx}>
                    {fila.map((day) => (
                      <RoutineDayCell
                        key={day.iso}
                        day={day}
                        mode={mode}
                        color={routine.color ?? DEFAULT_COLOR}
                        activities={routine.activities}
                        items={itemsByDate.get(day.iso) ?? []}
                        previstas={previstasDe(day.iso)}
                        onToggleItem={handleToggleItem}
                        onDeleteItem={handleDeleteItem}
                        onAddActivity={(activityId) => handleAddActivity(day.iso, activityId)}
                        onAddLabel={(label) => handleAddLabel(day.iso, label)}
                        onCycleDay={() => handleCycleDay(day.iso)}
                      />
                    ))}
                    {conColumnaResumen &&
                      (() => {
                        // Con el ciclo alineado, la fila ES una ventana.
                        const w = cycleWindow(
                          routine,
                          cycleWindowsInRange(routine, fila[0].iso, fila[0].iso)[0]?.index ?? 0
                        );
                        if (!w) return <div className="border-b border-r border-border" />;
                        return (
                          <RoutineCycleSummary
                            compact
                            tally={quotaTally(routine, items, w)}
                            label={`Ciclo ${w.index + 1}`}
                          />
                        );
                      })()}
                  </RowFragment>
                ))}
              </div>
            </div>

            {/* Ciclo no alineado con las semanas: el resumen no puede ir en
                la cuadrícula, así que va aquí debajo. */}
            {mostrarCupos && !alineado && ventanas.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ventanas.map((w) => (
                  <RoutineCycleSummary
                    key={w.index}
                    tally={quotaTally(routine, items, w)}
                    label={`${formatCorto(w.startISO)} – ${formatCorto(w.endISO)}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {routine && mode !== "reto" && (
        <RoutineImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          routine={routine}
          year={year}
          month={month}
          monthLabel={monthLabel}
          itemsByDate={itemsByDate}
          onImported={mutateItems}
        />
      )}

      {routine && (
        <RoutineStampDialog
          open={stampOpen}
          onOpenChange={setStampOpen}
          routine={routine}
          year={year}
          month={month}
          monthLabel={monthLabel}
          itemsByDate={itemsByDate}
          onStamped={mutateItems}
        />
      )}
    </div>
  );
}

/**
 * Las celdas de una fila van como hijas directas del mismo `grid`, así
 * que la fila no puede ser un `<div>` envolvente (rompería la
 * cuadrícula): se agrupan en un fragmento.
 */
function RowFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function formatCorto(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}
