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
  components/
    ui/                       # componentes shadcn/ui (Button, Card, Dialog, Select, ...)
    layout/
      navbar.tsx                # barra superior glass, navegación de fecha, racha
    dashboard/
      task-card.tsx               # formulario + lista de tareas + gráfico de categorías
      sleep-card.tsx                # formulario de sueño + donut de fases + duración
      reflection-card.tsx            # frase del día + selector de ánimo
      notes-card.tsx                   # notas libres
      category-manager-dialog.tsx       # CRUD de categorías
  hooks/                              # un hook SWR por recurso (useDaySummary, useCategories, useStreak)
  lib/
    api.ts                             # instancia de Axios + fetcher SWR + funciones de mutación
    utils.ts                            # helper cn() (merge de clases Tailwind)
  types/
    index.ts                             # tipos TS reflejando los esquemas Pydantic del backend
```

## Patrón: sincronizar formularios con datos de SWR

`sleep-card.tsx`, `notes-card.tsx` y `reflection-card.tsx` necesitan
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

## Modo oscuro

Arranca en modo oscuro por defecto (clase `dark` fija en `<html>`, en
`src/app/layout.tsx`). Cuando se añada un selector de tema, se migrará a
`next-themes` para alternar `dark`/`light` en cliente y persistir la
preferencia.
