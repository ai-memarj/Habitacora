"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CalendarDay } from "@/lib/date";
import type { RoutineMode } from "@/lib/routine-cycle";
import type { RoutineActivity, RoutineItem } from "@/types";

interface RoutineDayCellProps {
  day: CalendarDay;
  mode: RoutineMode;
  color: string;
  activities: RoutineActivity[];
  items: RoutineItem[];
  /** Qué tocaría ese día según el patrón, si el día está vacío (pista, no items reales). */
  previstas: RoutineActivity[];
  onToggleItem: (item: RoutineItem) => void;
  onDeleteItem: (item: RoutineItem) => void;
  onAddActivity: (activityId: number) => void;
  onAddLabel: (label: string) => void;
  /** Cicla el día entero entre sin registrar → cumplido → roto (modo reto). */
  onCycleDay: () => void;
  /** Mueve un item a este día (arrastre). `null` si el día no acepta sueltas. */
  onDropItem?: (itemId: number) => void;
}

const DEFAULT_COLOR = "#6C5CE7";

export function RoutineDayCell({
  day,
  mode,
  color,
  activities,
  items,
  previstas,
  onToggleItem,
  onDeleteItem,
  onAddActivity,
  onAddLabel,
  onCycleDay,
  onDropItem,
}: RoutineDayCellProps) {
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const activityById = new Map(activities.map((a) => [a.id, a]));

  // En modo reto el día tiene tres estados y son el día entero, no un
  // item concreto: sin item = sin registrar, done = cumplido, !done =
  // roto explícitamente. Sin esa distinción la racha no sabría si un
  // hueco es un fallo o un día que no se registró.
  const retoItem = mode === "reto" ? items[0] : undefined;
  const retoCumplido = retoItem?.done === true;
  const retoRoto = retoItem != null && !retoItem.done;

  function submitDraft() {
    const label = draft.trim();
    if (label) {
      onAddLabel(label);
      setDraft("");
    } else {
      setPicking(false);
    }
  }

  const esReto = mode === "reto";
  const aceptaSueltas = !esReto && onDropItem != null;

  /** Lee el id que puso `onDragStart`. Devuelve null si lo arrastrado no es un item. */
  function itemIdFrom(e: React.DragEvent): number | null {
    const raw = e.dataTransfer.getData("application/x-habitacora-item");
    const id = Number(raw);
    return raw !== "" && Number.isInteger(id) ? id : null;
  }

  return (
    <div
      className={cn(
        "group flex min-h-24 flex-col gap-1 border-b border-r border-border p-1.5 sm:min-h-28 sm:p-2",
        !day.inMonth && "bg-muted/30",
        esReto && "cursor-pointer",
        retoRoto && "bg-destructive/10",
        dragOver && "ring-2 ring-inset ring-primary"
      )}
      style={retoCumplido ? { backgroundColor: `${color}1a` } : undefined}
      onDragOver={
        aceptaSueltas
          ? (e) => {
              // Sin preventDefault el navegador no considera la celda un
              // destino válido y no dispara onDrop.
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (!dragOver) setDragOver(true);
            }
          : undefined
      }
      onDragLeave={aceptaSueltas ? () => setDragOver(false) : undefined}
      onDrop={
        aceptaSueltas
          ? (e) => {
              e.preventDefault();
              setDragOver(false);
              const id = itemIdFrom(e);
              // Soltar en el mismo día no es un movimiento.
              if (id !== null && !items.some((it) => it.id === id)) onDropItem(id);
            }
          : undefined
      }
      onClick={esReto ? onCycleDay : undefined}
      role={esReto ? "button" : undefined}
      tabIndex={esReto ? 0 : undefined}
      title={
        esReto
          ? retoCumplido
            ? "Cumplido — pulsa para marcar como roto"
            : retoRoto
              ? "Roto — pulsa para dejarlo sin registrar"
              : "Sin registrar — pulsa para marcar como cumplido"
          : undefined
      }
      onKeyDown={
        esReto
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCycleDay();
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
            retoCumplido && "line-through decoration-2 opacity-70"
          )}
        >
          {day.inMonth ? day.day : `${day.day} ${day.monthShort}`}
        </span>
        {day.isToday && <span className="size-1.5 rounded-full bg-primary" />}
      </div>

      {esReto ? (
        <div className="flex flex-1 items-center justify-center">
          {retoCumplido && (
            <div
              className="flex size-7 items-center justify-center rounded-full text-xs font-bold text-white sm:size-8"
              style={{ backgroundColor: color }}
            >
              ✓
            </div>
          )}
          {retoRoto && (
            <div className="flex size-7 items-center justify-center rounded-full bg-destructive/80 text-xs font-bold text-white sm:size-8">
              ✕
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-0.5">
          {items.map((it) => {
            const a = it.activity_id != null ? activityById.get(it.activity_id) : undefined;
            const texto = a?.short_label || a?.name || it.label || "—";
            return (
              <div
                key={it.id}
                draggable={onDropItem != null}
                onDragStart={(e) => {
                  // Tipo propio en vez de "text/plain" para no confundir
                  // una suelta de texto arrastrado de fuera con un item.
                  e.dataTransfer.setData("application/x-habitacora-item", String(it.id));
                  e.dataTransfer.effectAllowed = "move";
                }}
                title={
                  onDropItem != null
                    ? `${a?.name ?? it.label ?? ""} — arrástralo a otro día para moverlo`
                    : undefined
                }
                className={cn(
                  "group/item flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/60",
                  onDropItem != null && "cursor-grab active:cursor-grabbing"
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: a?.color ?? DEFAULT_COLOR,
                    opacity: it.done ? 0.4 : 1,
                  }}
                />
                <button
                  type="button"
                  onClick={() => onToggleItem(it)}
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-xs font-medium sm:text-sm",
                    it.done ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {texto}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteItem(it)}
                  title="Quitar de este día"
                  aria-label="Quitar de este día"
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/item:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}

          {/* Pista de lo que tocaría según el patrón, cuando el día está
              vacío: evita tener que abrir el editor para saber qué toca. */}
          {items.length === 0 && previstas.length > 0 && (
            <div className="flex flex-wrap gap-0.5 opacity-40">
              {previstas.map((a, i) => (
                <button
                  key={`${a.id}-${i}`}
                  type="button"
                  onClick={() => onAddActivity(a.id)}
                  title={`Previsto: ${a.name} — pulsa para registrarlo`}
                  className="rounded border border-dashed border-current px-1 text-[10px] font-medium hover:opacity-100"
                >
                  {a.short_label || a.name.slice(0, 3).toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {picking ? (
            <div className="mt-auto flex flex-wrap gap-0.5">
              {activities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onAddActivity(a.id);
                    setPicking(false);
                  }}
                  className="rounded px-1 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: a.color ?? DEFAULT_COLOR }}
                  title={a.name}
                >
                  {a.short_label || a.name.slice(0, 3).toUpperCase()}
                </button>
              ))}
              {/* Sin vocabulario todavía: se permite texto suelto, para no
                  bloquear a quien aún no ha definido las actividades. */}
              {activities.length === 0 && (
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
                      setPicking(false);
                    }
                  }}
                  onBlur={submitDraft}
                  placeholder="Texto"
                  maxLength={60}
                  className="w-full rounded bg-transparent px-1 py-0.5 text-xs outline-none ring-1 ring-primary/40"
                />
              )}
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="rounded px-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              title="Añadir a este día"
              aria-label="Añadir a este día"
              className="mt-auto flex items-center gap-0.5 self-start rounded px-1 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-accent/60 hover:text-foreground group-hover:opacity-100 sm:text-xs"
            >
              <Plus className="size-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
