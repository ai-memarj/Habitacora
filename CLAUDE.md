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
- **`src/lib/date.ts` centraliza TODA la aritmética de fechas del
  frontend**: no usar `Date#toISOString()` para obtener un
  "YYYY-MM-DD" en ningún componente nuevo. En cualquier zona horaria
  con offset positivo (Europe/Madrid, UTC+1/+2) `toISOString()`
  convierte a UTC antes de formatear, así que sumar/restar un día o
  mes cerca de medianoche local puede devolver la misma fecha o
  saltarse una entera — este bug ya rompió la navegación de fecha del
  dashboard diario (la flecha "siguiente" no avanzaba, "anterior" se
  saltaba un día) y el cálculo de "hoy". El fix fue dejar de usar
  `toISOString()` y formatear siempre a mano con los componentes
  LOCALES del `Date` (`getFullYear`/`getMonth`/`getDate`), que es lo
  que hacen `toISODate`/`todayISO`/`shiftISODate`/`buildMonthGrid`/
  `addMonths` en ese fichero.
- **Rutinas (`Routine`/`RoutineItem`) [nuevo]**: menú separado tipo
  calendario para hábitos recurrentes (p. ej. "Rutina capilar"), a
  partir de una captura de calendario real que trajo el usuario
  (columnas Lunes-Domingo, cada día con iniciales tachables). Dos tipos
  de rutina en el mismo modelo de almacenamiento (`Routine.type`):
  `"checklist"` (varias `RoutineItem` por día, cada una con su `label`
  y tachable por separado — el caso de la captura) y `"simple"` (como
  mucho un `RoutineItem` por día, sin `label`, para calendarios de racha
  tipo "no fumar" donde solo se tacha el día entero). Los items se piden
  por rango de fechas (`GET /api/routines/{id}/items?start=...&end=...`)
  porque el frontend pinta un mes entero de una vez. No hay endpoint de
  "marcar racha" especial: en rutinas "simple" el frontend crea el item
  con `done=true` al primer click y alterna el campo `done` en los
  siguientes, en vez de borrar/crear cada vez.
- **Importación masiva de rutinas (`PUT /api/routines/{id}/items/bulk`)
  [nuevo]**: a petición del usuario, para no tener que escribir cada
  inicial a mano día a día en la UI. Solo rutinas `"checklist"` (400 si
  se llama en una `"simple"` — ahí no tiene sentido, es un solo check).
  Payload `{"days": [{"date", "labels": [...]}]}`: por cada día de la
  lista, BORRA todos sus `RoutineItem` existentes y los reemplaza por
  `labels` (pierde el estado `done` que tuvieran — es "fijar el plan de
  ese mes", no un merge). Un día que no aparece en `days` no se toca,
  así que se puede pegar solo una parte del mes. Pensado para pegarse
  de una sentada, no para ejecutarse repetidamente con solapes parciales.

## Estructura

Ver README.md — se mantiene ahí para no duplicar.

## Rutinas (frontend) [nuevo]

- `src/app/routines/page.tsx` — listado de rutinas (tarjetas con color,
  nombre y tipo), botón "+ Nueva rutina" abre
  `src/components/routines/routine-form-dialog.tsx` (nombre + color +
  tipo checklist/simple). Borrar rutina tiene confirmación en dos pasos
  como el gestor de categorías. **No implementado todavía**: renombrar
  o recolorear una rutina ya creada (hay que borrarla y recrearla).
- `src/app/routines/[id]/page.tsx` — Server Component mínimo que
  resuelve `params` (async) y exporta `instant = false`, delegando toda
  la UI a `src/components/routines/routine-detail-client.tsx` (Client
  Component). Esto es obligatorio con `cacheComponents: true`
  (`next.config.ts`): `instant` solo se puede exportar desde un Server
  Component, y esta ruta no se puede prerenderizar porque depende del
  `id` de la rutina. Si se crea otra ruta dinámica (`/algo/[id]`) que
  sea 100% cliente, replicar este mismo patrón de separación
  page.tsx (server, fino) + *-client.tsx (el componente real), si no
  `next build` falla.
- `src/components/routines/routine-day-cell.tsx` — una celda del
  calendario. En rutinas "checklist" lista los items del día (click en
  el texto tacha, icono de aspa al hover borra) más un control "+" que
  revela un input inline para añadir uno nuevo (Enter añade y deja el
  input abierto para encadenar altas, Escape/blur lo cierra). En
  rutinas "simple" toda la celda es un botón: la tachas/destachas entera.
- `src/lib/date.ts` — además de las utilidades de fecha del dashboard
  diario, tiene `buildMonthGrid(year, month)` (cuadrícula Lunes-Domingo
  de 5 o 6 semanas, con relleno del mes anterior/siguiente, igual que
  Google Calendar), `addMonths()`, `daysInMonth()` e `isoFromYMD()`.
  Construida SOLO con el constructor numérico `new Date(year, month,
  day)` (hora local inequívoca) y `toLocaleDateString()` — nunca con
  `toISOString()` ni parseando strings de fecha, por el mismo motivo
  que `shiftISODate`: evitar el bug de zona horaria ya corregido una
  vez (ver la entrada de arquitectura más arriba).
- `src/lib/routine-bulk-text.ts` + `routine-import-dialog.tsx`
  [nuevo] — importación masiva por mes: botón "Importar" junto al
  navegador de mes (solo en rutinas "checklist"), abre un diálogo con
  un textarea precargado con lo que ya hay ese mes (`formatRoutineBulkText`)
  en formato `"<día>. <inicial1>, <inicial2>"` (una línea por día,
  número = día del mes, no orden de las líneas). Al guardar,
  `parseRoutineBulkText` separa días válidos de líneas con problemas
  (día fuera de rango, línea irreconocible, día repetido en el texto —
  se queda con la última) y solo bloquea el envío si NINGÚN día se
  reconoció; los errores se muestran pero no impiden importar los días
  que sí se entendieron. Llama a `routineItemsApi.bulkSet()` →
  `PUT /api/routines/{id}/items/bulk`.
- `src/components/layout/nav-links.tsx` — pestañas "Hoy" / "Rutinas" en
  el Navbar (usa `usePathname`). `Navbar` ahora acepta `date` /
  `onDateChange` / `streak` / `streakLoading` como props OPCIONALES
  (antes eran obligatorias): sin `date` no pinta ni el día de la semana
  ni los controles de navegación de fecha, para poder reutilizar el
  mismo Navbar como cabecera en `/routines` sin esos controles. Si se
  añade una sección nueva, reutilizar `<Navbar />` (sin esas props) en
  vez de construir una cabecera distinta.

## Qué falta y en qué fase está el proyecto

Ver `ROADMAP.md` — lista única de pendientes (deliberadamente
pospuestos, no olvidados) y las fases nube → local (Arch Linux +
Omarchy) → servidor propio. No dupliques esa lista aquí.

## Estado del frontend (Next.js) [actualizado]

`frontend/` ya tiene **las pantallas reales construidas**, no solo
andamiaje: Next.js + TypeScript + Tailwind v4 (config CSS-first en
`globals.css`) + shadcn/ui + Lucide + SWR + Axios + Recharts + Framer
Motion, todo en uso.

**Páginas/componentes:**
- `src/app/page.tsx` — dashboard real de un día: Navbar + Frase del día
  + Tareas + Sueño, animado con Framer Motion (stagger de entrada) y
  conectado a la API vía los hooks de `src/hooks/`. [actualizado] Se
  quitaron de la UI las notas libres y el selector de ánimo (eran
  `notes-card.tsx` y la mitad "¿Cómo te sientes hoy?" de
  `reflection-card.tsx`) — decisión explícita del usuario para reducir
  fricción, no un recorte accidental. El endpoint `daily` y los campos
  `mood`/`notes` siguen existiendo en el backend (`app/models.py`,
  `app/schemas.py`); `reflection-card.tsx` sigue reenviando esos valores
  tal cual vienen de `entry` al guardar la frase, para no pisarlos con
  `null`. Si se quiere recuperar esa UI más adelante, el patrón de
  sincronización de formulario (ver más abajo) es el mismo que ya se
  usaba.
- `src/components/layout/navbar.tsx` — barra superior glass, navegación
  de fecha, badge de racha. El día de la semana (`formatLabel`) y los
  títulos de tarjeta (`CardTitle` en `src/components/ui/card.tsx`) se
  agrandaron a petición del usuario — no reducir su tamaño sin que lo
  pida.
- `src/components/dashboard/` — una tarjeta por funcionalidad:
  `task-card.tsx` (formulario + lista animada con `AnimatePresence` +
  gráfico de barras Recharts del desglose por categoría),
  `sleep-card.tsx` (formulario + donut Recharts de fases + duración
  calculada, a ancho completo), `reflection-card.tsx` (solo la frase
  del día), `category-manager-dialog.tsx` (CRUD de categorías en un
  `Dialog` de shadcn).
- `src/components/ui/` — componentes shadcn escritos a mano (Button,
  Card, Input, Textarea, Label, Select, Dialog, Separator, Badge,
  Skeleton, ToggleGroup, Sonner/Toaster), porque este entorno de
  generación no tenía salida de red hacia `ui.shadcn.com` (solo
  npm/GitHub) y el CLI de shadcn no podía ejecutarse. `components.json`
  está configurado como si `shadcn init` se hubiera ejecutado, así que
  `npx shadcn@latest add <componente>` funciona sin fricción en una
  máquina con internet normal para añadir componentes nuevos — generará
  código consistente con los que ya existen.

**Patrón de sincronización de estado en formularios** (importante si
tocas `sleep-card.tsx` o `reflection-card.tsx`): NO
usan `useEffect` + `setState` para sincronizar el formulario cuando
llega una `entry`/`sleep` nueva de la API — eso dispara el lint error
`react-hooks/set-state-in-effect` (regla nueva de React 19 / el
`eslint-config-next` de este proyecto). En su lugar usan el patrón
oficial de React "ajustar estado durante el render": guardan la prop
anterior en un `useState` y comparan por referencia en el cuerpo del
componente (`if (prop !== prevProp) { setPrevProp(prop); setState(...) }`).
Tampoco se debe escribir en un `ref.current` durante el render (otro
lint error, `react-hooks/refs`) — por eso estos componentes comparan el
valor "guardado" directamente contra la prop (`entry?.notes`) en vez de
guardar una copia en un `ref`. Replicar este patrón en cualquier
componente nuevo que sincronice estado local editable desde datos
asíncronos de SWR.

Modo oscuro: fijo por defecto (clase `dark` en `<html>`,
`src/app/layout.tsx`). Pendiente añadir `next-themes` si se quiere un
selector real de tema.

**Pendiente de construir:** selector de tema claro/oscuro real, vista
de tendencias (gráficos históricos más allá de un solo día), objetivos
a medio/largo plazo, exportación a PDF.

## Cómo seguir desde aquí

El desarrollo continúa compartido entre dos entornos: este sandbox en
la nube (efímero, se borra al terminar la sesión — por eso aquí nunca
se meten datos reales) y el **Arch Linux del usuario, bajo una capa
Omarchy** (persistente — ahí sí vale la pena meter datos reales en
`data/habitos.db` en cuanto esté levantado).

Los comandos exactos para arrancar backend y frontend están en
`README.md` → "Arrancar en local" (son los mismos en la nube, en Arch
Linux o en cualquier Linux/macOS — no hay nada específico de Omarchy
más allá de tener Python 3 y Node instalados). Nota sobre
`--reload-dir app` en el comando de uvicorn: sin él, uvicorn vigila
todo el repo, incluido `frontend/node_modules`, y se reinicia solo cada
vez que `npm install` toca algo ahí.

**Verificación tras cambios grandes en el frontend:**
```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
npx eslint src
```
`next build` falla en este sandbox de la nube por no poder llegar a
`fonts.googleapis.com` — no es un bug real de la app (confirmado
funcionando en una máquina con internet normal, incluido Arch Linux).
Si hace falta verificarlo de todas formas en la nube, hay un
procedimiento (quitar temporalmente las Google Fonts de `layout.tsx`,
compilar, restaurar) en `frontend/README.md`. En local esto no debería
pasar.

Qué se hizo en cada sesión concreta y qué queda pendiente para la
siguiente vive en `SESSIONS.md` — léelo primero al empezar una sesión
nueva. Qué falta implementar en general (no ligado a una sesión
concreta) vive en `ROADMAP.md`.
