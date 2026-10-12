"use client";

import { ChevronLeft, ChevronRight, Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { shiftISODate } from "@/lib/date";

interface NavbarProps {
  date: string; // ISO "YYYY-MM-DD"
  onDateChange: (date: string) => void;
  streak: number;
  streakLoading: boolean;
}

function formatLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

export function Navbar({ date, onDateChange, streak, streakLoading }: NavbarProps) {
  return (
    <nav className="glass sticky top-0 z-40 flex items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Bitácora</p>
          <p className="hidden text-base font-medium capitalize text-foreground sm:block sm:text-lg">
            {formatLabel(date)}
          </p>
        </div>

        {!streakLoading && streak > 0 && (
          <Badge
            variant="soft"
            className={cn(
              "ml-1 gap-1 border border-primary/20 bg-gradient-to-r from-orange-500/10 to-primary/10 text-orange-500 dark:text-orange-400"
            )}
          >
            <Flame className="size-3" />
            {streak} {streak === 1 ? "día" : "días"}
          </Badge>
        )}
        {streakLoading && <Skeleton className="ml-1 h-5 w-16 rounded-full" />}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onDateChange(shiftISODate(date, -1))}
          aria-label="Día anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        />
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onDateChange(shiftISODate(date, 1))}
          aria-label="Día siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
