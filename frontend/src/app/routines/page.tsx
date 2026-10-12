"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Trash2, ListChecks, Repeat, CalendarRange } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { RoutineFormDialog } from "@/components/routines/routine-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoutines } from "@/hooks/use-routines";
import { routinesApi } from "@/lib/api";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

export default function RoutinesPage() {
  const { routines, isLoading, mutate } = useRoutines();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  async function handleDelete(id: number) {
    // Confirmación en dos pasos (clic de nuevo para confirmar), igual que
    // el gestor de categorías — sin confirm() nativo del navegador.
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    try {
      await routinesApi.remove(id);
      mutate();
      toast.success("Rutina borrada");
    } catch {
      toast.error("No se pudo borrar la rutina");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <motion.main
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-4xl px-5 pt-6 sm:px-8"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Rutinas</h1>
            <p className="text-sm text-muted-foreground">
              Calendarios de hábitos: tacha iniciales día a día o lleva una racha simple.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Nueva rutina
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : routines.length === 0 ? (
          <motion.div
            variants={item}
            className="rounded-xl border border-dashed border-border p-10 text-center"
          >
            <CalendarRange className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Aún no tienes ninguna rutina</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea la primera para empezar a llevar el calendario.
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {routines.map((r) => (
              <motion.div key={r.id} variants={item} className="group relative">
                <Link
                  href={`/routines/${r.id}`}
                  className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: r.color ?? "#6C5CE7" }}
                      />
                      <p className="text-lg font-semibold tracking-tight sm:text-xl">{r.name}</p>
                    </div>
                  </div>
                  <Badge variant="soft" className="w-fit gap-1">
                    {r.type === "checklist" ? (
                      <ListChecks className="size-3" />
                    ) : (
                      <Repeat className="size-3" />
                    )}
                    {r.type === "checklist" ? "Lista por día" : "Racha simple"}
                  </Badge>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`absolute right-2 top-2 size-7 opacity-0 transition-opacity group-hover:opacity-100 ${
                    pendingDelete === r.id ? "text-destructive opacity-100" : "text-muted-foreground"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(r.id);
                  }}
                  aria-label="Borrar rutina"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.main>

      <RoutineFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={mutate} />
    </div>
  );
}
