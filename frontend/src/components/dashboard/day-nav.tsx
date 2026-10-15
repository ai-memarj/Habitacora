"use client";

import { ChevronLeft, ChevronRight, Flame, Keyboard, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePickerPopover } from "@/components/dashboard/date-picker-popover";
import { ShortcutsHelpPopover } from "@/components/dashboard/shortcuts-help-popover";
import { cn } from "@/lib/utils";
import { shiftISODate } from "@/lib/date";

interface DayNavProps {
  date: string;
  onDateChange: (date: string) => void;
  streak?: number;
  streakLoading?: boolean;
  shortcutsEnabled?: boolean;
  onToggleShortcuts?: () => void;
  onOpenImport?: () => void;
}

function formatLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

/** Fecha del día + racha (izquierda) y navegación entre días (derecha). Antes vivía en el Navbar global; ahora es propio de la página "Hoy". */
export function DayNav({
  date,
  onDateChange,
  streak,
  streakLoading,
  shortcutsEnabled,
  onToggleShortcuts,
  onOpenImport,
}: DayNavProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <p className="text-lg font-medium capitalize text-foreground sm:text-xl">{formatLabel(date)}</p>
        {!streakLoading && !!streak && streak > 0 && (
          <Badge
            variant="soft"
            title="Días consecutivos con algún registro"
            className={cn(
              "gap-1 border border-primary/20 bg-gradient-to-r from-orange-500/10 to-primary/10 text-orange-500 dark:text-orange-400"
            )}
          >
            <Flame className="size-3" />
            {streak} {streak === 1 ? "día" : "días"}
          </Badge>
        )}
        {streakLoading && <Skeleton className="h-5 w-16 rounded-full" />}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onDateChange(shiftISODate(date, -1))}
          title="Día anterior"
          aria-label="Día anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <DatePickerPopover date={date} onDateChange={onDateChange} />
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onDateChange(shiftISODate(date, 1))}
          title="Día siguiente"
          aria-label="Día siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>

        {onToggleShortcuts && (
          <>
            <Button
              variant="outline"
              size="icon"
              className={cn("size-8", shortcutsEnabled && "border-primary/40 bg-primary/10 text-primary")}
              onClick={onToggleShortcuts}
              title="Atajos de teclado: ← → día, H hoy, N nueva tarea, G guardar sueño"
              aria-pressed={shortcutsEnabled}
              aria-label={shortcutsEnabled ? "Desactivar atajos de teclado" : "Activar atajos de teclado"}
            >
              <Keyboard className="size-4" />
            </Button>
            <ShortcutsHelpPopover />
          </>
        )}

        {onOpenImport && (
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={onOpenImport}
            title="Importar datos (.md)"
            aria-label="Importar datos desde un archivo Markdown"
          >
            <FileUp className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
