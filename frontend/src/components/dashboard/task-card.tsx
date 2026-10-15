"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Settings2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tasksApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Category, DaySummary, Task } from "@/types";

// Mismo estilo "sin caja" (solo línea inferior) que ya usa la tarjeta
// Frase+Sueño (`today-card.tsx`) — unifica el lenguaje visual del
// dashboard de Hoy en vez de dejar esta fila con el recuadro con borde
// que tenían todos los campos antes de ese rediseño.
// Cubre tanto el Input (usa :focus-visible) como el SelectTrigger (usa
// :focus) — así el anillo de foco por defecto de ambos queda anulado
// igual y el único indicador de foco es el cambio de color del borde.
const fieldClass =
  "rounded-none border-0 border-b border-input bg-transparent px-0 shadow-none " +
  "focus:ring-0 focus:border-primary " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

interface TaskCardProps {
  date: string;
  summary: DaySummary | undefined;
  isLoading: boolean;
  categories: Category[];
  onChanged: () => void; // revalida summary + streak tras un cambio
  onManageCategories: () => void;
}

export function TaskCard({
  date,
  summary,
  isLoading,
  categories,
  onChanged,
  onManageCategories,
}: TaskCardProps) {
  const [name, setName] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [justAddedId, setJustAddedId] = useState<number | null>(null);
  const justAddedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (justAddedTimeout.current) clearTimeout(justAddedTimeout.current);
    };
  }, []);

  const tasks = summary?.tasks ?? [];
  const totalMinutes = summary?.total_minutes ?? 0;
  const totalLabel =
    totalMinutes < 60
      ? `${totalMinutes} min`
      : `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 ? ` ${totalMinutes % 60}min` : ""}`;

  const breakdown = Object.values(
    tasks.reduce<Record<number, { name: string; color: string; minutes: number }>>((acc, t) => {
      const key = t.category.id;
      if (!acc[key]) {
        acc[key] = { name: t.category.name, color: t.category.color || "#8884d8", minutes: 0 };
      }
      acc[key].minutes += t.minutes;
      return acc;
    }, {})
  ).sort((a, b) => b.minutes - a.minutes);

  function startEdit(t: Task) {
    setPendingDeleteId(null);
    setEditingId(t.id);
    setCategoryId(t.category.id.toString());
    setName(t.name);
    const h = Math.floor(t.minutes / 60);
    const m = t.minutes % 60;
    setHours(h ? String(h) : "");
    setMinutes(m ? String(m) : "");
    // Si la lista es larga, el formulario de arriba puede quedar fuera
    // de la vista cuando se hace click en una tarea más abajo.
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setHours("");
    setMinutes("");
    setCategoryId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cat = categoryId || categories[0]?.id.toString();
    const durationMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    if (!name.trim() || durationMinutes <= 0 || !cat) return;

    setSubmitting(true);
    try {
      if (editingId) {
        await tasksApi.update(editingId, {
          name: name.trim(),
          minutes: durationMinutes,
          category_id: Number(cat),
        });
        setEditingId(null);
        setName("");
        setHours("");
        setMinutes("");
        onChanged();
      } else {
        const created = await tasksApi.create({
          date,
          name: name.trim(),
          minutes: durationMinutes,
          category_id: Number(cat),
        });
        setName("");
        setHours("");
        setMinutes("");
        onChanged();
        if (justAddedTimeout.current) clearTimeout(justAddedTimeout.current);
        setJustAddedId(created.id);
        justAddedTimeout.current = setTimeout(() => setJustAddedId(null), 1500);
      }
    } catch {
      toast.error(editingId ? "No se pudo actualizar la tarea" : "No se pudo añadir la tarea");
    } finally {
      setSubmitting(false);
    }
  }

  // Confirmación en dos pasos (clic de nuevo para confirmar) en vez de un
  // confirm() nativo — mismo patrón que category-manager-dialog.tsx. Las
  // tareas son el registro diario real (uso terapéutico, ver CLAUDE.md),
  // así que un borrado accidental de un clic sale más caro que en otras
  // entidades de la app.
  function handleDeleteClick(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      return;
    }
    handleDelete(id);
  }

  async function handleDelete(id: number) {
    try {
      await tasksApi.remove(id);
      if (editingId === id) cancelEdit();
      onChanged();
      toast.success("Tarea borrada");
    } catch {
      toast.error("No se pudo borrar la tarea");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Tareas de hoy</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="soft">{totalLabel}</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={onManageCategories}
            title="Gestionar categorías"
            aria-label="Gestionar categorías"
          >
            <Settings2 className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no tienes ninguna categoría — necesitas al menos una para registrar tareas.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onManageCategories}>
              <Plus className="size-3.5" />
              Crear categoría
            </Button>
          </div>
        ) : (
          <>
            {editingId && (
              <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-1.5 text-xs text-primary">
                <span>Editando tarea</span>
                <button type="button" onClick={cancelEdit} className="font-medium hover:underline">
                  Cancelar
                </button>
              </div>
            )}
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1 min-w-0">
                <Select value={categoryId || categories[0]?.id.toString()} onValueChange={setCategoryId}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: c.color ?? undefined }}
                          />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                id="task-name-input"
                placeholder="Nombre de la tarea"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    document.getElementById("task-hours-input")?.focus();
                  }
                }}
                className={cn(fieldClass, "flex-[2] min-w-0")}
              />
              <div className="flex items-center gap-1.5">
                <Input
                  id="task-hours-input"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value.slice(0, 2))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      document.getElementById("task-minutes-input")?.focus();
                    }
                  }}
                  className={cn(fieldClass, "w-10 text-center")}
                  aria-label="Horas dedicadas"
                />
                <span className="text-xs text-muted-foreground">h</span>
                <Input
                  id="task-minutes-input"
                  type="number"
                  min={0}
                  max={59}
                  placeholder="0"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value.slice(0, 2))}
                  className={cn(fieldClass, "w-10 text-center")}
                  aria-label="Minutos dedicados"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
              <div className="flex items-center gap-1.5">
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={cancelEdit}
                    aria-label="Cancelar edición"
                    title="Cancelar edición"
                  >
                    <X className="size-4" />
                  </Button>
                )}
                <Button
                  type="submit"
                  size="icon"
                  disabled={submitting}
                  aria-label={editingId ? "Guardar cambios" : "Añadir tarea"}
                  title={editingId ? "Guardar cambios" : "Añadir tarea"}
                >
                  {editingId ? <Check className="size-4" /> : <Plus className="size-4" />}
                </Button>
              </div>
            </form>
          </>
        )}

        <Separator />

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-sm italic text-muted-foreground">Sin tareas registradas todavía hoy</p>
            {categories.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("task-name-input")?.focus()}
              >
                <Plus className="size-3.5" />
                Añadir la primera tarea
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {tasks.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  onClick={() => startEdit(t)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-700",
                    t.id === editingId
                      ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                      : t.id === justAddedId
                        ? "bg-primary/15"
                        : "hover:bg-accent/50"
                  )}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: t.category.color ?? undefined }}
                  />
                  <span className="flex-1 truncate text-sm">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.category.name}</span>
                  <Badge variant="soft" className="shrink-0">
                    {t.minutes} min
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-7 shrink-0 transition-opacity",
                      pendingDeleteId === t.id
                        ? "text-destructive opacity-100"
                        : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                    )}
                    onClick={(e) => handleDeleteClick(e, t.id)}
                    aria-label={pendingDeleteId === t.id ? "Confirmar borrado" : "Borrar tarea"}
                    title={pendingDeleteId === t.id ? "Pulsa otra vez para confirmar" : "Borrar tarea"}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        {breakdown.length > 0 && (
          <div className="pt-2">
            <Separator className="mb-3" />
            <p className="mb-2 text-xs font-medium text-muted-foreground">Tiempo por categoría</p>
            <div style={{ width: "100%", height: Math.max(breakdown.length * 32, 60) }}>
              <ResponsiveContainer>
                <BarChart
                  data={breakdown}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                  barSize={14}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent))" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value) => [`${value} min`, ""]}
                  />
                  <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                    {breakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
