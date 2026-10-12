"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Hoy" },
  { href: "/routines", label: "Rutinas" },
];

/** Pestañas de navegación entre secciones de la app (dashboard diario / rutinas). */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
