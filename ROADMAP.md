# Hoja de ruta — Bitácora

Qué está hecho, qué queda y en qué fase está el proyecto. El "por qué"
de las decisiones ya tomadas vive en `CLAUDE.md`; el día a día de cada
sesión de trabajo vive en `SESSIONS.md`. Este archivo es el único
sitio donde se mantiene la lista de pendientes — no la dupliques en
`README.md` ni en `CLAUDE.md`, enlázala desde ahí.

## Fases

- [x] **Fase 1 — Prototipo en la nube.** Backend FastAPI + SQLite,
  frontend Next.js desacoplado, dashboard diario (tareas, sueño,
  frase), Rutinas (calendarios de hábitos) e importación masiva por
  texto. Construido íntegramente en un entorno de desarrollo en la
  nube, efímero — sin datos reales.
- [ ] **Fase 2 — Desarrollo local (Arch Linux + Omarchy).** `git pull`,
  levantar backend y frontend en local, empezar a meter datos reales
  en `data/habitos.db`, y seguir iterando sobre el prototipo con el
  entorno persistente. Entorno local levantado y verificado
  (2026-10-13): backend + frontend funcionando, `tsc`/`eslint`/`next
  build` en limpio. Pendiente de marcar completa: meter datos reales de
  uso diario (de momento solo hay datos de verificación). Nota de
  entorno en `to_attend.md` (Python de sistema de Arch vs. versión
  pineada en `requirements.txt`).
- [ ] **Fase 3 — Servidor propio (Oracle Cloud).** Migrar la base de
  datos a Postgres (solo cambiar `DATABASE_URL`, ver `CLAUDE.md`) y
  desplegar backend (systemd/Docker + reverse proxy) y frontend
  (`next build`) en un servidor accesible fuera de local.

## Pendiente (deliberadamente pospuesto, no olvidado)

- Gráficos de tendencia (sueño semanal, minutos por categoría, ánimo a
  lo largo del tiempo) — con Recharts, ya en uso en el proyecto.
  Incluye la idea surgida en la sesión de automejora de "Hoy"
  (2026-10-13, ronda 4): comparar el total de hoy contra la media de
  los últimos 7 días (flecha ↑/↓ junto al badge de minutos de Tareas)
  — se descartó implementarla sola porque es el primer paso de esta
  misma funcionalidad pendiente, no haría sentido como pieza aislada.
- Objetivos a medio/largo plazo vinculados a tareas diarias.
- Exportar un resumen de periodo a PDF para consulta con el psicólogo.
- Recordatorio/check-in si no se ha registrado nada a cierta hora.
- Renombrar/recolorear una rutina ya creada (ahora hay que borrarla y
  recrearla).
- Selector de tema claro/oscuro real (`next-themes`); ahora mismo fijo
  en oscuro.
- Migrar la base de datos a Postgres y desplegar en servidor propio
  (Fase 3, arriba).

## Hecho

- Backend API pura (FastAPI) + frontend Next.js desacoplado.
- Dashboard diario: tareas por categoría + tiempo (horas y minutos),
  sueño (horas y fases), frase motivacional. (Ánimo y notas libres
  siguen en el modelo/API pero se quitaron de esta UI a propósito, ver
  `CLAUDE.md`.)
- Categorías editables desde la propia UI.
- Racha de días consecutivos con registro.
- Rutinas: calendarios tipo "checklist" (varias iniciales por día,
  tachables por separado) o "simple" (racha, se tacha el día entero de
  una vez).
- Importación masiva de rutinas pegando texto plano, mes a mes.
- Arreglo del bug de zona horaria en la navegación de fechas
  (`toISOString()` → aritmética local centralizada en
  `frontend/src/lib/date.ts`).
