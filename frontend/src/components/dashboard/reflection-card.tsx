"use client";

import { useState } from "react";
import { toast } from "sonner";
import { dailyApi } from "@/lib/api";
import type { DailyEntry } from "@/types";
import { cn } from "@/lib/utils";

interface ReflectionCardProps {
  date: string;
  entry: DailyEntry | null | undefined;
  onChanged: () => void;
}

const MOODS = [
  { value: 1, emoji: "😞", label: "Muy mal" },
  { value: 2, emoji: "🙁", label: "Mal" },
  { value: 3, emoji: "😐", label: "Normal" },
  { value: 4, emoji: "🙂", label: "Bien" },
  { value: 5, emoji: "😄", label: "Muy bien" },
];

/**
 * Frase del día + estado de ánimo en una sola tarjeta (van juntos
 * conceptualmente: son la "reflexión" rápida del día, a diferencia de
 * las notas largas que tienen su propia tarjeta).
 */
export function ReflectionCard({ date, entry, onChanged }: ReflectionCardProps) {
  const [quote, setQuote] = useState("");
  const [mood, setMood] = useState<number | null>(null);

  // Ajusta el estado durante el render cuando llega una `entry` distinta,
  // en vez de en un useEffect (ver nota equivalente en sleep-card.tsx).
  const [prevEntry, setPrevEntry] = useState(entry);
  if (entry !== prevEntry) {
    setPrevEntry(entry);
    setQuote(entry?.quote ?? "");
    setMood(entry?.mood ?? null);
  }

  async function persist(next: { quote?: string; mood?: number | null }) {
    const payload = {
      date,
      quote: next.quote ?? quote,
      mood: next.mood !== undefined ? next.mood : mood,
      notes: entry?.notes ?? null, // esta tarjeta no toca notas, pero el endpoint es upsert completo
    };
    try {
      await dailyApi.upsert(payload);
      onChanged();
    } catch {
      toast.error("No se pudo guardar");
    }
  }

  function handleQuoteBlur() {
    // Comparamos contra la prop (última versión confirmada por el
    // servidor), no contra un ref.
    if (quote !== (entry?.quote ?? "")) persist({ quote });
  }

  function handleMoodClick(value: number) {
    const next = mood === value ? null : value;
    setMood(next);
    persist({ mood: next });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 to-card p-5 shadow-sm">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Frase del día</p>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          onBlur={handleQuoteBlur}
          placeholder="Escribe algo que quieras recordar hoy..."
          rows={2}
          className="w-full resize-none bg-transparent font-serif text-base italic leading-snug text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 text-xs font-medium text-muted-foreground">¿Cómo te sientes hoy?</p>
        <div className="flex justify-between gap-1.5">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              title={m.label}
              onClick={() => handleMoodClick(m.value)}
              className={cn(
                "flex-1 rounded-lg border border-transparent py-2 text-xl transition-all hover:-translate-y-0.5 hover:border-border",
                mood === m.value && "scale-110 border-primary/40 bg-primary/10"
              )}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
