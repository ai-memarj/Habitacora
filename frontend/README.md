# Bitácora — Frontend

Dashboard de seguimiento diario de hábitos, consumiendo la API de
FastAPI (carpeta `app/` en la raíz del repo) vía REST/JSON.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (configuración CSS-first en `src/app/globals.css`, sin `tailwind.config.js`)
- **shadcn/ui** (Radix primitives) — `components.json` ya configurado; añade componentes nuevos con:
  ```bash
  npx shadcn@latest add <componente>
  ```
- **Lucide React** — iconos
- **SWR** — fetching de datos con cache/revalidación (ver `src/hooks/`)
- **Axios** — cliente HTTP y funciones de mutación por recurso (`src/lib/api.ts`)
- **Recharts** — gráfico de barras (desglose de tiempo por categoría) y donut (fases de sueño)
- **Framer Motion** — animación de entrada del dashboard y de la lista de tareas
- **Sonner** — notificaciones toast

## Arrancar en local

Requiere la API corriendo en paralelo (ver `../README.md` de la raíz).

```bash
npm install
cp .env.local.example .env.local   # ajusta NEXT_PUBLIC_API_URL si hace falta
npm run dev
```

Abre `http://localhost:3000`.

## Estructura

```
src/
  app/
    layout.tsx          # fuentes (Geist + Fraunces), modo oscuro, <Toaster/>
    page.tsx              # dashboard: ensambla todas las tarjetas para un día
    globals.css             # tokens de tema (dark-first) + utilidades .glass/.glass-panel
    routines/
      page.tsx                # listado de rutinas + diálogo de creación
      [id]/page.tsx             # Server Component fino (instant = false) -> RoutineDetailClient
  components/
    ui/                       # componentes shadcn/ui (Button, Card, Dialog, Select, ...)
    layout/
      navbar.tsx                # barra superior glass; date/streak son props OPCIONALES
      nav-links.tsx               # pestañas "Hoy" / "Rutinas" (usePathname)
    dashboard/
      task-card.tsx               # formulario (horas+min) + lista de tareas + gráfico de categorías
      sleep-card.tsx                # formulario de sueño + donut de fases + duración
      reflection-card.tsx            # frase del día (sin selector de ánimo, quitado de la UI)
      category-manager-dialog.tsx     # CRUD de categorías
    routines/
      routine-form-dialog.tsx          # diálogo "nueva rutina" (nombre/color/tipo)
      routine-detail-client.tsx         # calendario mensual de una rutina (estado + llamadas API)
      routine-day-cell.tsx               # una celda: items tachables o día entero tachable
  hooks/                              # un hook SWR por recurso (useDaySummary, useCategories,
                                       # useStreak, useRoutines, useRoutine, useRoutineItems)
  lib/
    api.ts                             # instancia de Axios + fetcher SWR + funciones de mutación
    date.ts                             # TODA la aritmética de fechas (ver nota de zona horaria abajo)
    utils.ts                            # helper cn() (merge de clases Tailwind)
  types/
    index.ts                             # tipos TS reflejando los esquemas Pydantic del backend
```

## Patrón: sincronizar formularios con datos de SWR

`sleep-card.tsx` y `reflection-card.tsx` necesitan
estado local editable (lo que el usuario está escribiendo) inicializado
desde datos que llegan de forma asíncrona (SWR). La tentación es un
`useEffect` que haga `setState` cuando cambia la prop — pero eso dispara
el lint error `react-hooks/set-state-in-effect` de React 19. En su
lugar, usan el patrón oficial de React de "ajustar estado durante el
render":

```tsx
const [prevEntry, setPrevEntry] = useState(entry);
if (entry !== prevEntry) {
  setPrevEntry(entry);
  setLocalState(entry?.campo ?? "");
}
```

Y para comparar "¿ha cambiado desde lo último guardado?" en el `onBlur`,
comparan contra la propia prop (`entry?.campo`) en vez de guardar una
copia en un `ref` (escribir en `ref.current` durante el render también
está prohibido por el lint, `react-hooks/refs`). Replica este patrón en
cualquier componente nuevo con el mismo problema.

## Fechas: nunca `toISOString()`

`src/lib/date.ts` centraliza toda la aritmética de fechas del frontend.
`Date#toISOString()` convierte a UTC antes de formatear, así que en una
zona horaria con offset positivo (Europe/Madrid) sumar o restar un
día/mes cerca de medianoche local puede devolver la misma fecha o
saltarse una entera — esto rompió de verdad la navegación de fecha del
dashboard diario en su momento. La regla: para obtener un
"YYYY-MM-DD" o sumar/restar días o meses, usar siempre
`toISODate`/`todayISO`/`shiftISODate`/`buildMonthGrid`/`addMonths` de
`src/lib/date.ts` (construidas con los componentes LOCALES del `Date`),
nunca `toISOString()` ni un `Date` parseado de un string sin hora.

## Rutinas (calendarios de hábitos)

`/routines` lista las rutinas; `/routines/[id]` muestra el calendario
mensual de una. Dos tipos (ver `CLAUDE.md` para el backend): rutinas
"checklist" dejan varias iniciales por día, cada una tachable por
separado (`routine-day-cell.tsx`); rutinas "simple" tachan el día
entero con un solo click. `routines/[id]/page.tsx` es intencionadamente
un Server Component casi vacío — ver el comentario dentro del archivo
sobre `export const instant = false` antes de tocarlo o de copiar el
patrón a otra ruta dinámica.

## Modo oscuro

Arranca en modo oscuro por defecto (clase `dark` fija en `<html>`, en
`src/app/layout.tsx`). Cuando se añada un selector de tema, se migrará a
`next-themes` para alternar `dark`/`light` en cliente y persistir la
preferencia.
