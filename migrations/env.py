"""
Configuración de Alembic.

La URL de la base de datos NO se lee de alembic.ini: se toma de
`app.database.DATABASE_URL`, que es la misma fuente que usa la app (y
que respeta la variable de entorno DATABASE_URL). Así, el día que se
migre a Postgres en Fase 3, no hay que acordarse de cambiar la cadena
de conexión en dos sitios.
"""
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Importar los modelos es lo que puebla `Base.metadata`, necesario para
# que `alembic revision --autogenerate` detecte cambios.
from app.database import Base, DATABASE_URL
from app import models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # SQLite no soporta ALTER COLUMN / DROP COLUMN directamente;
            # render_as_batch hace que Alembic use el truco de tabla
            # temporal + copia. Imprescindible mientras el motor sea SQLite.
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
