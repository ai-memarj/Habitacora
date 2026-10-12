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
- **Sin frontend framework**: HTML/CSS/JS vanilla servido por FastAPI
  con Jinja2. Decisión deliberada para el prototipo — una sola página,
  sin necesidad de build step. Si el proyecto crece mucho en
  complejidad de UI, valorar migrar a algo como React/Vue, pero no
  antes de que la app de más de una vista/página real.
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

## Cómo seguir desde aquí

1. `git clone` este repo.
2. `python3 -m venv .venv && source .venv/bin/activate`
3. `pip install -r requirements.txt`
4. `uvicorn app.main:app --reload --port 8000`
5. La base de datos se crea sola en `data/habitos.db` (no versionada,
   ver `.gitignore`).

Para desplegar en servidor propio: cambiar `DATABASE_URL` a la BD de
producción, servir con un proceso gestionado (systemd o Docker) detrás
de un reverse proxy (nginx), y quitar `--reload`.
