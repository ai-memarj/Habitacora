# CLAUDE.md

Contexto para quien (humano o Claude Code) continúe este proyecto.

## Qué es esto

App personal de seguimiento diario: tareas por categoría + tiempo
dedicado, sueño (horas y fases), frase motivacional, estado de ánimo y
notas. Doble propósito: autoconocimiento y material de consulta para
terapia psicológica. La prioridad es que el registro diario sea rápido
de rellenar — no añadir fricción con pasos innecesarios.

## Decisiones de arquitectura (y por qué)

- **SQLite en desarrollo, migrable a Postgres**: toda la configuración
  de BD pasa por `DATABASE_URL` en `app/database.py`. No hay nada
  SQLite-específico en modelos ni routers, así que cambiar de motor es
  solo cambiar esa variable de entorno (y correr las migraciones si ya
  hay datos).
- **Frontend desacoplado (Next.js), backend como API pura** [actualizado]:
  el prototipo inicial servía HTML vanilla directamente desde FastAPI
  (Jinja2 + static files). Se migró deliberadamente a dos procesos
  separados: `app/` (FastAPI, solo JSON) y `frontend/` (Next.js App
  Router + TypeScript + Tailwind + shadcn/ui). FastAPI ya NO sirve HTML
  ni archivos estáticos — si ves código que intenta montar `StaticFiles`
  o `Jinja2Templates` en `app/main.py`, es regresión, no intención.
  CORS está configurado en `app/main.py` vía `FRONTEND_ORIGINS` (env
  var, por defecto `localhost:3000`); al desplegar, añadir el dominio
  real ahí en vez de tocar código.
- **"Completar" una tarea = registrar minutos**: no existe un campo
  booleano de completado. El usuario fue explícito en que introducir
  tiempo dedicado ya implica que se hizo. No añadir ese campo sin que
  lo pida.
- **Un registro de sueño/entrada diaria por fecha (upsert)**: `SleepLog`
  y `DailyEntry` tienen `date` como columna única. Los endpoints `PUT
  /api/sleep` y `PUT /api/daily` crean o actualizan según exista ya un
  registro para esa fecha. No crear endpoints `POST` separados para
  estos dos recursos.
- **Categorías editables por el usuario**: seedeadas por defecto (Casa,
  Rutina, Coche, Guitarra, Deporte, Trabajo) solo si la tabla está
  vacía (`app/seed.py`), pero el usuario puede crear/renombrar/recolorear
  o borrar (si no tienen tareas asociadas) desde la propia UI. No
  hardcodear la lista de categorías en ningún otro sitio del código.
- **`create_all()` en vez de migraciones**: válido mientras es
  prototipo de un solo desarrollador. En cuanto haya datos reales que
  no se puedan perder, introducir Alembic antes de seguir cambiando
  modelos.

## Estructura

Ver README.md — se mantiene ahí para no duplicar.

## Cosas pendientes mencionadas por el usuario pero NO implementadas aún

Están aquí para que quien continúe sepa que se discutieron y se
decidió posponerlas deliberadamente, no que se olvidaron:

- Gráficos de tendencia (sueño semanal, minutos por categoría, ánimo
  a lo largo del tiempo).
- Objetivos a medio/largo plazo vinculados a tareas diarias.
- Exportar un resumen de periodo a PDF para consulta.
- Recordatorio/check-in si no se ha registrado nada a cierta hora.

## Estado del frontend (Next.js)

En `frontend/` hay **andamiaje, no pantallas completas**: Next.js +
TypeScript + Tailwind v4 (config CSS-first en `globals.css`, sin
`tailwind.config.js`) + shadcn/ui (solo `Button` y `Card` creados a
mano, el resto se añade con `npx shadcn@latest add <componente>`) +
Lucide + SWR (patrón de hook por recurso en `src/hooks/`, ver
`use-day-summary.ts` como ejemplo) + Axios (`src/lib/api.ts`) +
Recharts/Framer Motion instalados pero sin usar todavía.

`src/app/page.tsx` es solo una página de verificación ("Andamiaje
conectado") — las pantallas reales (tareas del día, sueño, racha,
gestión de categorías, gráficos) están por construir sobre esta base.
`components.json` ya está configurado como si `shadcn init` se hubiera
ejecutado, para que el CLI funcione sin fricción en una máquina con
acceso normal a internet (en el entorno donde se generó este andamiaje
no había salida de red hacia `ui.shadcn.com`, solo hacia npm/GitHub).

Modo oscuro: fijo por defecto (clase `dark` en `<html>`,
`src/app/layout.tsx`). Pendiente añadir `next-themes` si se quiere un
selector real de tema.

## Cómo seguir desde aquí

Backend y frontend se arrancan por separado, en dos terminales.

**Backend:**
1. `git clone` este repo.
2. `python3 -m venv .venv && source .venv/bin/activate`
3. `pip install -r requirements.txt`
4. `uvicorn app.main:app --reload --port 8000`
5. La base de datos se crea sola en `data/habitos.db` (no versionada,
   ver `.gitignore`).

**Frontend:**
1. `cd frontend && npm install`
2. `cp .env.local.example .env.local`
3. `npm run dev`

Para desplegar en servidor propio: backend con `DATABASE_URL` apuntando
a la BD de producción, servido por un proceso gestionado (systemd o
Docker) tras un reverse proxy (nginx), sin `--reload`; frontend
compilado con `next build` y servido como app Next.js. Añadir el
dominio real del frontend a `FRONTEND_ORIGINS` en el backend.
