"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routineActivitiesApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Routine, RoutineActivity } from "@/types";

interface RoutineActivitiesPanelProps {
  routine: Routine;
  /** Revalida la rutina (las actividades vienen anidadas en ella). */
  onChanged: () => void;
}

const DEFAULT_COLOR = "#6C5CE7";
/** `short_label` se pinta dentro de una celda del calendario: 8 es lo que entra sin romper. */
const SHORT_MAX = 8;
const NAME_MAX = 40;

/** Iniciales automáticas a partir del nombre: "Carrera continua" -> "CAR". */
function suggestShort(name: string): string {
  const limpio = name.trim();
  if (!limpio) return "";
  const palabras = limpio.split(/\s+/);
  if (palabras.length === 1) return palabras[0].slice(0, 3).toUpperCase();
  return palabras
    .slice(0, SHORT_MAX)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, SHORT_MAX);
}

export function RoutineActivitiesPanel({ routine, onChanged }: RoutineActivitiesPanelProps) {
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [quota, setQuota] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Si el usuario no toca las iniciales, se rellenan solas desde el
  // nombre; en cuanto las edita a mano, se respetan.
  const [shortTouched, setShortTouched] = useState(false);
  const shortValue = shortTouched ? short : suggestShort(name);

  function resetForm() {
    setName("");
    setShort("");
    setShortTouched(false);
    setColor(DEFAULT_COLOR);
    setQuota("");
    setEditingId(null);
  }

  function startEdit(activity: RoutineActivity) {
    setEditingId(activity.id);
    setName(activity.name);
    setShort(activity.short_label ?? "");
    setShortTouched(true);
    setColor(activity.color ?? DEFAULT_COLOR);
    setQuota(activity.quota != null ? String(activity.quota) : "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const limpio = name.trim();
    if (!limpio) return;
    setSubmitting(true);
    // Cupo vacío = sin cupo (null), no 0 — son cosas distintas: "no
    // cuenta para el reparto" frente a "hazlo cero veces".
    const quotaValue = quota.trim() === "" ? null : Number(quota);
    try {
      if (editingId !== null) {
        await routineActivitiesApi.update(editingId, {
          name: limpio,
          short_label: shortValue || null,
          color,
          quota: quotaValue,
        });
      } else {
        await routineActivitiesApi.create(routine.id, {
          name: limpio,
          short_label: shortValue || null,
          color,
          quota: quotaValue,
        });
      }
      resetForm();
      onChanged();
    } catch {
      toast.error(editingId !== null ? "No se pudo guardar" : "No se pudo añadir");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(activity: RoutineActivity) {
    // Confirmación en dos pasos, igual que el gestor de categorías.
    if (pendingDeleteId !== activity.id) {
      setPendingDeleteId(activity.id);
      return;
    }
    try {
      await routineActivitiesApi.remove(activity.id);
      if (editingId === activity.id) resetForm();
      onChanged();
    } catch (err) {
      // El backend explica por qué no se puede (días registrados), y ese
      // mensaje es más útil que uno genérico.
      const detail =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        "No se pudo borrar";
      toast.error(detail);
    } finally {
      setPendingDeleteId(null);
    }
  }

  const quotaTotal = routine.activities.reduce((acc, a) => acc + (a.quota ?? 0), 0);

  return (
    <section>
      <h3 className="text-sm font-semibold">Qué hago en esta rutina</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Las cosas concretas que se repiten. Las iniciales son lo que se ve en el calendario. El cupo
        es opcional: cuántas veces por ciclo (déjalo vacío si no quieres llevar la cuenta).
      </p>

      {routine.activities.length > 0 && (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {routine.activities.map((a) => (
            <li
              key={a.id}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2",
                editingId === a.id && "bg-primary/10"
              )}
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                style={{ backgroundColor: a.color ?? DEFAULT_COLOR }}
              >
                {a.short_label || a.name.slice(0, 3).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
              {a.quota != null && (
                <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {a.quota}× por ciclo
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground"
                onClick={() => startEdit(a)}
                title={`Editar ${a.name}`}
                aria-label={`Editar ${a.name}`}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-7 shrink-0",
                  pendingDeleteId === a.id ? "text-destructive" : "text-muted-foreground"
                )}
                onClick={() => handleDelete(a)}
                title={pendingDeleteId === a.id ? "Pulsa otra vez para confirmar" : `Borrar ${a.name}`}
                aria-label={`Borrar ${a.name}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border-0 bg-transparent"
          title="Color de la actividad"
          aria-label="Color de la actividad"
        />
        <Input
          placeholder="Nombre (p. ej. Carrera continua)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          className="min-w-44 flex-1"
        />
        <Input
          placeholder="INI"
          value={shortValue}
          onChange={(e) => {
            setShortTouched(true);
            setShort(e.target.value);
          }}
          maxLength={SHORT_MAX}
          className="w-20 text-center uppercase"
          title="Iniciales que se ven en el calendario"
          aria-label="Iniciales"
        />
        <Input
          type="number"
          min={1}
          placeholder="Cupo"
          value={quota}
          // `maxLength` no funciona en inputs numéricos (ver CLAUDE.md):
          // se recorta en el onChange, igual que las horas de las tareas.
          onChange={(e) => setQuota(e.target.value.slice(0, 2))}
          className="w-20"
          title="Veces por ciclo (opcional)"
          aria-label="Cupo por ciclo"
        />
        <Button type="submit" size="icon" disabled={submitting || !name.trim()} title={editingId !== null ? "Guardar cambios" : "Añadir actividad"} aria-label={editingId !== null ? "Guardar cambios" : "Añadir actividad"}>
          {editingId !== null ? <Check className="size-4" /> : <Plus className="size-4" />}
        </Button>
        {editingId !== null && (
          <Button type="button" variant="ghost" size="icon" onClick={resetForm} title="Cancelar edición" aria-label="Cancelar edición">
            <X className="size-4" />
          </Button>
        )}
      </form>

      {quotaTotal > 0 && (
        <p className="mt-2 text-right text-xs text-muted-foreground">
          {quotaTotal} por ciclo en total
        </p>
      )}
    </section>
  );
}
