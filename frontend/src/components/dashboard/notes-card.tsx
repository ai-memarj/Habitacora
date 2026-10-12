"use client";

import { useState } from "react";
import { toast } from "sonner";
import { NotebookPen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { dailyApi } from "@/lib/api";
import type { DailyEntry } from "@/types";

interface NotesCardProps {
  date: string;
  entry: DailyEntry | null | undefined;
  onChanged: () => void;
}

export function NotesCard({ date, entry, onChanged }: NotesCardProps) {
  const [notes, setNotes] = useState("");

  // Ajusta el estado durante el render cuando llega una `entry` distinta
  // (cambio de día o resolución de SWR), en vez de en un useEffect.
  const [prevEntry, setPrevEntry] = useState(entry);
  if (entry !== prevEntry) {
    setPrevEntry(entry);
    setNotes(entry?.notes ?? "");
  }

  async function handleBlur() {
    // Comparamos contra la prop (última versión confirmada por el
    // servidor), no contra un ref — evita tocar estado fuera del ciclo
    // de render/eventos.
    if (notes === (entry?.notes ?? "")) return;
    try {
      await dailyApi.upsert({
        date,
        notes,
        quote: entry?.quote ?? null,
        mood: entry?.mood ?? null,
      });
      onChanged();
    } catch {
      toast.error("No se pudieron guardar las notas");
    }
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NotebookPen className="size-4 text-primary" />
          Notas del día
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleBlur}
          placeholder="Cualquier cosa que quieras anotar hoy..."
          rows={4}
        />
      </CardContent>
    </Card>
  );
}
