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
