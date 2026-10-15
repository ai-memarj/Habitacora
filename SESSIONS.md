# Bitácora de sesiones

Registro de qué se hizo en cada sesión de trabajo — en la nube o en
local — para que la siguiente sesión (sea Claude Code en la nube o en
el Arch Linux/Omarchy local del usuario) pueda continuar sin tener que
reconstruir el contexto desde cero preguntando. Entradas nuevas van
**arriba** (más reciente primero).

El "por qué" de las decisiones de arquitectura vive en `CLAUDE.md`, no
aquí; aquí vive el "qué se hizo" y "qué queda para la próxima vez" de
cada sesión concreta. El "qué falta implementar" en general (no ligado
a una sesión) vive en `ROADMAP.md`.

Formato de cada entrada: fecha, entorno (Nube / Local — Arch Linux +
Omarchy), qué se hizo, y qué debería hacer la siguiente sesión al
arrancar.

---

## Sesión — 2026-10-15 — Local (Arch Linux + Omarchy)

**Hecho:**
- Commiteado todo el trabajo pendiente de la sesión anterior, que estaba
  sin versionar (automejora de "Hoy" + importación desde Markdown), en
  tres commits: validaciones de backend, frontend, documentación.
  Configurada la identidad de git en el repo (no había ninguna en este
  Arch; los commits anteriores se hicieron en la nube).
- **Sesión de investigación**: repaso de las apps punteras del mismo
  nicho (Bearable, Daylio, Exist.io, Whoop Journal, Finch, eMoods,
  Sunsama, Year-in-Pixels, tendencia local-first/AI de 2026) y diez
  propuestas de implementación priorizadas. El usuario no eligió
  ninguna: redirigió la sesión al rediseño de Rutinas. **Las diez ideas
  no están guardadas en el repo** — si se quieren recuperar, están en el
  historial de esta conversación; las que sobrevivieron como pendientes
  reales ya estaban en `ROADMAP.md`.
- **Sesión de diseño de Rutinas**, a partir de las lagunas que planteó el
  usuario (una pauta rotatoria tipo rutina capilar, un reparto semanal de
  entrenos, y un reto tipo "30 días sin fumar", todo desde una sola
  pantalla). Decisiones tomadas por el usuario: cupo flexible evaluado
  por ciclo, patrón como ciclo de N días (que generaliza la plantilla
  semanal), y migrar los labels existentes a actividades. El "por qué" de
  cada decisión está en `CLAUDE.md`.
- **Rutinas v2 implementada completa** (pasos 0 a 4 del plan acordado):
  - **Alembic** sustituye a `create_all()`. Baseline del esquema
    existente + `alembic stamp` sobre `data/habitos.db` (sin recrearla),
    migración v2 con conversión de labels→actividades, y
    `alembic upgrade head` automático al arrancar la app. Round-trip
    `upgrade`/`downgrade` probado sobre una copia con datos falsos.
  - Backend: `RoutineActivity` (vocabulario, con `quota`),
    `RoutineCycleSlot` (el patrón), `cycle_length`/`cycle_start`/
    `goal_days` en `Routine`, `activity_id` en `RoutineItem`, y fuera
    `Routine.type`. Endpoints de actividades y de ciclo; el bulk acepta
    `activity_ids`; los items se pueden mover de día.
  - Frontend: `lib/routine-cycle.ts` con toda la lógica pura (+ 33
    asserciones en `scripts/test-routine-cycle.ts`), panel de
    configuración plegable en la propia pantalla de la rutina
    (vocabulario + editor de patrón con validación "✓ cuadra"),
    estampado sobre un mes, resumen de cupos por ciclo, cabecera
    deducida y tri-estado en los retos.
- Verificado: `npx tsc --noEmit`, `npx eslint src scripts`,
  **`next build`** y el script de pruebas, todo en limpio. Las tres
  formas de rutina probadas de extremo a extremo por API (incluida la
  rotación de un ciclo de 4 días y la protección del estampado), y
  **los datos de prueba borrados después** — `data/habitos.db` se queda
  solo con los datos reales del usuario.
- Copia de seguridad de la base de datos antes de migrar, en el
  scratchpad de la sesión (efímero: si hace falta conservarla, copiarla
  a otro sitio).

- **Arrastrar items entre días**, que era lo último que faltaba del plan.
  Drag & drop HTML5 con un tipo propio en el `dataTransfer`.
- **Verificación visual en Chrome** (el usuario conectó la extensión a
  mitad de sesión): creada una rutina desde cero por la UI, vocabulario
  con iniciales automáticas, validador del reparto pasando de "falta 2
  BOX" a "✓ cuadra — 9 de 9", columnas del patrón renombrándose a
  Lunes-Domingo al poner el ancla en lunes, estampado de los 31 días de
  octubre, tachado actualizando los contadores de cupo, arrastre dentro
  de la misma semana y entre semanas (los contadores se mueven de una
  ventana a otra), y el tri-estado de los retos. "Hoy" sin regresiones y
  sin errores de consola.
  - Corregido de paso: la columna de resumen etiquetaba las ventanas
    como "Ciclo 0 / 1 / 2" (las anteriores al ancla tienen índice
    negativo y no decían nada); ahora muestra el rango de fechas.
  - **Nota para automatizar**: el drag & drop HTML5 no se dispara con
    eventos de ratón sintéticos; hay que despachar `DragEvent` con un
    `DataTransfer`. No era un bug de la app.
- Quedan en la base de datos **dos rutinas configuradas y vacías**
  (Entrenos como cupo, No fumar como reto): se conservó la configuración
  porque es la que describió el usuario, pero **todo el historial de
  prueba se borró** — no hay ni un día marcado que no haya marcado él.

**Para la próxima sesión:**
- Empezar a usar las dos rutinas que quedaron configuradas, y crear la
  capilar (pauta, ciclo de 4 días) que se diseñó pero no se llegó a
  crear en la UI.
- Pendiente de UI (backend ya listo): renombrar/recolorear una rutina.
  Ver `ROADMAP.md`.
- Fase 2 sigue sin cerrar: faltan datos reales sostenidos (el registro
  diario ya empezó el 2026-10-15, con tareas, sueño y frase).
- Recordar que `app/models.py` ya no perdona: cualquier cambio necesita
  su migración de Alembic (ver `README.md`).

---

## Sesión — 2026-10-13 — Local (Arch Linux + Omarchy)

**Hecho:**
- Primer arranque del entorno en el Arch Linux local: `.venv` con
  `python3.10` (Python 3.14 del sistema no tiene wheel de
  `pydantic-core` ni compila vía PyO3 — ver `to_attend.md`), backend
  (`uvicorn --reload --reload-dir app --port 8000`) y frontend
  (`npm install` + `npm run dev`) arrancados y verificados manualmente
  en el navegador por el usuario — funcionan igual que en la nube.
- `data/habitos.db` creada por primera vez en local (con el seed de
  categorías por defecto). Aún sin datos reales de uso diario, solo de
  verificación.
- Verificación estática del frontend en limpio: `npx tsc --noEmit`,
  `npx eslint src`, y **también `next build`** (en la nube no se podía
  probar por el bloqueo de red a `fonts.googleapis.com`; en local
  compila sin problema, confirmando que no era un bug real de la app).
- Creado `to_attend.md`: registro de deuda técnica/riesgos detectados
  durante el desarrollo (clasificados Urgente/Necesario/Posponible/
  Mejora, con el disparador — fase, evento o plazo — que marca cuándo
  atajarlos), enlazado desde `README.md`. Sembrado con dos entradas de
  esta sesión: la versión de Python de sistema vs. pineada, y 5
  vulnerabilidades "high" de `npm audit` (cadena
  `braces`→`eslint-config-next`, solo dev-dependency de lint, downgrade
  semver-major como único fix — se pospone).
- **Rondas de automejora de la pantalla "Hoy"** (formato "propón
  mejoras → el usuario elige → se implementan → se resume"; desde la
  cuarta ronda el usuario autorizó seguir autoproponiendo sin aprobar
  ronda a ronda, excluyendo estadísticas/tendencias). Resultado: la
  cabecera se partió en `navbar.tsx` (solo identidad + navegación +
  versión) y `day-nav.tsx` (fecha, racha, botones de la pantalla);
  `sleep-card.tsx` + `reflection-card.tsx` se fusionaron en
  `today-card.tsx` (un único registro "de hoy"); `date-picker-popover.tsx`
  sustituye el `<input type="date">` nativo; "modo interactivo" de
  atajos de teclado (←/→/N/H/G, persistido en `localStorage`) con su
  `shortcuts-help-popover.tsx`; editar tareas existentes además de
  borrarlas (con confirmación en dos pasos); topes de duración en el
  backend (una tarea ≤ 24h, el total del día ≤ 24h) y validación de
  color hex en categorías. El detalle del "por qué" de cada decisión
  está en `CLAUDE.md`.
- **Importación masiva del dashboard diario desde Markdown** (petición
  directa del usuario, para meter registros retroactivos de golpe en
  vez de día a día por la UI — encaja con Fase 2): parser en
  `src/lib/day-import-md.ts`, diálogo en
  `src/components/dashboard/day-import-dialog.tsx`, botón en
  `day-nav.tsx`. Permisivo línea a línea como el bulk de Rutinas, pero
  **no destructivo por omisión**: una sección que un día no menciona no
  se toca. Sin endpoints nuevos en el backend — toda la orquestación
  vive en el cliente.

**Para la próxima sesión:**
- Backend y frontend siguen arrancables igual que siempre (ver
  `README.md` → "Arrancar en local"), con la salvedad de usar
  `python3.10` explícitamente al crear el venv mientras no se resuelva
  la entrada de `to_attend.md` sobre la versión de Python.
- Empezar a meter datos reales de uso diario en `data/habitos.db` (aún
  no se ha hecho — de momento solo hay datos de prueba de la
  verificación). En cuanto haya un uso diario real sostenido, marcar
  Fase 2 como completa en `ROADMAP.md`.
- Revisar `to_attend.md` al empezar cualquier sesión futura, no solo
  `ROADMAP.md`/`SESSIONS.md`.

---

## Sesión — 2026-10-13 — Nube

**Hecho:**
- Corregido un malentendido de la sesión anterior: el entorno local
  real para continuar el desarrollo es **Arch Linux bajo una capa
  Omarchy**, no Windows/Git Bash (esa referencia fue incidental).
- Reestructuradas las instrucciones y el contexto en dos documentos
  nuevos, pensados para desarrollo compartido entre nube y local: este
  archivo (`SESSIONS.md`) y `ROADMAP.md`. `CLAUDE.md` queda solo con
  decisiones de arquitectura (el "por qué"); el "cómo arrancar" vive en
  `README.md`; el "qué falta" vive en `ROADMAP.md`; el "qué se hizo
  sesión a sesión" vive aquí.
- Confirmado que `CLAUDE.md` y `README.md` ya estaban versionados en
  git desde el primer commit (`ad5c191`).

**Para la próxima sesión:**
- Si es la primera vez en el Arch Linux local: `git pull`, instalar
  dependencias y arrancar los dos procesos — ver `README.md` →
  "Arrancar en local" (en Arch, `source .venv/bin/activate` es el
  comando correcto; no hace falta nada específico de Omarchy más allá
  de tener Python 3 y Node instalados). Entrar a
  `http://localhost:3000`, no `:8000`.
- **A partir de ahí ya vale la pena meter datos reales** en
  `data/habitos.db` — deja de ser un entorno efímero.
- Añadir una entrada nueva arriba de esta al terminar, con el mismo
  formato.

---

## Sesión — anterior — Nube (resumida retroactivamente)

**Hecho:** dashboard diario real (tareas con horas+minutos, sueño,
frase), quitar notas/selector de ánimo de la UI y agrandar día/títulos,
arreglo del bug de navegación de fechas (`toISOString()` →
`frontend/src/lib/date.ts`), Rutinas (calendarios de hábitos tipo
checklist/simple), importación masiva de rutinas pegando texto por
mes, `--reload-dir app` para que uvicorn no vigile
`frontend/node_modules`. Ver `git log --oneline` para el detalle commit
a commit.

**Para la próxima sesión:** se escribió asumiendo que el siguiente
entorno local sería Windows + Git Bash — corregido en la entrada de
arriba (es Arch Linux + Omarchy).
