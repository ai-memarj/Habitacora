"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useDaySummary } from "@/hooks/use-day-summary";

/**
 * Página de arranque — solo confirma que el andamiaje está bien conectado:
 * Tailwind, shadcn (Button/Card), Lucide y SWR hablando con la API de
 * FastAPI. Las pantallas reales (tareas, sueño, racha, gráficos) se
 * construyen a partir de aquí en los siguientes pasos.
 */
export default function Home() {
  // "today" se calcula en cliente (useEffect), no durante el render/prerender:
  // Next.js 16 con Cache Components no permite leer la hora actual mientras
  // prerenderiza un Client Component, así que empieza en null y se rellena
  // tras el montaje.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const { summary, isLoading, isError } = useDaySummary(today ?? "");

  return (
    <div className="min-h-screen">
      {/* Navbar con efecto glass, flotante sobre el contenido */}
      <nav className="glass sticky top-0 z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 font-semibold">
          <Activity className="size-5 text-primary" />
          Bitácora
        </div>
        <Button size="sm">Nueva tarea</Button>
      </nav>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Andamiaje conectado ✅</CardTitle>
            <CardDescription>
              Next.js + TypeScript + Tailwind + shadcn/ui + Lucide + SWR, hablando con
              FastAPI en <code>{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {!today && "Inicializando..."}
            {today && isLoading && "Cargando resumen de hoy desde la API..."}
            {today && isError && "No se pudo conectar con la API — ¿está arrancado uvicorn en :8000?"}
            {today && summary &&
              `Hoy tienes ${summary.tasks.length} tarea(s) registrada(s), ${summary.total_minutes} min en total.`}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
