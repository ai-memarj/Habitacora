"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routinesApi } from "@/lib/api";

interface RoutineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recibe la rutina creada, para poder llevar al usuario a configurarla. */
  onCreated: (id: number) => void;
}

const DEFAULT_COLOR = "#2563EB";
const NAME_MAX = 60;

/**
 * Crear una rutina pide SOLO nombre y color.
 *
 * Antes había que elegir tipo ("lista por día" / "racha simple") aquí
 * mismo, que es justo cuando menos claro se tiene qué forma va a tener
 * la rutina. Ahora la forma se construye después, en la propia pantalla
 * de la rutina: se le añaden actividades, un ciclo, cupos o una meta
 * según haga falta, y el modo de visualización se deduce de eso (ver
 * `routineMode()` en src/lib/routine-cycle.ts).
 */
export function RoutineFormDialog({ open, onOpenChange, onCreated }: RoutineFormDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const limpio = name.trim();
    if (!limpio) return;
    setSubmitting(true);
    try {
      const creada = await routinesApi.create({ name: limpio, color });
      setName("");
      setColor(DEFAULT_COLOR);
      onOpenChange(false);
      onCreated(creada.id);
    } catch {
      toast.error("No se pudo crear la rutina");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva rutina</DialogTitle>
          <DialogDescription>
            Solo el nombre para empezar. Después, en su propia pantalla, le añades las actividades y
            el patrón: una rotación de productos, un reparto semanal de entrenos o un reto de 30
            días salen todos de ahí.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-9 shrink-0 cursor-pointer rounded-md border-0 bg-transparent"
              title="Color de la rutina"
              aria-label="Color de la rutina"
            />
            <Input
              placeholder="Nombre (p. ej. Rutina capilar, Entrenos)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              className="flex-1"
              autoFocus
            />
          </div>

          <Button type="submit" disabled={submitting || !name.trim()} className="w-full">
            Crear y configurar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
