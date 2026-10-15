"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { tasksApi, sleepApi, dailyApi } from "@/lib/api";
import { parseDayImportMarkdown, type ParsedDayImport } from "@/lib/day-import-md";
import type { Category } from "@/types";

interface DayImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onImported: () => void; // revalida el día actualmente abierto (puede ser uno de los importados)
}

const PLACEHOLDER = `## 2026-10-13

### Tareas
- Trabajo: Reunión de equipo (1h30m)
- Deporte: Correr (45m)

### Sueño
- Dormir: 23:30
- Despertar: 07:15
- Ligero: 55%
- Profundo: 30%
- REM: 15%

### Frase
> Hoy ha sido un buen día para empezar de nuevo.`;

/**
 * Importador masivo del dashboard diario desde un .md con el formato de
 * `lib/day-import-md.ts` — uno o varios días de golpe, pensado para meter
 * registros retroactivos sin pasar por el formulario día a día. Igual que
 * `routine-import-dialog.tsx`, admite pegar texto o (aquí, además) elegir
 * un archivo: la lectura del archivo es solo `File.text()` en el cliente,
 * nunca se sube al backend — la API sigue siendo JSON puro.
 */
export function DayImportDialog({ open, onOpenChange, categories, onImported }: DayImportDialogProps) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Al abrir el diálogo desde cero (no al reabrirlo tras un intento fallido
  // que el usuario sigue corrigiendo) se limpia el formulario. Patrón
  // "ajustar estado durante el render" del proyecto (ver CLAUDE.md).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setText("");
      setErrors([]);
    }
  }

  function resolveCategoryId(name: string): number | null {
    const normalized = name.trim().toLowerCase();
    const match = categories.find((c) => c.name.trim().toLowerCase() === normalized);
    return match ? match.id : null;
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite elegir el mismo archivo otra vez más tarde
    if (!file) return;
    setText(await file.text());
    setErrors([]);
  }

  /** Importa un día ya parseado. Devuelve si tocó algo (para no contarlo como "importado" si estaba vacío). */
  async function importDay(day: ParsedDayImport, runErrors: string[]): Promise<boolean> {
    let touched = false;

    // Tareas: sustituye TODAS las de ese día por las del archivo, pero solo
    // si al menos una se resolvió bien — nunca se vacía un día por culpa de
    // una sola categoría mal escrita.
    const resolved: { name: string; minutes: number; category_id: number }[] = [];
    for (const t of day.tasks) {
      const categoryId = resolveCategoryId(t.category);
      if (categoryId === null) {
        runErrors.push(`${day.date}: categoría "${t.category}" no existe, se omite "${t.name}"`);
        continue;
      }
      resolved.push({ name: t.name, minutes: t.minutes, category_id: categoryId });
    }
    if (resolved.length > 0) {
      const existing = await tasksApi.list(day.date);
      await Promise.all(existing.map((t) => tasksApi.remove(t.id)));
      for (const t of resolved) {
        await tasksApi.create({ date: day.date, ...t });
      }
      touched = true;
    }

    // Sueño: el upsert del backend reemplaza la fila entera, así que aquí
    // se fusiona con lo que ya hubiera — un campo que el .md no menciona
    // conserva su valor anterior en vez de borrarse. `day.sleep` puede
    // quedar como `{}` si la sección existía pero todas sus líneas
    // fallaron al parsear (ver day-import-md.ts) — en ese caso no hay
    // nada real que guardar, así que se comprueba que tenga algún campo.
    const sleep = day.sleep;
    if (sleep && Object.values(sleep).some((v) => v !== undefined)) {
      const existing = await sleepApi.get(day.date);
      await sleepApi.upsert({
        date: day.date,
        sleep_time: sleep.sleep_time ? `${sleep.sleep_time}:00` : existing?.sleep_time ?? null,
        wake_time: sleep.wake_time ? `${sleep.wake_time}:00` : existing?.wake_time ?? null,
        light_pct: sleep.light_pct ?? existing?.light_pct ?? null,
        deep_pct: sleep.deep_pct ?? existing?.deep_pct ?? null,
        rem_pct: sleep.rem_pct ?? existing?.rem_pct ?? null,
      });
      touched = true;
    }

    // Frase: igual, conserva ánimo/notas existentes (mismo criterio que
    // today-card.tsx al guardar solo la frase).
    if (day.quote !== undefined) {
      const existing = await dailyApi.get(day.date);
      await dailyApi.upsert({
        date: day.date,
        quote: day.quote,
        mood: existing?.mood ?? null,
        notes: existing?.notes ?? null,
      });
      touched = true;
    }

    return touched;
  }

  async function handleImport() {
    const { days, errors: parseErrors } = parseDayImportMarkdown(text);
    if (days.length === 0) {
      setErrors(parseErrors);
      toast.error("No se reconoció ningún día — revisa el formato");
      return;
    }

    setSubmitting(true);
    const runErrors = [...parseErrors];
    let importedDays = 0;
    try {
      for (const day of days) {
        try {
          if (await importDay(day, runErrors)) importedDays++;
        } catch {
          runErrors.push(`${day.date}: no se pudo importar (error de red o del servidor)`);
        }
      }
      setErrors(runErrors);
      onImported();
      if (importedDays > 0) {
        onOpenChange(false);
        toast.success(
          runErrors.length > 0
            ? `${importedDays} ${importedDays === 1 ? "día" : "días"} importados, ${runErrors.length} avisos`
            : `${importedDays} ${importedDays === 1 ? "día" : "días"} importados`
        );
      } else {
        toast.error("Ningún día tenía datos importables");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar datos (.md)</DialogTitle>
          <DialogDescription>
            Uno o varios días con tareas, sueño y/o frase. Lo que un día no mencione se deja
            como estaba — no hace falta repetir lo que ya tenías guardado.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          className="hidden"
          onChange={handleFilePicked}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-3"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="size-3.5" />
          Elegir archivo .md
        </Button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={14}
          spellCheck={false}
          className="w-full resize-none rounded-md border border-input bg-transparent p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring"
        />

        {errors.length > 0 && (
          <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-xs text-destructive">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        <Button onClick={handleImport} disabled={submitting || !text.trim()} className="mt-2 w-full">
          <Upload className="size-4" />
          Importar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
