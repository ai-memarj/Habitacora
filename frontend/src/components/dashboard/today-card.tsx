"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Check, Save } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

import { Button } from "@/components/ui/button";
import { dailyApi, sleepApi } from "@/lib/api";
import type { DailyEntry, SleepLog } from "@/types";

interface TodayCardProps {
  date: string;
  entry: DailyEntry | null | undefined;
  sleep: SleepLog | null | undefined;
  onChanged: () => void;
}

const QUOTE_MAX_LENGTH = 280;

const PHASE_COLORS = {
  light: "#A8C5E8",
  deep: "#3E5C94",
  rem: "#B89AE8",
};

function minutesBetween(startStr: string, endStr: string) {
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60;
  return end - start;
}

/**
 * Frase del día (fusionada con lo anterior "Sueño"): una sola tarjeta sin
 * títulos de sección, con la misma estética sin bordes de campo (fondo
 * transparente, solo una línea inferior) que invita a rellenar en vez de
 * parecer un formulario. El textarea de la frase sigue autoguardándose al
 * perder el foco (como antes); el sueño tiene su propio botón de guardar
 * porque son varios campos relacionados que tiene sentido confirmar juntos.
 */
export function TodayCard({ date, entry, sleep, onChanged }: TodayCardProps) {
  const [quote, setQuote] = useState("");
  const [sleepTime, setSleepTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [light, setLight] = useState("");
  const [deep, setDeep] = useState("");
  const [rem, setRem] = useState("");
  const [savingSleep, setSavingSleep] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpia el temporizador del "Guardado" pendiente si el componente se
  // desmonta antes de que termine (p. ej. se cambia de día justo después
  // de guardar) — evita el warning de setState tras desmontar.
  useEffect(() => {
    return () => {
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, []);

  // Ajusta el estado durante el render cuando llega una `entry`/`sleep`
  // nueva (cambio de día o resolución de SWR) — ver la nota en CLAUDE.md
  // sobre por qué no es un useEffect.
  const [prevEntry, setPrevEntry] = useState(entry);
  if (entry !== prevEntry) {
    setPrevEntry(entry);
    setQuote(entry?.quote ?? "");
  }
  const [prevSleep, setPrevSleep] = useState(sleep);
  if (sleep !== prevSleep) {
    setPrevSleep(sleep);
    setSleepTime(sleep?.sleep_time?.slice(0, 5) ?? "");
    setWakeTime(sleep?.wake_time?.slice(0, 5) ?? "");
    setLight(sleep?.light_pct?.toString() ?? "");
    setDeep(sleep?.deep_pct?.toString() ?? "");
    setRem(sleep?.rem_pct?.toString() ?? "");
  }

  const chartData = [
    { name: "Ligero", value: Number(light) || 0, color: PHASE_COLORS.light },
    { name: "Profundo", value: Number(deep) || 0, color: PHASE_COLORS.deep },
    { name: "REM", value: Number(rem) || 0, color: PHASE_COLORS.rem },
  ].filter((d) => d.value > 0);

  const duration =
    sleepTime && wakeTime
      ? (() => {
          const m = minutesBetween(sleepTime, wakeTime);
          return `${Math.floor(m / 60)}h ${m % 60}m`;
        })()
      : null;

  async function handleQuoteBlur() {
    if (quote === (entry?.quote ?? "")) return;
    try {
      await dailyApi.upsert({
        date,
        quote,
        mood: entry?.mood ?? null,
        notes: entry?.notes ?? null,
      });
      onChanged();
    } catch {
      toast.error("No se pudo guardar la frase");
    }
  }

  async function handleSaveSleep() {
    setSavingSleep(true);
    try {
      await sleepApi.upsert({
        date,
        sleep_time: sleepTime ? `${sleepTime}:00` : null,
        wake_time: wakeTime ? `${wakeTime}:00` : null,
        light_pct: light ? Number(light) : null,
        deep_pct: deep ? Number(deep) : null,
        rem_pct: rem ? Number(rem) : null,
      });
      onChanged();
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
      setSavedFlash(true);
      flashTimeout.current = setTimeout(() => setSavedFlash(false), 1600);
    } catch {
      toast.error("No se pudo guardar el sueño");
    } finally {
      setSavingSleep(false);
    }
  }

  const fieldClass =
    "w-full border-0 border-b border-border bg-transparent pb-1 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 to-card p-5 shadow-sm space-y-5">
      <textarea
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
        onBlur={handleQuoteBlur}
        placeholder="Escribe algo que quieras recordar hoy..."
        maxLength={QUOTE_MAX_LENGTH}
        rows={2}
        className="w-full resize-none bg-transparent font-serif text-base italic leading-snug text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
      />
      {quote.length >= QUOTE_MAX_LENGTH - 40 && (
        <p className="-mt-3 text-right text-[11px] text-muted-foreground">
          {quote.length}/{QUOTE_MAX_LENGTH}
        </p>
      )}

      <div className="h-px bg-border/60" />

      {!sleep && (
        <p className="text-xs text-muted-foreground/70">Registra cuánto y cómo dormiste anoche.</p>
      )}

      <div className="flex flex-wrap items-end gap-8">
        <div className="space-y-1.5">
          {duration && (
            <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {duration}
            </span>
          )}
          <div className="flex gap-4">
            <div className="w-24 space-y-1">
              <label htmlFor="sleep-time" className="text-xs text-muted-foreground">
                Dormir
              </label>
              <input
                id="sleep-time"
                type="time"
                lang="es-ES"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="w-24 space-y-1">
              <label htmlFor="wake-time" className="text-xs text-muted-foreground">
                Despertar
              </label>
              <input
                id="wake-time"
                type="time"
                lang="es-ES"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-16 space-y-1">
            <label htmlFor="light-pct" className="text-xs text-muted-foreground">
              Ligero %
            </label>
            <input
              id="light-pct"
              type="number"
              min={0}
              max={100}
              value={light}
              onChange={(e) => setLight(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="w-16 space-y-1">
            <label htmlFor="deep-pct" className="text-xs text-muted-foreground">
              Profundo %
            </label>
            <input
              id="deep-pct"
              type="number"
              min={0}
              max={100}
              value={deep}
              onChange={(e) => setDeep(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="w-16 space-y-1">
            <label htmlFor="rem-pct" className="text-xs text-muted-foreground">
              REM %
            </label>
            <input
              id="rem-pct"
              type="number"
              min={0}
              max={100}
              value={rem}
              onChange={(e) => setRem(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="size-16 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={chartData} dataKey="value" innerRadius={18} outerRadius={32} paddingAngle={3} strokeWidth={0}>
                  {chartData.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(value, name) => [`${value}%`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <AnimatePresence>
          {savedFlash && (
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-500"
            >
              <Check className="size-3.5" />
              Guardado
            </motion.span>
          )}
        </AnimatePresence>

        <Button
          id="sleep-save-button"
          type="button"
          size="icon"
          onClick={handleSaveSleep}
          disabled={savingSleep}
          title="Guardar sueño (G)"
          aria-label="Guardar sueño"
          className={savedFlash ? "" : "ml-auto"}
        >
          <Save className="size-4" />
        </Button>
      </div>
    </div>
  );
}
