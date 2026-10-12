"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tasksApi } from "@/lib/api";
import type { Category, DaySummary } from "@/types";

interface TaskCardProps {
  date: string;
  summary: DaySummary | undefined;
  isLoading: boolean;
  categories: Category[];
  onChanged: () => void; // revalida summary + streak tras un cambio
  onManageCategories: () => void;
}

const QUICK_MINUTES = ["15", "30", "45", "60"];

export function TaskCard({
  date,
  summary,
  isLoading,
  categories,
  onChanged,
  onManageCategories,
}: TaskCardProps) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const tasks = summary?.tasks ?? [];
  const totalMinutes = summary?.total_minutes ?? 0;

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cat = categoryId || categories[0]?.id.toString();
    if (!name.trim() || !minutes || !cat) return;

    setSubmitting(true);
    try {
      await tasksApi.create({
        date,
        name: name.trim(),
        minutes: Number(minutes),
        category_id: Number(cat),
      });
      setName("");
      setMinutes("");
      onChanged();
    } catch {
      toast.error("No se pudo añadir la tarea");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await tasksApi.remove(id);
      onChanged();
      toast.success("Tarea borrada");
    } catch {
      toast.error("No se pudo borrar la tarea");
    }
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Tareas de hoy</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="soft">{totalMinutes} min</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={onManageCategories}
            aria-label="Gestionar categorías"
          >
            <Settings2 className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <Select value={categoryId || categories[0]?.id.toString()} onValueChange={setCategoryId}>
              <SelectTrigger>
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
            placeholder="Nombre de la tarea"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-[2] min-w-0"
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                placeholder="min"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-20"
              />
              <ToggleGroup
                type="single"
                value={minutes}
                onValueChange={(v) => v && setMinutes(v)}
                className="gap-1"
              >
                {QUICK_MINUTES.map((m) => (
                  <ToggleGroupItem key={m} value={m}>
                    {m}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
          <Button type="submit" disabled={submitting} className="sm:w-auto">
            <Plus className="size-4" />
            Añadir
          </Button>
        </form>

        <Separator />

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="py-4 text-center text-sm italic text-muted-foreground">
            Sin tareas registradas todavía hoy
          </p>
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
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50"
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
                    className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                    onClick={() => handleDelete(t.id)}
                    aria-label="Borrar tarea"
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
