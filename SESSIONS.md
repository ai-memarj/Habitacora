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
