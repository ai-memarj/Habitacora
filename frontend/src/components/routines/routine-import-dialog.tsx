"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { routineItemsApi } from "@/lib/api";
import { parseRoutineBulkText, formatRoutineBulkText } from "@/lib/routine-bulk-text";
import type { RoutineItem } from "@/types";

interface RoutineImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routineId: number;
  year: number;
  month: number; // 0-11
  monthLabel: string;
  itemsByDate: Map<string, RoutineItem[]>;
  onImported: () => void;
}

export function RoutineImportDialog({
  open,
  onOpenChange,
  routineId,
  year,
  month,
  monthLabel,
  itemsByDate,
  onImported,
}: RoutineImportDialogProps) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Al abrir el diálogo, precarga el textarea con lo que ya hay guardado
  // ese mes (así se puede editar en vez de escribir desde cero). Patrón
  // "ajustar estado durante el render" del proyecto (ver CLAUDE.md) en
  // vez de un useEffect, para no disparar react-hooks/set-state-in-effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setText(formatRoutineBulkText(year, month, itemsByDate));
      setErrors([]);
    }
  }

  async function handleImport() {
    const { days, errors: parseErrors } = parseRoutineBulkText(text, year, month);
    setErrors(parseErrors);
    if (days.length === 0) {
      toast.error('No se reconoció ningún día. Formato: "1. V-M, F-K"');
      return;
    }
    setSubmitting(true);
    try {
      await routineItemsApi.bulkSet(
        routineId,
        days.map((d) => ({ date: d.date, labels: d.labels }))
      );
      onImported();
      onOpenChange(false);
      toast.success(
        parseErrors.length > 0
          ? `${days.length} días importados, ${parseErrors.length} líneas con problemas`
          : `${days.length} días importados`
      );
    } catch {
      toast.error("No se pudo importar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">Importar {monthLabel}</DialogTitle>
          <DialogDescription>
            Una línea por día: el número del día, un punto, y las iniciales separadas por comas.
            Sustituye lo que hubiera ya guardado esos días; un día que no escribas se queda como
            está.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"1. V-M, F-K\n2. V-M, H\n3. V-M"}
          rows={14}
          spellCheck={false}
          className="w-full resize-none rounded-md border border-input bg-transparent p-3 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
        />

        {errors.length > 0 && (
          <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto text-xs text-destructive">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <Button onClick={handleImport} disabled={submitting || !text.trim()} className="mt-3 w-full">
          <ClipboardPaste className="size-4" />
          Importar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
