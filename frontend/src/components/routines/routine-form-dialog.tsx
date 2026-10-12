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
import { cn } from "@/lib/utils";
import { routinesApi } from "@/lib/api";
import type { RoutineType } from "@/types";

interface RoutineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const TYPE_OPTIONS: { value: RoutineType; label: string; hint: string }[] = [
  {
    value: "checklist",
    label: "Lista por día",
    hint: 'Varias iniciales por día, se tachan una a una (p. ej. una rutina capilar: "V-M", "F-K"...)',
  },
  {
    value: "simple",
    label: "Racha simple",
    hint: 'Un único check por día (p. ej. "no fumar", "meditar")',
  },
];

const DEFAULT_COLOR = "#2563EB";

export function RoutineFormDialog({ open, onOpenChange, onCreated }: RoutineFormDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<RoutineType>("checklist");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await routinesApi.create({ name: name.trim(), type, color });
      setName("");
      setType("checklist");
      setColor(DEFAULT_COLOR);
      onOpenChange(false);
      onCreated();
      toast.success("Rutina creada");
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
          <DialogDescription>Un calendario para seguir un hábito día a día.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-9 shrink-0 cursor-pointer rounded-md border-0 bg-transparent"
              aria-label="Color de la rutina"
            />
            <Input
              placeholder="Nombre (p. ej. Rutina capilar)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1"
              autoFocus
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  type === opt.value
                    ? "border-primary/50 bg-primary/10"
                    : "border-border hover:bg-accent/50"
                )}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{opt.hint}</p>
              </button>
            ))}
          </div>

          <Button type="submit" disabled={submitting || !name.trim()} className="w-full">
            Crear rutina
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
