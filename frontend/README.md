# Bitácora — Frontend

Interfaz de la app de seguimiento de hábitos, consumiendo la API de
FastAPI (carpeta `app/` en la raíz del repo) vía REST/JSON.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (configuración CSS-first en `src/app/globals.css`, sin `tailwind.config.js`)
- **shadcn/ui** (Radix primitives) — `components.json` ya configurado; añade componentes con:
  ```bash
  npx shadcn@latest add dialog select separator
  ```
- **Lucide React** — iconos
- **SWR** — fetching de datos con cache/revalidación (ver `src/hooks/`)
- **Axios** — cliente HTTP base (`src/lib/api.ts`)
- **Recharts** — gráficos (pendiente de usar, para dashboards de tendencias)
- **Framer Motion** — transiciones (pendiente de usar)

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
  app/              # rutas (App Router) — páginas, layout, globals.css
  components/
    ui/               # componentes shadcn/ui (Button, Card, ...)
    layout/            # navbar, sidebar, shells de página (por construir)
  hooks/                # hooks de datos por recurso (useDaySummary, ...)
  lib/
    api.ts               # instancia de Axios + fetcher para SWR
    utils.ts              # helper cn() (merge de clases Tailwind)
  types/
    index.ts               # tipos TS reflejando los esquemas Pydantic del backend
```

## Modo oscuro

Arranca en modo oscuro por defecto (clase `dark` fija en `<html>`, en
`src/app/layout.tsx`). Cuando se añada un selector de tema, se migrará a
`next-themes` para alternar `dark`/`light` en cliente y persistir la
preferencia.
