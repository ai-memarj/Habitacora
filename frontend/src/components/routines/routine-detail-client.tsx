"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardPaste } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { RoutineDayCell } from "@/components/routines/routine-day-cell";
import { RoutineImportDialog } from "@/components/routines/routine-import-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoutine } from "@/hooks/use-routines";
import { useRoutineItems } from "@/hooks/use-routine-items";
import { routineItemsApi } from "@/lib/api";
import { buildMonthGrid, addMonths, todayISO } from "@/lib/date";
import type { RoutineItem } from "@/types";

const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

interface RoutineDetailClientProps {
  routineId: number;
}

export function RoutineDetailClient({ routineId }: RoutineDetailClientProps) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [importOpen, setImportOpen] = useState(false);

  const { routine, isLoading: routineLoading } = useRoutine(routineId);
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

  function goToMonth(delta: number) {
    const next = addMonths(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  async function handleAddItem(date: string, label: string) {
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

  async function handleToggleSimple(date: string) {
    const existing = (itemsByDate.get(date) ?? [])[0];
    try {
      if (existing) {
        await routineItemsApi.update(existing.id, { done: !existing.done });
      } else {
        await routineItemsApi.create(routineId, { date });
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

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <main className="mx-auto max-w-5xl px-5 pt-6 sm:px-8">
        <Link
          href="/routines"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Rutinas
        </Link>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {routineLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <div className="flex items-center gap-2.5">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: routine?.color ?? "#6C5CE7" }}
              />
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{routine?.name}</h1>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="size-8" onClick={() => goToMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-36 text-center text-sm font-medium capitalize">{monthLabel}</span>
            <Button variant="outline" size="icon" className="size-8" onClick={() => goToMonth(1)} aria-label="Mes siguiente">
              <ChevronRight className="size-4" />
            </Button>
            {routine?.type === "checklist" && (
              <Button
                variant="outline"
                size="sm"
                className="ml-1 h-8"
                onClick={() => setImportOpen(true)}
              >
                <ClipboardPaste className="size-3.5" />
                Importar
              </Button>
            )}
          </div>
        </div>

        {routine && (
          <div className="overflow-hidden rounded-xl border-l border-t border-border shadow-sm">
            <div className="grid grid-cols-7 bg-primary text-primary-foreground">
              {WEEKDAYS.map((w) => (
                <div key={w} className="border-b border-r border-primary-foreground/10 px-2 py-2 text-center text-xs font-semibold sm:text-sm">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 bg-card">
              {grid.map((day) => (
                <RoutineDayCell
                  key={day.iso}
                  day={day}
                  routineType={routine.type}
                  color={routine.color ?? "#6C5CE7"}
                  items={itemsByDate.get(day.iso) ?? []}
                  onToggleItem={handleToggleItem}
                  onDeleteItem={handleDeleteItem}
                  onAddItem={(label) => handleAddItem(day.iso, label)}
                  onToggleSimple={() => handleToggleSimple(day.iso)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {routine && routine.type === "checklist" && (
        <RoutineImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          routineId={routineId}
          year={year}
          month={month}
          monthLabel={monthLabel}
          itemsByDate={itemsByDate}
          onImported={mutateItems}
        />
      )}
    </div>
  );
}
