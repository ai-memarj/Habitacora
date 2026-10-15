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
- **Alembic, no `create_all()`** [actualizado 2026-10-15]: la condición
  que marcaba este cambio ("en cuanto haya datos reales que no se puedan
  perder") se cumplió el 2026-10-15, con el registro diario real ya
  empezado en `data/habitos.db`. `app/main.py` ya NO llama a
  `Base.metadata.create_all()`: ejecuta `alembic upgrade head` al
  arrancar (`_run_migrations()`). El motivo de automatizarlo en vez de
  dejarlo como paso manual es que esto es una app personal de un solo
  desarrollador y olvidar `alembic upgrade head` tras un `git pull` es
  el fallo más probable; es idempotente, así que con `--reload` no
  molesta. En Fase 3 conviene hacerlo explícito en el despliegue y
  quitarlo del arranque.
  - `migrations/env.py` lee la URL de `app.database.DATABASE_URL`, NO de
    `alembic.ini`, para que migrar a Postgres en Fase 3 sea cambiar una
    sola variable de entorno y no acordarse de dos sitios.
  - `render_as_batch=True` es obligatorio mientras el motor sea SQLite:
    SQLite no soporta `ALTER`/`DROP COLUMN` y Alembic necesita el truco
    de tabla temporal + copia.
  - La migración `199b38d4d4cf` es el baseline (el esquema tal como
    estaba el 2026-10-15). La base de datos que ya existía se sembró con
    `alembic stamp`, no recreándola. Si tocas `app/models.py`, genera su
    migración (`alembic revision --autogenerate`) ANTES de arrancar la
    app, o la app arrancará contra un esquema que no coincide.
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
- **Rutinas: una sola estructura, sin tipos** [reescrito 2026-10-15]:
  menú tipo calendario para hábitos recurrentes. Antes `Routine.type`
  obligaba a elegir entre `"checklist"` y `"simple"` AL CREAR la rutina,
  que es justo cuando menos claro se tiene qué forma va a tener — el
  usuario lo describió como "mi problema para englobar todo tipo de
  rutinas en una pantalla". Ese campo ya no existe. Una rutina es:

      nombre + color
      + vocabulario (`RoutineActivity`: nombre, iniciales, color, cupo)
      + patrón      (`cycle_length`/`cycle_start` + `RoutineCycleSlot`)
      + meta        (`goal_days`)

  Las tres formas que aparecen en la práctica son esa misma estructura
  rellenada a distintos niveles, y **el modo se DEDUCE** en el frontend
  (`routineMode()` en `src/lib/routine-cycle.ts`), no se almacena:
  - *Pauta* (rutina capilar): vocabulario + ciclo. El ciclo dice qué
    toca cada día; el calendario existe para saber qué te toca.
  - *Cupo* (entrenos de la semana): + `quota` en las actividades. El
    ciclo PROPONE un reparto y los cupos se verifican por repetición del
    ciclo; el calendario existe para repartir carga.
  - *Reto* ("30 días sin fumar"): una actividad, ciclo de 1 día y
    `goal_days`. El calendario existe para ver el bloque sin huecos.

  Si añades un comportamiento nuevo, la pregunta correcta es "¿de qué
  campo se deduce?", no "¿qué tipo nuevo hace falta?".

- **Los cupos se cuentan por repetición del ciclo, no por semana
  natural** [nuevo]: si el plan decía boxeo el martes y lo hiciste el
  miércoles, has cumplido — evaluar por día pintaría un hueco el martes
  y un extra el miércoles, dos errores donde no hubo ninguno. Contar por
  ventana de ciclo además evita que un ciclo de 4 días tenga que
  inventarse dónde empieza "la semana". Con un ciclo de 7 días anclado a
  un lunes la ventana coincide con la semana natural, y entonces
  `cycleAlignsWithWeeks()` es `true` y el resumen se pinta como columna
  extra al final de cada fila del calendario; si no, va en una tira
  debajo.

- **Un ciclo de 7 días anclado a un lunes ES una plantilla semanal**
  [nuevo]: se valoró tener los dos conceptos (plantilla semanal y ciclo
  de N días) y se descartó — el ciclo de N días con ancla los generaliza.
  El editor nombra las columnas con los días de la semana cuando
  `cycle_length === 7` y hay ancla, para que se lea como lo que es.

- **El patrón se ESTAMPA, no se pinta al vuelo** [nuevo]: definir el
  ciclo no cambia el calendario; hay que proyectarlo sobre un mes
  ("Estampar"), lo que crea `RoutineItem` reales. Cuesta un botón más,
  pero permite editar un mes concreto sin tocar el patrón (una semana de
  vacaciones, un mes con lesión) y, sobre todo, **cambiar el ciclo no
  reescribe el pasado**: el historial sigue diciendo lo que de verdad
  tocaba entonces. El estampado NO tiene endpoint propio: el cliente
  genera los días (`buildStampDays()`) y los manda al pegado masivo que
  ya existía, coherente con "backend como API pura".

- **Estampar no pisa los días que ya tienen algo** [nuevo]: el pegado
  masivo sustituye el día entero, así que estampar encima borraría
  tachones ya hechos. El diálogo excluye por defecto los días ocupados y
  ofrece una casilla para sustituirlos explícitamente. Mismo criterio de
  "no destructivo por omisión" que la importación de días desde Markdown.

- **El reto necesita tres estados, y salen sin columnas nuevas**
  [nuevo]: sin item = sin registrar, `done=True` = cumplido,
  `done=False` = **roto explícitamente**. Sin esa distinción la racha
  tendría que adivinar si un hueco es un fallo o un día que simplemente
  no se registró. La celda cicla entre los tres al hacer clic.

- **`RoutineActivity` sustituye al `label` de texto libre** [nuevo]: con
  texto libre, `"Boxeo"`, `"boxeo"` y `"box"` eran tres cosas distintas
  para la base de datos — imposible contar cupos, colorear por tipo o
  agrupar, y cualquier falta de ortografía partía los datos en silencio.
  `RoutineItem.label` se mantiene para items sueltos y por
  compatibilidad; la migración `aec409623a69` convierte los labels
  existentes de cada rutina en actividades. Borrar una actividad con
  días registrados se rechaza (400), **misma regla que las categorías
  con tareas** — borrarla se llevaría historial real por delante; los
  slots del ciclo sí caen en cascada, porque son plan y no registro.

- **Sin jerarquía de actividades** [decisión explícita]: el usuario
  describió "2 de acondicionamiento (uno carrera continua, otro
  intervalos)", que sugeriría agrupar actividades. Se descartó: con cupo
  1 a carrera y cupo 1 a intervalos se obtiene la misma restricción y
  MÁS información (`Carrera 1/1 · Intervalos 0/1` dice cuál falta, donde
  `Acond 1/2` no). Solo haría falta para "2 de acondicionamiento, me da
  igual cuáles" — anotado en `to_attend.md`.

## Estructura

Ver README.md — se mantiene ahí para no duplicar.

## Rutinas (frontend) [reescrito 2026-10-15]

**Todo el diseño de una rutina se hace desde la pantalla de la rutina**,
no sembrando la base de datos ni en diálogos aparte. Fue un requisito
explícito del usuario, y es también lo que hace viable que no haya
tipos: se rellena lo que haga falta ahí y la rutina toma su forma.

- `src/lib/routine-cycle.ts` — **toda** la lógica de ciclos, cupos y
  rachas, en funciones puras: `routineMode()`, `cycleDayIndex()`,
  `cycleWindowIndex()`/`cycleWindow()`/`cycleWindowsInRange()`,
  `cycleAlignsWithWeeks()`, `quotaTally()`, `cycleBalance()`,
  `buildStampDays()`, `streakInfo()`. Separado de los componentes por el
  mismo motivo que `day-import-md.ts`: aquí vive lo más fácil de
  equivocar (módulos de números negativos para fechas anteriores al
  ancla, ventanas de ciclo, aritmética cruzando el cambio de hora).
  **Probado**: `cd frontend && npx tsx scripts/test-routine-cycle.ts`
  (33 asserciones, incluido el DST del 25-oct). Si tocas este fichero,
  pasa ese script — no hay runner de tests configurado, se ejecuta a
  mano.
- `src/components/routines/routine-config-panel.tsx` — el panel
  plegable (botón "Configurar") que contiene vocabulario + patrón, en la
  MISMA pantalla que el calendario. Plegado muestra una línea con la
  forma (`routineShapeLabel()`). Deliberadamente no es un diálogo ni otra
  ruta: una rutina se diseña mirando su calendario, y tachar (lo que se
  hace el 95% de las veces) debe seguir siendo un clic sin capas.
- `routine-activities-panel.tsx` — el vocabulario. Las iniciales se
  autocompletan desde el nombre ("Carrera continua" → "CAR") hasta que
  el usuario las edita a mano. **Cupo vacío = `null`, no `0`**: son
  cosas distintas ("no cuenta para el reparto" frente a "hazlo cero
  veces"). El `maxLength` del cupo se recorta en el `onChange` porque no
  funciona en `<input type="number">` (ver más abajo).
- `routine-cycle-editor.tsx` — N días + ancla + meta, con las
  actividades colocables en cada día del ciclo. Lo importante es la
  línea de validación: `cycleBalance()` compara lo colocado con los
  cupos y dice "✓ cuadra — 9 de 9 repartidas" o "falta 1 BOX, sobra 1
  MOV". Eso es lo que resuelve el "repartir" del usuario sin que tenga
  que llevar la cuenta en la cabeza. Estampar está deshabilitado
  mientras el patrón tenga cambios sin guardar.
- `routine-stamp-dialog.tsx` — proyecta el patrón sobre el mes natural
  (no sobre la cuadrícula completa: estampar días de relleno del mes
  anterior sorprendería a quien pide "rellena octubre"). Excluye por
  defecto los días que ya tienen algo.
- `routine-cycle-summary.tsx` — lo hecho frente al cupo de una ventana.
  Hacer de más no se regaña: muestra `2/2 ✓ (+1)`.
- `routine-header-summary.tsx` — **una sola cabecera** que muestra lo
  que aplique según el modo deducido (progreso+racha / ciclo actual /
  días del mes cumplidos). No hay tres cabeceras.
- `routine-day-cell.tsx` — en pauta/cupo lista los items del día con el
  color de su actividad y un "+" que despliega el vocabulario para
  elegir (ya no se escribe texto; si la rutina aún no tiene vocabulario
  sí se permite texto suelto, para no bloquear). Si el día está vacío
  pero el patrón dice que toca algo, se pinta esa pista en punteado y
  clicarla la registra. En reto, la celda entera cicla por los tres
  estados.
- `routine-detail-client.tsx` — la pantalla. Las celdas de una fila van
  como hijas directas del mismo `grid` (una fila no puede ser un `<div>`
  envolvente, rompería la cuadrícula): se agrupan en un fragmento. Si
  `cycleAlignsWithWeeks()`, la cuadrícula pasa a 8 columnas y el
  resumen de cada ventana va al final de su fila.
- `src/app/routines/page.tsx` — el badge del listado sale de
  `routineMode()`, y debajo la forma (`routineShapeLabel()`). **No se
  muestra progreso por tarjeta a propósito**: haría falta una petición
  de items por rutina. Crear una rutina lleva directo a su pantalla
  (`router.push`), porque lo siguiente que hay que hacer siempre es
  configurarla.
- `src/app/routines/[id]/page.tsx` — sin cambios: Server Component
  mínimo que resuelve `params` y exporta `instant = false`, delegando en
  el Client Component. Obligatorio con `cacheComponents: true` — si se
  crea otra ruta dinámica 100% cliente, replicar este patrón o
  `next build` falla.
- `src/lib/routine-bulk-text.ts` — el pegado por texto ahora resuelve
  los nombres contra el vocabulario (acepta iniciales o nombre completo,
  sin distinguir mayúsculas ni acentos). Un nombre que no está en el
  vocabulario **no crea una actividad nueva**: se avisa y el día importa
  con lo que sí se reconoció, igual de permisivo que antes.
- `src/lib/date.ts` — sin cambios. Sigue siendo el único sitio con
  aritmética de fechas; `routine-cycle.ts` la usa, nunca `toISOString()`.
- **Arrastrar items entre días** (`routine-day-cell.tsx`): drag & drop
  HTML5 nativo. El `dataTransfer` usa un tipo propio
  (`application/x-habitacora-item`) y no `text/plain`, para no confundir
  texto arrastrado desde fuera del navegador con un item. El destino NO
  se restringe a la misma ventana de ciclo: mover una sesión a otra
  semana es legítimo, y los contadores de cupo lo reflejan solos porque
  cuentan a partir de la fecha del item. Desactivado en rutinas tipo
  reto (ahí la celda entera ya es un botón de tres estados).
  **Cómo probarlo con automatización** (verificado 2026-10-15): con
  Playwright funciona directamente — `page.locator(origen).dragTo(
  page.locator(destino))`, que es lo que hace `browser_drag` del MCP, y
  mueve el item de verdad (comprobado dentro de la misma semana y entre
  semanas, con los contadores de cupo cambiando de ventana). Lo que NO
  sirve son los eventos de ratón sintéticos de la extensión de Chrome:
  no disparan el drag & drop HTML5, hay que despachar `DragEvent` con un
  `DataTransfer` a mano. Y un aviso de método: si marcas elementos con
  `id` desde la consola para localizarlos, hazlo **inmediatamente antes**
  del arrastre — cualquier re-render de React por el medio (p. ej. una
  revalidación de SWR tras tachar algo) puede reemplazar esos nodos y el
  arrastre se ejecuta contra uno obsoleto sin dar error, lo que parece un
  bug de la app y no lo es.
- **No implementado**: renombrar/recolorear una rutina ya creada (sigue
  pendiente desde antes), en `ROADMAP.md`.

## Sistema de diseño [nuevo 2026-10-15]

Dirección de arte y reglas de uso: `.claude/skills/desing-system/SKILL.md`
(regla 70/20/10, referentes Linear/Vercel/Reflect). Aquí va solo el
"por qué" de cómo está construido el sustrato en código.

**El diagnóstico que lo motivó**: la app tenía el vocabulario de un
producto premium (oscuro, glass, Fraunces, Framer Motion) pero ninguna
de las escalas que lo sostienen. Todo vivía en una elevación, con un
borde y un peso de badge. Eso es lo que hacía que se leyera como MVP —
no era falta de pulido, era que la jerarquía no existía.

- **Profundidad por luminancia, no por borde ni sombra**
  (`globals.css`): cuatro escalones `--surface-0..3`. Los tokens
  semánticos que ya existían (`--background`, `--card`) se DERIVAN de
  esa escala, así que siguen siendo API válida y nada de lo que los
  usaba cambió. Si necesitas un nivel nuevo, añádelo a la escala; no
  inventes un color suelto.
- **El borde es alfa, no gris**: `--border` pasó de `240 6% 16%` a
  `white/6%`. Un gris opaco se pelea con la superficie que tenga debajo
  (era lo que convertía el calendario de Rutinas en una hoja de
  cálculo); una alfa se funde con cualquiera de los cuatro escalones.
  `--border-strong` para los pocos casos que pidan más.
- **`.edge` sustituye a `shadow-sm`**: sobre un fondo casi negro una
  sombra proyectada no se percibe como elevación, solo emborrona el
  contorno. La separación la da un realce interior de 1px arriba, que es
  como lo resuelven Linear/Vercel. Aplica a tarjetas y a botones
  sólidos. **No reintroduzcas `shadow-*` en superficies oscuras.**
- **`--accent-emotional` separado de `--primary`** [importante]: la
  skill reserva el color para tres momentos (frase del día, racha,
  cierre del día). Antes TODO badge usaba `soft` violeta, así que los
  minutos de cada tarea competían con la racha: cuatro acentos en una
  lista de cuatro tareas y cero en los momentos que lo merecen. Tener el
  acento emocional en su propio token hace que gastarlo en un badge
  secundario deje de ser el camino fácil.

**Primitives** (`src/components/ui/`) — compón variantes, no crees
markup paralelo:
- `Card`: `quiet` (por defecto) / `elevated` / `editorial` / `ghost`, y
  densidades de padding en `CardHeader`/`CardContent`/`CardFooter`.
  Existen para poder construir Bento: **apilar tarjetas idénticas es el
  error que hay que evitar**.
- `Badge`: **`metric` es el destino de cualquier cifra** (minutos,
  cupos, porcentajes) — neutro y con `tabular-nums`. `emotional` solo
  para los tres momentos. `soft` queda para compatibilidad, pero en
  vistas nuevas elige entre esos dos.
- `Input`: `line` formaliza el estilo "sin caja" que estaba copiado a
  mano como constante `fieldClass` duplicada en `today-card.tsx` y
  `task-card.tsx`; `numeric` activa cifras tabulares (automático en
  `type="number"`).
- `Button`: `icon-sm` para filas densas de botones-icono.

**Dos trampas que costaron tiempo y volverán a aparecer:**

1. **Turbopack cachea `globals.css` de forma agresiva.** Un cambio de
   tokens puede no reflejarse ni reiniciando `npm run dev`: hay que
   borrar `.next`. Si tocas `globals.css` y el navegador sigue mostrando
   los valores viejos, no busques el fallo en tu CSS — `rm -rf .next` y
   vuelve a arrancar. Compruébalo leyendo la hoja servida, no la
   pantalla:
   `curl -s localhost:3000/_next/static/.../x.css | grep -o "\.edge-soft {[^}]*}"`
2. **No anides alfa sobre un token que ya la lleva.**
   `hsl(var(--edge-highlight) / 0.6)` cuando `--edge-highlight` ya vale
   `0 0% 100% / .05` produce `hsl(... / .05 / .6)`, que es CSS inválido:
   el navegador **descarta la regla en silencio** y el efecto desaparece
   sin ningún error. Por eso `.edge-soft` tiene su propio token. Ni
   `tsc` ni `eslint` ni `next build` detectan esto — solo mirarlo en el
   navegador.

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
- `src/app/page.tsx` — dashboard real de un día: Navbar + `DayNav` (fecha
  + racha + selector de día) + `TodayCard` (frase + sueño) + Tareas,
  animado con Framer Motion (stagger de entrada) y conectado a la API
  vía los hooks de `src/hooks/`. [actualizado] Se quitaron de la UI las
  notas libres y el selector de ánimo (eran `notes-card.tsx` y la mitad
  "¿Cómo te sientes hoy?" de la antigua `reflection-card.tsx`) —
  decisión explícita del usuario para reducir fricción, no un recorte
  accidental. El endpoint `daily` y los campos `mood`/`notes` siguen
  existiendo en el backend (`app/models.py`, `app/schemas.py`);
  `today-card.tsx` sigue reenviando esos valores tal cual vienen de
  `entry` al guardar la frase, para no pisarlos con `null`. Si se quiere
  recuperar esa UI más adelante, el patrón de sincronización de
  formulario (ver más abajo) es el mismo que ya se usaba.
- `src/components/layout/navbar.tsx` [actualizado] — cabecera global,
  solo identidad + navegación + versión (icono/nombre a la izquierda,
  pestañas Hoy/Rutinas centradas con `grid-cols-3`, versión de
  `package.json` a la derecha). Deliberadamente sin fecha ni racha: eso
  es contenido de la página "Hoy", no de la marca global — vive en
  `src/components/dashboard/day-nav.tsx`, que se renderiza debajo del
  Navbar solo en `page.tsx` (no en `/routines`). El día de la semana
  (`formatLabel`, ahora en `day-nav.tsx`) y los títulos de tarjeta
  (`CardTitle` en `src/components/ui/card.tsx`) se agrandaron a petición
  del usuario — no reducir su tamaño sin que lo pida.
- `src/components/dashboard/date-picker-popover.tsx` [nuevo] — sustituye
  el `<input type="date">` nativo (rompía la estética glass/oscura) por
  un botón + mini-calendario propio (sin Radix Popover: cierre al click
  fuera gestionado a mano con un listener `mousedown`), reutilizando
  `buildMonthGrid`/`addMonths` de `lib/date.ts`. Incluye un atajo "Hoy".
- `src/components/dashboard/` — una tarjeta por funcionalidad:
  `task-card.tsx` (formulario + lista animada con `AnimatePresence` +
  gráfico de barras Recharts del desglose por categoría; el botón de
  añadir es solo el icono "+", sin texto, y el nombre de tarea tiene
  `maxLength={60}`), `today-card.tsx` [nuevo, sustituye a
  `sleep-card.tsx` + `reflection-card.tsx`] (frase del día sin título,
  con sueño debajo en el mismo bloque y la misma estética sin recuadros
  — campos con solo borde inferior, no `Input` con caja — porque el
  usuario los veía como dos formularios descoordinados en vez de un
  único registro "de hoy"; la frase se autoguarda al perder el foco como
  antes, el sueño tiene su propio botón de guardar — icono `Save`,
  `variant="default"` igual que el "+" de tareas — porque son varios
  campos relacionados que conviene confirmar juntos en vez de uno a
  uno), `category-manager-dialog.tsx` (CRUD de categorías en un
  `Dialog` de shadcn; nombre de categoría con `maxLength={24}`, tanto al
  crear como al renombrar — es una etiqueta corta tipo chip, no una
  frase).
- `src/components/ui/` — componentes shadcn escritos a mano (Button,
  Card, Input, Textarea, Label, Select, Dialog, Separator, Badge,
  Skeleton, ToggleGroup, Sonner/Toaster), porque este entorno de
  generación no tenía salida de red hacia `ui.shadcn.com` (solo
  npm/GitHub) y el CLI de shadcn no podía ejecutarse. `components.json`
  está configurado como si `shadcn init` se hubiera ejecutado, así que
  `npx shadcn@latest add <componente>` funciona sin fricción en una
  máquina con internet normal para añadir componentes nuevos — generará
  código consistente con los que ya existen.

**`maxLength` no funciona en `<input type="number">`** (navegadores lo
ignoran salvo en inputs de texto): las horas/minutos de `task-card.tsx`
limitan sus 2 caracteres recortando el valor en el propio `onChange`
(`e.target.value.slice(0, 2)`), no con el atributo `maxLength`. Si se
añade un límite de caracteres a un campo numérico nuevo, replicar este
patrón, no el atributo.

**Sesión de automejora de "Hoy" [nuevo]**: a petición del usuario,
rondas de "propón mejoras → el usuario elige → se implementan → se
resume" sobre la pantalla "Hoy". De la primera ronda:
- `today-card.tsx`: la duración del sueño calculada ya no depende de
  que haya porcentajes de fase rellenados (antes vivía dentro del
  `{chartData.length > 0 && ...}` del donut, así que si solo rellenabas
  horas sin fases no se veía); ahora es un badge junto a
  "Dormir"/"Despertar", independiente del gráfico. El guardado de sueño
  ya no usa `toast.success` — muestra un "Guardado" inline con
  check (Framer Motion) junto al botón, que se desvanece solo; el toast
  de error se mantiene porque sí hace falta sacar al usuario de lo que
  esté mirando cuando algo falla.
- `task-card.tsx`: la fila de añadir tarea (categoría, nombre, horas,
  minutos) pasó al mismo estilo "sin caja" que ya tenía `today-card.tsx`
  (constante `fieldClass` en el propio archivo) — unifica el lenguaje
  visual de toda la pantalla de Hoy. El campo de nombre tiene
  `id="task-name-input"` para que el atajo de teclado (ver siguiente
  punto) pueda enfocarlo sin necesitar un ref/contexto compartido.
- **"Modo interactivo" (atajos de teclado) [nuevo], activable/desactivable**:
  toggle (icono teclado) en `day-nav.tsx`, estado y preferencia en
  `src/app/page.tsx` (persistida en `localStorage`, clave
  `habitacora:shortcuts-enabled` — es una conveniencia de cliente, no
  pinta nada en el backend). Mientras está activo: `←`/`→` cambian de
  día, `N` enfoca el nombre de tarea. Se desactiva automáticamente si el
  foco ya está en un `input`/`textarea`/contenido editable, para no
  interferir con lo que se esté escribiendo (p. ej. mover el cursor con
  las flechas dentro de la frase del día). Si se añade un atajo nuevo,
  el listener ya existente en `page.tsx` es el sitio donde añadirlo, no
  un hook nuevo — es una sola pantalla, no hace falta la abstracción.

De la segunda ronda:
- Atajos ampliados: `H` vuelve a hoy, `G` guarda el sueño — simula un
  click en `id="sleep-save-button"` (botón de `today-card.tsx`) en vez
  de duplicar la llamada a la API en `page.tsx`, para no tener dos
  sitios que serialicen los campos de sueño.
- `shortcuts-help-popover.tsx` [nuevo]: icono "?" junto al toggle de
  atajos en `day-nav.tsx`, mismo patrón de popover sin Radix (click
  fuera cierra) que `date-picker-popover.tsx`. Si se añade un atajo
  nuevo, también hay que añadirlo a la lista `SHORTCUTS` de este
  archivo — no hay una fuente única de verdad entre el listener de
  `page.tsx` y esta lista, son dos sitios a mantener sincronizados a
  mano (se valoró y descartó generar la lista dinámicamente: para 4
  atajos no compensa la indirección).
- `task-card.tsx`: la tarea recién creada se resalta un instante
  (`bg-primary/15` con `transition-colors duration-700`, controlado por
  `justAddedId` + un `setTimeout` que se limpia al desmontar) para que
  se note cuál se acaba de añadir en la lista. El estado vacío ("Sin
  tareas registradas todavía hoy") ahora incluye un botón "Añadir la
  primera tarea" que enfoca `#task-name-input` — refuerza visualmente
  el atajo `N`.
- `app/schemas.py`: `CategoryCreate`/`CategoryUpdate.color` valida
  formato hex de 6 dígitos (`HEX_COLOR_RE` + `_validate_hex_color`,
  reutilizable). **`RoutineCreate`/`RoutineUpdate.color` NO tiene esta
  misma validación** — mismo campo, mismo problema potencial, pero
  quedó fuera del alcance de esta ronda (era sobre "Hoy", no sobre
  Rutinas); está anotado en `to_attend.md`.

De la tercera ronda:
- **Editar una tarea existente, no solo borrarla [nuevo]**: clic en
  cualquier fila de la lista (salvo el botón de borrar, que para la
  propagación con `e.stopPropagation()`) precarga el formulario de
  arriba con sus datos (`startEdit`) y el envío llama a `tasksApi.update`
  (ya existía `PUT /api/tasks/{id}` en el backend — `app/routers/
  tasks.py` — no hizo falta tocarlo, solo añadir el método al cliente
  en `lib/api.ts`) en vez de crear una tarea nueva. Un aviso "Editando
  tarea" + botón "Cancelar" aparece sobre el formulario mientras
  `editingId` está activo; el icono del botón de envío cambia de "+" a
  un check para distinguir ambos modos. Si se borra la tarea que se
  estaba editando, `handleDelete` cancela la edición en curso para no
  dejar el formulario apuntando a un id que ya no existe.
- `task-card.tsx`: el badge de minutos totales del `CardHeader` ahora
  se formatea como "Xh Ymin" en vez de solo minutos cuando pasa de 60
  (`totalLabel`); el badge de minutos de cada tarea individual se deja
  igual a propósito (son duraciones normalmente cortas, no hacía falta).
- `today-card.tsx`: pista sutil ("Registra cuánto y cómo dormiste
  anoche") que solo aparece si `sleep` es `null`/`undefined` — primera
  vez que se abre la pantalla ese día sin sueño registrado aún.
- `title` añadido a los botones "Guardar sueño" y "Ver atajos de
  teclado" (antes solo tenían `aria-label`), para que el tooltip nativo
  del navegador los explique al pasar el ratón.

De la cuarta ronda — a partir de aquí el usuario autorizó seguir
implementando y autoproponiendo sin aprobar ronda a ronda ("no
necesitas más aprobaciones hasta nuevo aviso"), excluyendo
explícitamente funcionalidades de estadísticas/tendencias (eso es fase
de desarrollo posterior, ya cubierto arriba y en `ROADMAP.md`):
- `task-card.tsx`: `startEdit` hace `formRef.current?.scrollIntoView()`
  al entrar en modo edición — si la lista de tareas es larga, el click
  puede estar lejos del formulario de arriba.
- Flujo de teclado dentro del formulario de tareas (independiente del
  "modo interactivo" — esto es navegación de formulario estándar, no
  uno de los atajos globales de `page.tsx`): `Enter` en el nombre
  mueve el foco a horas (`#task-hours-input`), `Enter` en horas mueve
  el foco a minutos (`#task-minutes-input`); `Enter` en minutos ya
  enviaba el formulario por comportamiento nativo del `<form>`, no hizo
  falta tocarlo.
- Estado vacío de categorías: si `categories.length === 0`, el
  formulario de tareas no se renderiza — en su lugar, un aviso + botón
  que abre el gestor de categorías (`onManageCategories`). Antes esto
  rompía en silencio (`categories[0]` como `undefined`).
- `app/schemas.py`: una tarea individual no puede durar más de 24h
  (`MINUTES_PER_DAY`, en `TaskCreate` y `TaskUpdate`). `app/routers/
  tasks.py`: el total de minutos de un día tampoco puede superar 24h al
  crear o actualizar una tarea (`_day_total_minutes`, excluye la propia
  tarea en una actualización); probado en caliente (`curl`) que ambos
  casos devuelven 400/422 y que un valor válido sigue funcionando.

Autopropuestas tras la autorización (misma ronda, sin pausa):
- `task-card.tsx`: borrar una tarea ahora pide confirmación en dos
  pasos (`pendingDeleteId`, mismo patrón que
  `category-manager-dialog.tsx`) en vez de borrar al primer clic — es
  el registro diario real con uso terapéutico (ver cabecera de este
  archivo), un borrado accidental sale más caro aquí que en otras
  entidades de la app.
- `today-card.tsx`: la frase del día tiene `maxLength={280}` (no tenía
  límite) — evita que una frase muy larga rompa visualmente el diseño
  compacto de la tarjeta.
- `date-picker-popover.tsx` y `shortcuts-help-popover.tsx`: `Escape`
  cierra el popover, además del click fuera que ya tenían — mismo
  listener de `keydown` añadido en los dos, consistente con que ambos
  comparten el mismo patrón de popover sin Radix.
- Pasada de consistencia: `title` añadido a todos los botones-icono de
  "Hoy" que aún solo tenían `aria-label` (flechas de día en
  `day-nav.tsx`, flechas de mes en `date-picker-popover.tsx`,
  "Gestionar categorías" en `task-card.tsx`, crear/borrar categoría en
  `category-manager-dialog.tsx` — este último título cambia a "Pulsa
  otra vez para confirmar" mientras está armado, igual que el de borrar
  tarea). Mismo criterio que ya se había aplicado puntualmente a
  "Guardar sueño"/"Ver atajos" en una ronda anterior, generalizado aquí
  a todo lo demás. Si se añade un botón-icono nuevo en esta pantalla,
  llevar siempre `title` + `aria-label` juntos, no solo el segundo.
- `today-card.tsx`: contador "X/280" bajo la frase del día, pero solo
  visible desde 40 caracteres antes del límite (`QUOTE_MAX_LENGTH`) —
  no se muestra siempre para no meter ruido visual en una tarjeta que
  ya se diseñó para no parecer un formulario.
- `date-picker-popover.tsx`: el botón "Hoy" del pie ahora muestra
  también la fecha ("Hoy (13 oct)"), para no tener que recordar qué día
  es mientras se navega varios meses atrás/adelante en el calendario.

**Importación masiva del dashboard diario desde Markdown [nuevo]**: a
petición directa del usuario (no autopropuesta), pensado para meter
registros retroactivos de golpe en vez de día a día por la UI —
encaja con la Fase 2 ("empezar a meter datos reales"). Formato y
parser en `src/lib/day-import-md.ts`; diálogo + orquestación contra la
API en `src/components/dashboard/day-import-dialog.tsx`; botón
disparador (icono `FileUp`) en `day-nav.tsx`, al lado de los demás
botones globales de la pantalla.
- **Formato**: uno o varios días por archivo, cada uno
  `## YYYY-MM-DD` con hasta tres secciones opcionales en cualquier
  orden — `### Tareas` (`- Categoría: Nombre (1h30m)`), `### Sueño`
  (`- Dormir: 23:30`, `- Ligero: 55%`, etc.) y `### Frase`
  (`> cita en blockquote`, puede ocupar varias líneas). "Sueño" se
  reconoce también sin tilde. Es Markdown normal, no un formato binario
  ni dependiente de esta app — se puede escribir a mano, en Obsidian,
  etc. El ejemplo completo vive como placeholder del propio textarea
  del diálogo, no se duplica aquí.
- **Permisivo como `routine-bulk-text.ts`**: cada línea se valida por
  separado; una línea rota no tira el día entero ni el resto del
  archivo, se acumula como aviso en `errors` y se sigue. Solo se
  bloquea el envío si NINGÚN día se reconoció en absoluto.
- **No destructivo por omisión** — esto es lo que lo diferencia del
  bulk de Rutinas (que sí sustituye el día entero): una sección que un
  día no menciona NO se toca.
  - Tareas: se sustituyen TODAS las de ese día por las del archivo,
    pero solo si al menos una línea se resolvió bien (nombre de
    categoría encontrado en las categorías existentes — el importador
    nunca crea categorías nuevas). Si todas las líneas de tareas de un
    día fallan, las tareas que ya hubiera ese día no se tocan.
  - Sueño y Frase: `PUT /api/sleep` y `PUT /api/daily` sustituyen la
    fila ENTERA (ver `app/routers/sleep.py`/`daily.py`, no hacen merge
    por campo), así que `day-import-dialog.tsx` primero hace `GET` del
    día (nuevos `sleepApi.get`/`dailyApi.get` en `lib/api.ts`, devuelven
    `null` en 404 en vez de lanzar) y rellena con esos valores los
    campos que el `.md` no menciona — incluido `mood`/`notes`, igual
    que ya hacía `today-card.tsx` al guardar solo la frase. Si la
    sección "Sueño" existe pero todas sus líneas fallan al parsear,
    `day.sleep` queda `{}` (sin campos) — el diálogo lo detecta
    (`Object.values(sleep).some(...)`) y no dispara ningún guardado
    vacío; probado explícitamente con `node` sobre el parser antes de
    integrarlo (ver historial de esta sesión en `SESSIONS.md`).
- Nuevo en `lib/api.ts`: `tasksApi.list(date)` (ya existía
  `GET /api/tasks?for_date=`, no se usaba desde el frontend),
  `sleepApi.get(date)` y `dailyApi.get(date)` (ambos envuelven el 404
  en `null`). No se añadió ningún endpoint nuevo al backend — toda la
  orquestación (fusionar, borrar-y-recrear tareas) vive en el cliente,
  coherente con "backend como API pura" (ver cabecera de este archivo).

**Patrón de sincronización de estado en formularios** (importante si
tocas `today-card.tsx`): NO usan `useEffect` + `setState` para
sincronizar el formulario cuando llega una `entry`/`sleep` nueva de la
API — eso dispara el lint error `react-hooks/set-state-in-effect`
(regla nueva de React 19 / el `eslint-config-next` de este proyecto). En
su lugar usan el patrón oficial de React "ajustar estado durante el
render": guardan la prop anterior en un `useState` y comparan por
referencia en el cuerpo del componente (`if (prop !== prevProp) {
setPrevProp(prop); setState(...) }`). Tampoco se debe escribir en un
`ref.current` durante el render (otro lint error, `react-hooks/refs`) —
por eso este componente compara el valor "guardado" directamente contra
la prop (`entry?.notes`) en vez de guardar una copia en un `ref`.
Replicar este patrón en cualquier componente nuevo que sincronice
estado local editable desde datos asíncronos de SWR.

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
