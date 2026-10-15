"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { todayISO, shiftISODate } from "@/lib/date";
import { Navbar } from "@/components/layout/navbar";
import { DayNav } from "@/components/dashboard/day-nav";
import { TaskCard } from "@/components/dashboard/task-card";
import { TodayCard } from "@/components/dashboard/today-card";
import { CategoryManagerDialog } from "@/components/dashboard/category-manager-dialog";
import { DayImportDialog } from "@/components/dashboard/day-import-dialog";

import { useDaySummary } from "@/hooks/use-day-summary";
import { useCategories } from "@/hooks/use-categories";
import { useStreak } from "@/hooks/use-streak";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const SHORTCUTS_STORAGE_KEY = "habitacora:shortcuts-enabled";

export default function Home() {
  // "today" se calcula en cliente, no durante el prerender (Next 16 +
  // Cache Components no permite leer la hora actual en un Client
  // Component mientras prerenderiza). A diferencia de las tarjetas, aquí
  // no hay una prop de la que derivar el valor — es el reloj del
  // navegador leído una vez al montar — así que un efecto es el patrón
  // correcto, no una excepción a evitar.
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única del reloj de cliente tras montar, no hay prop que derivar
    setDate(todayISO());
  }, []);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Preferencia de "modo interactivo" (atajos de teclado), persistida por
  // navegador en localStorage — no hay ninguna razón para que viva en el
  // backend, es puramente una conveniencia de cliente.
  const [shortcutsEnabled, setShortcutsEnabled] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de una preferencia de localStorage tras montar, no hay prop de la que derivarla
    setShortcutsEnabled(localStorage.getItem(SHORTCUTS_STORAGE_KEY) === "1");
  }, []);

  function toggleShortcuts() {
    setShortcutsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const { summary, isLoading, mutate: mutateSummary } = useDaySummary(date ?? "");
  const { categories, mutate: mutateCategories } = useCategories();
  const { streak, isLoading: streakLoading, mutate: mutateStreak } = useStreak();

  // Atajos de teclado del "modo interactivo": ←/→ cambian de día, "N"
  // enfoca el campo de nueva tarea, "H" vuelve a hoy, "G" guarda el
  // sueño (simula un click en su botón en vez de duplicar la llamada a
  // la API aquí — ese botón ya sabe serializar los campos y mostrar el
  // "Guardado"). Se desactivan por completo si el foco ya está en un
  // campo editable, para no interferir con lo que se esté escribiendo
  // (p. ej. mover el cursor con las flechas dentro de la frase del día).
  useEffect(() => {
    if (!shortcutsEnabled || !date) return;

    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowLeft") {
        setDate((d) => (d ? shiftISODate(d, -1) : d));
      } else if (e.key === "ArrowRight") {
        setDate((d) => (d ? shiftISODate(d, 1) : d));
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        document.getElementById("task-name-input")?.focus();
      } else if (e.key.toLowerCase() === "h") {
        setDate(todayISO());
      } else if (e.key.toLowerCase() === "g") {
        e.preventDefault();
        document.getElementById("sleep-save-button")?.click();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcutsEnabled, date]);

  function refreshAll() {
    mutateSummary();
    mutateStreak();
  }

  function refreshCategoriesAndTasks() {
    mutateCategories();
    mutateSummary();
  }

  if (!date) return null; // evita parpadeo hasta tener la fecha de cliente

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <motion.main
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto grid max-w-4xl gap-4 px-5 pt-6 sm:px-8 md:grid-cols-2"
      >
        <motion.div variants={item} className="md:col-span-2">
          <DayNav
            date={date}
            onDateChange={setDate}
            streak={streak}
            streakLoading={streakLoading}
            shortcutsEnabled={shortcutsEnabled}
            onToggleShortcuts={toggleShortcuts}
            onOpenImport={() => setImportModalOpen(true)}
          />
        </motion.div>

        <motion.div variants={item} className="md:col-span-2">
          <TodayCard date={date} entry={summary?.entry} sleep={summary?.sleep} onChanged={refreshAll} />
        </motion.div>

        <motion.div variants={item} className="md:col-span-2">
          <TaskCard
            date={date}
            summary={summary}
            isLoading={isLoading}
            categories={categories}
            onChanged={refreshAll}
            onManageCategories={() => setCategoryModalOpen(true)}
          />
        </motion.div>
      </motion.main>

      <CategoryManagerDialog
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        categories={categories}
        onChanged={refreshCategoriesAndTasks}
      />

      <DayImportDialog
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        categories={categories}
        onImported={refreshAll}
      />
    </div>
  );
}
