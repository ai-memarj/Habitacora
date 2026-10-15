"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const SHORTCUTS: Array<[string, string]> = [
  ["← / →", "Día anterior / siguiente"],
  ["H", "Ir a hoy"],
  ["N", "Enfocar nueva tarea"],
  ["G", "Guardar sueño"],
];

/**
 * Lista de atajos del "modo interactivo", en un popover propio (mismo
 * patrón de click-fuera-para-cerrar que `date-picker-popover.tsx`) — el
 * `title` del botón de activar/desactivar no es suficiente, no todo el
 * mundo pasa el ratón por encima para leerlo.
 */
export function ShortcutsHelpPopover() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        onClick={() => setOpen((o) => !o)}
        title="Ver atajos de teclado"
        aria-label="Ver atajos de teclado"
      >
        <HelpCircle className="size-4" />
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="mb-2 text-xs font-semibold text-foreground">Atajos de teclado</p>
          <ul className="space-y-1.5">
            {SHORTCUTS.map(([key, label]) => (
              <li key={key} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{label}</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{key}</kbd>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
