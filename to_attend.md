# Por atender

Cosas que surgen *durante* el desarrollo (deuda técnica, riesgos,
decisiones aplazadas, mejoras detectadas de pasada) que no son ni "qué
falta construir" (eso es `ROADMAP.md`) ni "qué se hizo en una sesión"
(eso es `SESSIONS.md`). Aquí vive el "esto lo vimos, no lo tocamos
ahora, pero que no se nos olvide" — con la clasificación de urgencia y,
sobre todo, **cuándo** corresponde atajarlo.

Entradas nuevas van **arriba** de su categoría. Al resolver una
entrada, no se borra sin más: se mueve a "Resuelto" abajo con una línea
de qué se hizo (así queda trazabilidad de por qué se aplazó algo y qué
pasó después). Si una entrada deja de aplicar (se volvió irrelevante),
se mueve ahí también, indicándolo.

## Clasificación

- **Urgente** — bloquea o puede romper algo ahora mismo (dato real en
  riesgo, el entorno no arranca, un bug activo). Se atiende antes de
  seguir con cualquier otra cosa.
- **Necesario** — hay que resolverlo sí o sí, pero no bloquea el
  trabajo de hoy. Tiene un disparador concreto (ver más abajo) que
  marca cuándo deja de ser aplazable.
- **Posponible** — deuda o riesgo real pero menor (impacto bajo,
  probabilidad baja, o ambas). Se revisita cuando toque, no antes.
- **Mejora** — no es deuda ni riesgo, es una oportunidad detectada de
  pasada (simplificar algo, una herramienta mejor, una idea de
  producto). Cero presión temporal salvo la que se le asigne.

(Si en algún momento una entrada "Posponible" o "Mejora" empieza a
doler de verdad, se reclasifica a "Necesario" o "Urgente" en vez de
crear una entrada duplicada.)

## Cuándo atajarlo (disparador)

Cada entrada debe decir **qué la activa**, en una de estas formas (la
que mejor encaje, no hay que forzar las tres):

- **Fase** — una de las fases de `ROADMAP.md` (p. ej. "antes de cerrar
  Fase 2", "al llegar a Fase 3 — servidor propio").
- **Evento** — algo que ocurre o deja de ocurrir (p. ej. "cuando Arch
  deje de empaquetar python3.10", "la próxima vez que se actualice
  Next.js/ESLint deliberadamente", "si se añade un segundo
  desarrollador").
- **Tiempo** — una fecha, un plazo relativo, o una cadencia de revisión
  (p. ej. "revisar en 3 meses", "antes de 2026-12-01").

---

## Urgente

_(vacío por ahora)_

## Necesario

### Python de sistema en Arch no es apto para el proyecto sin fijar versión
- **Qué pasa:** `requirements.txt` fija `pydantic==2.9.2`, cuyo
  `pydantic-core` (compilado en Rust vía PyO3 0.22) no tiene wheel para
  Python 3.14 — el único Python "moderno" que trae Arch por defecto
  ahora mismo (rolling release). El venv solo funcionó usando
  `python3.10`, que Arch también empaqueta hoy pero puede dejar de
  hacerlo en cualquier actualización.
- **Por qué no es "Urgente":** ya funciona (`.venv` creado con
  `python3.10`), no bloquea el trabajo de hoy.
- **Opciones evaluadas** (sin implementar): fijar la versión de Python
  del proyecto con `pyenv`/`uv python install` + `.python-version`
  (recomendada — desacopla del Python de sistema de Arch de forma
  permanente); seguir con `python3.10` del sistema (frágil a medio
  plazo); actualizar las versiones pineadas en `requirements.txt` a
  algo con wheels para 3.14 (acopla el proyecto al Python del momento,
  se repetirá); Docker (sobre-ingeniería para esta fase).
- **Disparador:** Evento — "cuando Arch deje de empaquetar
  `python3.10`" (o antes, si se detecta que `python3.10` ya no aparece
  en un `pacman -Syu` normal). A más tardar, Fase — "antes de llegar a
  Fase 3 (servidor propio)", porque ahí sí hace falta una versión de
  Python fijada y reproducible para el despliegue.
- **Detectado:** 2026-10-13, al levantar el entorno en local (Fase 2).

## Posponible

### Vulnerabilidades "high" en `npm audit` (cadena braces→micromatch→fast-glob→eslint-config-next)
- **Qué pasa:** 5 avisos "high" de `npm audit`, todos de una sola
  cadena de dependencias dentro de `eslint-config-next`
  (`devDependencies`): DoS por agotamiento de pila en `braces`
  (CWE-674) si se le pasa un patrón glob diseñado para ello.
- **Por qué es bajo riesgo real:** solo se usa en tiempo de desarrollo
  (linting), nunca llega al bundle que corre en navegador/servidor; no
  hay input externo ni de terceros que controle los patrones glob que
  procesa el linter en este proyecto (app personal, un desarrollador).
- **Por qué no se arregla ya:** el único `fixAvailable` es bajar
  `eslint-config-next` a `14.2.35` — downgrade semver-major respecto a
  Next.js 16, probable rotura de la config de lint. No merece la pena
  un downgrade mayor para mitigar un riesgo que hoy es prácticamente
  nulo.
- **Disparador:** Evento — "la próxima vez que se actualice
  Next.js/ESLint de forma deliberada" (ahí se revisa si la nueva
  versión de `eslint-config-next` ya resuelve la cadena, en vez de
  forzar un downgrade aislado). Revisar también — Tiempo: en una
  revisión periódica de dependencias (sugerido cada 3-6 meses).
- **Detectado:** 2026-10-13, al hacer `npm install` en Fase 2 (local).

## Mejora

### `Routine.color` no valida formato hex (a diferencia de `Category.color`)
- **Qué pasa:** en la sesión de automejora de "Hoy" (2026-10-13) se
  añadió validación de color hex (`#RRGGBB`) a `CategoryCreate`/
  `CategoryUpdate` en `app/schemas.py`. `RoutineCreate`/`RoutineUpdate`
  tienen el mismo campo `color` con el mismo riesgo (un valor inválido
  se propaga silenciosamente a la UI de Rutinas) pero no se tocaron,
  porque esa ronda era específicamente sobre la pantalla "Hoy".
- **Disparador:** Evento — la próxima vez que se trabaje sobre Rutinas
  (backend o frontend), aplicar el mismo `_validate_hex_color` /
  `HEX_COLOR_RE` ya definido en `app/schemas.py` a esos dos esquemas.
- **Detectado:** 2026-10-13, sesión de automejora de "Hoy", ronda 2.

---

## Resuelto / ya no aplica

_(vacío por ahora)_
