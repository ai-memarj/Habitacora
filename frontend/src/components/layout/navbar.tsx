import { Sparkles } from "lucide-react";
import { NavLinks } from "@/components/layout/nav-links";
import packageJson from "../../../package.json";

/**
 * Cabecera global de la app: solo identidad (icono + nombre), navegación
 * entre secciones y versión. Todo lo relativo al día concreto (fecha,
 * selector de fecha, racha) vive en `DayNav`, dentro de la página "Hoy" —
 * no tiene sentido en secciones como "/routines".
 */
export function Navbar() {
  return (
    <nav className="glass sticky top-0 z-40 grid grid-cols-3 items-center px-5 py-1.5 sm:px-8">
      <div className="flex items-center gap-2 justify-self-start">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="size-3.5" />
        </div>
        <p className="text-xs font-semibold tracking-tight sm:text-sm">Bitácora</p>
      </div>

      <div className="justify-self-center">
        <NavLinks />
      </div>

      <p className="justify-self-end text-[11px] font-medium text-muted-foreground sm:text-xs">
        v{packageJson.version}
      </p>
    </nav>
  );
}
