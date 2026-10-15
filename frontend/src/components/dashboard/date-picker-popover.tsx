"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildMonthGrid, addMonths, todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

interface DatePickerPopoverProps {
  date: string; // fecha seleccionada, ISO "YYYY-MM-DD"
  onDateChange: (date: string) => void;
}

const WEEKDAY_INITIALS = ["L", "M", "X", "J", "V", "S", "D"];

function formatShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/**
 * Sustituye el `<input type="date">` nativo (look de formulario, distinto
 * del resto de la estética glass/oscura) por un botón + mini calendario
 * propio, reutilizando `buildMonthGrid`/`addMonths` de `lib/date.ts` (las
 * mismas utilidades del calendario de Rutinas). No usa Radix Popover: el
 * cierre al hacer click fuera se gestiona a mano con un listener en
 * `mousedown`, que es la única razón legítima de `useEffect` aquí (un
 * listener de evento del DOM, no una sincronización de estado con props).
 */
export function DatePickerPopover({ date, onDateChange }: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date(date + "T00:00:00").getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date(date + "T00:00:00").getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function openPopover() {
    const d = new Date(date + "T00:00:00");
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(true);
  }

  function goMonth(delta: number) {
    const next = addMonths(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  const grid = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 px-2.5 text-xs capitalize sm:text-sm"
        onClick={() => (open ? setOpen(false) : openPopover())}
      >
        <CalendarDays className="size-3.5" />
        {formatShort(date)}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded-lg border border-border bg-popover p-2.5 text-popover-foreground shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon" className="size-6" onClick={() => goMonth(-1)} title="Mes anterior" aria-label="Mes anterior">
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="text-xs font-medium capitalize">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => goMonth(1)} title="Mes siguiente" aria-label="Mes siguiente">
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
            {WEEKDAY_INITIALS.map((w, i) => (
              <span key={`${w}-${i}`}>{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 pt-1">
            {grid.map((day) => (
              <button
                key={day.iso}
                type="button"
                onClick={() => {
                  onDateChange(day.iso);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md text-xs transition-colors",
                  day.inMonth ? "text-foreground hover:bg-accent" : "text-muted-foreground/40 hover:bg-accent/50",
                  day.iso === date && "bg-primary text-primary-foreground hover:bg-primary",
                  day.isToday && day.iso !== date && "ring-1 ring-inset ring-primary/50"
                )}
              >
                {day.day}
              </button>
            ))}
          </div>

          <div className="mt-2 flex justify-center border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                onDateChange(todayISO());
                setOpen(false);
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Hoy ({formatShort(todayISO())})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
