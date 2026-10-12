"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarDay } from "@/lib/date";
import type { RoutineItem, RoutineType } from "@/types";

interface RoutineDayCellProps {
  day: CalendarDay;
  routineType: RoutineType;
  color: string;
  items: RoutineItem[];
  onToggleItem: (item: RoutineItem) => void;
  onDeleteItem: (item: RoutineItem) => void;
  onAddItem: (label: string) => void;
  onToggleSimple: () => void;
}

export function RoutineDayCell({
  day,
  routineType,
  color,
  items,
  onToggleItem,
  onDeleteItem,
  onAddItem,
  onToggleSimple,
}: RoutineDayCellProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function submitDraft() {
    const label = draft.trim();
    if (label) {
      onAddItem(label);
      setDraft("");
      // Dejamos el input abierto: en la rutina de ejemplo se añade más de
      // una inicial por día, así que conviene poder encadenar altas.
    } else {
      setAdding(false);
    }
  }

  const simpleDone = routineType === "simple" && items.some((it) => it.done);

  return (
    <div
      className={cn(
        "group flex min-h-24 flex-col gap-1 border-b border-r border-border p-1.5 sm:min-h-28 sm:p-2",
        !day.inMonth && "bg-muted/30",
        routineType === "simple" && "cursor-pointer"
      )}
      style={simpleDone ? { backgroundColor: `${color}1a` } : undefined}
      onClick={routineType === "simple" ? onToggleSimple : undefined}
      role={routineType === "simple" ? "button" : undefined}
      tabIndex={routineType === "simple" ? 0 : undefined}
      onKeyDown={
        routineType === "simple"
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleSimple();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-semibold sm:text-sm",
            day.inMonth ? "text-foreground" : "text-muted-foreground/60",
            day.isToday && "text-primary",
            simpleDone && "line-through decoration-2 opacity-70"
          )}
        >
          {day.inMonth ? day.day : `${day.day} ${day.monthShort}`}
        </span>
        {day.isToday && <span className="size-1.5 rounded-full bg-primary" />}
      </div>

      {routineType === "checklist" ? (
        <div className="flex flex-1 flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <div
              key={it.id}
              className="group/item flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/60"
            >
              <button
                type="button"
                onClick={() => onToggleItem(it)}
                className={cn(
                  "flex-1 truncate text-left text-xs font-medium sm:text-sm",
                  it.done ? "text-muted-foreground line-through" : "text-foreground"
                )}
              >
                {it.label || "—"}
              </button>
              <button
                type="button"
                onClick={() => onDeleteItem(it)}
                aria-label="Borrar"
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/item:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          {adding ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitDraft();
                } else if (e.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
              onBlur={() => {
                submitDraft();
                setAdding(false);
              }}
              placeholder="Iniciales"
              className="w-full rounded bg-transparent px-1 py-0.5 text-xs outline-none ring-1 ring-primary/40 sm:text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-auto flex items-center gap-0.5 self-start rounded px-1 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-accent/60 hover:text-foreground group-hover:opacity-100 sm:text-xs"
            >
              <Plus className="size-3" />
              Añadir
            </button>
          )}
        </div>
      ) : (
        simpleDone && (
          <div className="flex flex-1 items-center justify-center">
            <div
              className="flex size-7 items-center justify-center rounded-full text-xs font-bold text-white sm:size-8"
              style={{ backgroundColor: color }}
            >
              ✓
            </div>
          </div>
        )
      )}
    </div>
  );
}
