# Bitácora — seguimiento de hábitos, objetivos y salud mental

Registro diario personal: tareas por categoría y tiempo dedicado, sueño
(horas y fases), frase motivacional y estado de ánimo, y notas libres.
Pensado como enlace diario con uno mismo y como libro de consulta para
terapia.

## Stack

- **Backend:** FastAPI + SQLAlchemy
- **Base de datos:** SQLite para desarrollo (fichero en `data/habitos.db`).
  Migrar a Postgres/MySQL en el futuro solo requiere cambiar la variable
  de entorno `DATABASE_URL`; el resto del código no cambia.
- **Frontend:** HTML + CSS + JS vanilla, servido directamente por FastAPI
  (sin build step, sin frameworks de JS). Las plantillas usan Jinja2.

## Estructura del proyecto

```
app/
  main.py          # punto de entrada, monta routers y sirve la página
  database.py       # configuración de SQLAlchemy / sesión
  models.py         # modelos: Category, Task, SleepLog, DailyEntry
  schemas.py         # esquemas Pydantic (entrada/salida de la API)
  seed.py            # siembra las categorías por defecto
  routers/
    categories.py    # CRUD de categorías
    tasks.py          # CRUD de tareas diarias
    sleep.py           # registro de sueño (upsert por día)
    daily.py            # frase/ánimo/notas + resumen agregado del día
  templates/
    index.html         # página principal (SPA simple de una vista)
  static/
    css/style.css
    js/app.js            # toda la lógica de frontend (fetch a la API)
data/
  habitos.db              # base de datos SQLite (se crea sola, no versionada)
```

## Arrancar en local

```bash
# 1. Crear entorno virtual (recomendado)
python3 -m venv .venv
source .venv/bin/activate     # en Windows: .venv\Scripts\activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Arrancar el servidor
uvicorn app.main:app --reload --port 8000
```

Abre `http://localhost:8000` en el navegador. La base de datos y las
categorías por defecto (Casa, Rutina, Coche, Guitarra, Deporte, Trabajo)
se crean automáticamente la primera vez que arranca.

## Modelo de datos (resumen)

- **Category**: nombre + color. Editable y creable desde la propia web.
- **Task**: fecha, nombre, minutos dedicados, categoría. Registrar el
  tiempo dedicado ya implica que la tarea se hizo (no hay checkbox de
  "completado" separado).
- **SleepLog**: un registro por noche — hora de dormir, hora de
  despertar, y porcentaje de sueño ligero/profundo/REM.
- **DailyEntry**: un registro por día — frase motivacional, estado de
  ánimo (escala 1-5) y notas libres.

## API

Documentación interactiva autogenerada disponible en `/docs` (Swagger UI)
en cuanto el servidor está arrancado.

Endpoints principales:
- `GET/POST /api/categories`, `PUT/DELETE /api/categories/{id}`
- `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/{id}` (filtrable por `?for_date=`)
- `GET /api/sleep/{fecha}`, `PUT /api/sleep` (upsert por fecha)
- `GET /api/daily/{fecha}`, `PUT /api/daily` (upsert por fecha)
- `GET /api/summary/{fecha}` — vista agregada del día (tareas + sueño + entrada)

## Roadmap (siguientes iteraciones)

- Gráficos de tendencia (sueño, minutos por categoría, ánimo) — idealmente
  antes de añadirlos, revisar si el entorno ofrece un tipo de artefacto
  Dashboard nativo.
- Objetivos a medio/largo plazo vinculados a tareas diarias.
- Exportar resumen de un periodo a PDF para consulta con el psicólogo.
- Migrar la base de datos a Postgres y desplegar en servidor propio (Oracle Cloud).

## Despliegue futuro

Pensado para, cuando el prototipo esté maduro, clonar este repo en un
entorno local (o directamente en Claude Code) y continuar el desarrollo
ahí, para finalmente desplegar en un servidor propio. Ver `CLAUDE.md`
para las decisiones de arquitectura que conviene conocer antes de seguir.
