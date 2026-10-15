"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { categoriesApi } from "@/lib/api";
import type { Category } from "@/types";

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onChanged: () => void;
}

export function CategoryManagerDialog({
  open,
  onOpenChange,
  categories,
  onChanged,
}: CategoryManagerDialogProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6C5CE7");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await categoriesApi.create({ name: newName.trim(), color: newColor });
      setNewName("");
      onChanged();
      toast.success("Categoría creada");
    } catch {
      toast.error("Ya existe una categoría con ese nombre");
    }
  }

  async function handleRename(id: number, name: string) {
    try {
      await categoriesApi.update(id, { name });
      onChanged();
    } catch {
      toast.error("No se pudo renombrar");
    }
  }

  async function handleColorChange(id: number, color: string) {
    try {
      await categoriesApi.update(id, { color });
      onChanged();
    } catch {
      toast.error("No se pudo cambiar el color");
    }
  }

  async function handleDelete(id: number) {
    // Confirmación en dos pasos (clic de nuevo para confirmar) en vez de
    // un confirm() nativo del navegador, coherente con el resto de la UI.
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    try {
      await categoriesApi.remove(id);
      onChanged();
      toast.success("Categoría borrada");
    } catch {
      toast.error("No se puede borrar: tiene tareas registradas");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorías</DialogTitle>
          <DialogDescription>Crea, renombra o recolorea tus categorías.</DialogDescription>
        </DialogHeader>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {categories.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">Aún no hay categorías</li>
          )}
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-1.5">
              <input
                type="color"
                value={c.color ?? "#6C5CE7"}
                onChange={(e) => handleColorChange(c.id, e.target.value)}
                className="size-8 cursor-pointer rounded-md border-0 bg-transparent"
                title="Color de la categoría"
                aria-label={`Color de ${c.name}`}
              />
              <Input
                defaultValue={c.name}
                maxLength={24}
                onBlur={(e) => e.target.value !== c.name && handleRename(c.id, e.target.value)}
                className="flex-1"
                aria-label={`Nombre de la categoría ${c.name}`}
              />
              <Button
                variant="ghost"
                size="icon"
                className={pendingDelete === c.id ? "text-destructive" : "text-muted-foreground"}
                onClick={() => handleDelete(c.id)}
                title={pendingDelete === c.id ? "Pulsa otra vez para confirmar" : "Borrar categoría"}
                aria-label="Borrar categoría"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>

        <Separator className="my-4" />

        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="size-8 cursor-pointer rounded-md border-0 bg-transparent"
            title="Color de la nueva categoría"
            aria-label="Color de la nueva categoría"
          />
          <Input
            placeholder="Nueva categoría"
            maxLength={24}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" title="Crear categoría" aria-label="Crear categoría">
            <Plus className="size-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
