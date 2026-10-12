"use client";

import { useState } from "react";
import { toast } from "sonner";
import { dailyApi } from "@/lib/api";
import type { DailyEntry } from "@/types";

interface ReflectionCardProps {
  date: string;
  entry: DailyEntry | null | undefined;
  onChanged: () => void;
}

/**
 * Frase del día. El estado de ánimo y las notas se quitaron de la UI
 * (ver CLAUDE.md) — el endpoint de `daily` sigue aceptando esos campos,
 * así que al guardar la frase se reenvían los valores ya existentes de
 * `entry` sin tocarlos, en vez de machacarlos con null.
 */
export function ReflectionCard({ date, entry, onChanged }: ReflectionCardProps) {
  const [quote, setQuote] = useState("");

  // Ajusta el estado durante el render cuando llega una `entry` distinta,
  // en vez de en un useEffect (ver nota equivalente en sleep-card.tsx).
  const [prevEntry, setPrevEntry] = useState(entry);
  if (entry !== prevEntry) {
    setPrevEntry(entry);
    setQuote(entry?.quote ?? "");
  }

  async function handleQuoteBlur() {
    // Comparamos contra la prop (última versión confirmada por el
    // servidor), no contra un ref.
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
      toast.error("No se pudo guardar");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 to-card p-5 shadow-sm">
      <p className="mb-2 text-sm font-semibold tracking-tight text-foreground">Frase del día</p>
      <textarea
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
        onBlur={handleQuoteBlur}
        placeholder="Escribe algo que quieras recordar hoy..."
        rows={2}
        className="w-full resize-none bg-transparent font-serif text-base italic leading-snug text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
      />
    </div>
  );
}
