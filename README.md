# Bitácora — seguimiento de hábitos, objetivos y salud mental

Registro diario personal: tareas por categoría y tiempo dedicado, sueño
(horas y fases), frase motivacional y estado de ánimo, y notas libres.
Pensado como enlace diario con uno mismo y como libro de consulta para
terapia.

## Arquitectura

Monorepo con **backend y frontend desacoplados**, cada uno con su propio
proceso de desarrollo:

```
Habitacora/
├── app/            # Backend: FastAPI, API REST pura (JSON), sin HTML
├── frontend/        # Frontend: Next.js (App Router) + TypeScript
└── data/              # Base de datos SQLite (solo usada por el backend)
```

- **Backend:** FastAPI + SQLAlchemy — ver detalle más abajo.
- **Frontend:** Next.js + TypeScript + Tailwind + shadcn/ui — ver `frontend/README.md`.
- **Comunicación:** el frontend consume la API vía REST/JSON (fetch/axios/SWR).
  CORS está habilitado en el backend para el origen del frontend en desarrollo
  (`http://localhost:3000`).

## Backend — Stack

- **Framework:** FastAPI
- **Base de datos:** SQLite para desarrollo (fichero en `data/habitos.db`).
  Migrar a Postgres/MySQL en el futuro solo requiere cambiar la variable
  de entorno `DATABASE_URL`; el resto del código no cambia.
- **ORM:** SQLAlchemy

## Backend — Estructura

```
app/
  main.py          # punto de entrada: API FastAPI + CORS, sin HTML ni estáticos
  database.py       # configuración de SQLAlchemy / sesión
  models.py         # modelos: Category, Task, SleepLog, DailyEntry
  schemas.py         # esquemas Pydantic (entrada/salida de la API)
  seed.py            # siembra las categorías por defecto
  routers/
    categories.py    # CRUD de categorías
    tasks.py          # CRUD de tareas diarias
    sleep.py           # registro de sueño (upsert por día)
    daily.py            # frase/ánimo/notas + resumen agregado del día
    stats.py              # racha de días consecutivos (streak)
    routines.py            # rutinas tipo calendario + sus items por día
data/
  habitos.db              # base de datos SQLite (se crea sola, no versionada)
```

## Arrancar en local

Backend y frontend se arrancan **por separado**, en dos terminales.

**Backend (API):**
```bash
python3 -m venv .venv
source .venv/bin/activate     # en Windows (Git Bash): source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --reload-dir app --port 8000
```
El `--reload-dir app` evita que uvicorn vigile todo el repo (incluido
`frontend/node_modules`, que provoca reinicios espurios cada vez que
`npm install` toca algo ahí). API en `http://localhost:8000`,
documentación interactiva en `/docs`. La base de datos y las categorías
por defecto (Casa, Rutina, Coche, Guitarra, Deporte, Trabajo) se crean
automáticamente la primera vez.

**Frontend (interfaz):**
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Interfaz en `http://localhost:3000`. Ver `frontend/README.md` para más
detalle del stack y estructura de carpetas.

## Modelo de datos (resumen)

- **Category**: nombre + color. Editable y creable desde la propia web.
- **Task**: fecha, nombre, minutos dedicados, categoría. Registrar el
  tiempo dedicado ya implica que la tarea se hizo (no hay checkbox de
  "completado" separado).
- **SleepLog**: un registro por noche — hora de dormir, hora de
  despertar, y porcentaje de sueño ligero/profundo/REM.
- **DailyEntry**: un registro por día — frase motivacional, estado de
  ánimo (escala 1-5) y notas libres. [actualizado] El frontend ahora
  solo muestra/edita la frase; ánimo y notas se quitaron de la UI a
  petición del usuario, pero siguen existiendo en el modelo y la API
  (ver `CLAUDE.md`).
- **Routine** [nuevo]: un calendario de hábito (nombre, color, tipo
  `"checklist"` o `"simple"`). **RoutineItem**: una entrada de una
  Routine en una fecha concreta (texto corto opcional + si está
  tachada/hecha). En rutinas "checklist" puede haber varios
  RoutineItem por día (cada inicial se tacha por separado); en
  rutinas "simple" hay como mucho uno por día y tachar el día entero
  es tachar ese único item. Ver `CLAUDE.md` para el porqué.

## API

Documentación interactiva autogenerada disponible en `/docs` (Swagger UI)
en cuanto el servidor está arrancado.

Endpoints principales:
- `GET/POST /api/categories`, `PUT/DELETE /api/categories/{id}`
- `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/{id}` (filtrable por `?for_date=`)
- `GET /api/sleep/{fecha}`, `PUT /api/sleep` (upsert por fecha)
- `GET /api/daily/{fecha}`, `PUT /api/daily` (upsert por fecha)
- `GET /api/summary/{fecha}` — vista agregada del día (tareas + sueño + entrada)
- `GET /api/stats/streak` — racha de días consecutivos con registro
- `GET/POST /api/routines`, `GET/PUT/DELETE /api/routines/{id}`
- `GET/POST /api/routines/{id}/items?start=...&end=...` (rango de fechas),
  `PUT/DELETE /api/routines/items/{item_id}`
- `PUT /api/routines/{id}/items/bulk` — importación masiva por rango de
  días (solo rutinas "checklist"); sustituye los items de cada día
  listado, pensado para pegar un mes entero de golpe

## Hoja de ruta y bitácora de sesiones

Este proyecto se desarrolla compartido entre un entorno en la nube
(efímero) y un entorno local persistente (Arch Linux + Omarchy). Dos
documentos en la raíz del repo sostienen esa continuidad:

- **`ROADMAP.md`** — qué está hecho, en qué fase está el proyecto
  (nube → local → servidor propio) y qué queda pendiente a propósito.
- **`SESSIONS.md`** — qué se hizo en cada sesión de trabajo y qué debe
  hacer la siguiente al arrancar. Léelo primero al empezar una sesión
  nueva, sea en la nube o en local.

Para las decisiones de arquitectura (el "por qué" de cómo está hecho
cada cosa), ver `CLAUDE.md`.

## Despliegue futuro

Pensado para, cuando el prototipo esté maduro, clonar este repo en un
entorno local (o directamente en Claude Code) y continuar el desarrollo
ahí, para finalmente desplegar en un servidor propio: backend como
servicio FastAPI/uvicorn tras un reverse proxy, frontend compilado con
`next build` y servido como app Next.js (o exportado, según necesidad).
Ver `CLAUDE.md` para las decisiones de arquitectura que conviene conocer
antes de seguir.
