"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { todayISO } from "@/lib/date";
import { Navbar } from "@/components/layout/navbar";
import { TaskCard } from "@/components/dashboard/task-card";
import { SleepCard } from "@/components/dashboard/sleep-card";
import { ReflectionCard } from "@/components/dashboard/reflection-card";
import { CategoryManagerDialog } from "@/components/dashboard/category-manager-dialog";

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

  const { summary, isLoading, mutate: mutateSummary } = useDaySummary(date ?? "");
  const { categories, mutate: mutateCategories } = useCategories();
  const { streak, isLoading: streakLoading, mutate: mutateStreak } = useStreak();

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
      <Navbar date={date} onDateChange={setDate} streak={streak} streakLoading={streakLoading} />

      <motion.main
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto grid max-w-4xl gap-4 px-5 pt-6 sm:px-8 md:grid-cols-2"
      >
        <motion.div variants={item} className="md:col-span-2">
          <ReflectionCard date={date} entry={summary?.entry} onChanged={refreshAll} />
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

        <motion.div variants={item} className="md:col-span-2">
          <SleepCard date={date} sleep={summary?.sleep} onChanged={refreshAll} />
        </motion.div>
      </motion.main>

      <CategoryManagerDialog
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        categories={categories}
        onChanged={refreshCategoriesAndTasks}
      />
    </div>
  );
}
