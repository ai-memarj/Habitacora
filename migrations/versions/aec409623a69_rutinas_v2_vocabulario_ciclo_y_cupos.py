"""Rutinas v2: vocabulario, ciclo y cupos

Cambios:
- `routine_activities`: el vocabulario de cada rutina (sustituye al
  `label` de texto libre de los items), con `quota` para los cupos.
- `routine_cycle_slots`: el patrón, una actividad colocada en un día
  del ciclo.
- `routines`: + cycle_length, cycle_start, goal_days; - type.
- `routine_items`: + activity_id (se mantiene `label` para items
  sueltos y para los datos anteriores a esta migración).

Migración de datos: por cada rutina, los `label` distintos que ya
tuvieran sus items se convierten en actividades (una por label), y los
items se reapuntan a ellas. Nada se pierde. En la práctica, en la BD
local de hoy esto es un no-op (no hay ninguna rutina creada todavía):
el motivo real de escribirla es tener la conversión probada por si
existen datos en otra copia de la base.

Revision ID: aec409623a69
Revises: 199b38d4d4cf
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "aec409623a69"
down_revision: Union[str, None] = "199b38d4d4cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "routine_activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("routine_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("short_label", sa.String(length=8), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("quota", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["routine_id"], ["routines.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_routine_activities_id", "routine_activities", ["id"])
    op.create_index("ix_routine_activities_routine_id", "routine_activities", ["routine_id"])

    op.create_table(
        "routine_cycle_slots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("routine_id", sa.Integer(), nullable=False),
        sa.Column("activity_id", sa.Integer(), nullable=False),
        sa.Column("day_index", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["activity_id"], ["routine_activities.id"]),
        sa.ForeignKeyConstraint(["routine_id"], ["routines.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_routine_cycle_slots_id", "routine_cycle_slots", ["id"])
    op.create_index("ix_routine_cycle_slots_routine_id", "routine_cycle_slots", ["routine_id"])
    op.create_index("ix_routine_cycle_slots_activity_id", "routine_cycle_slots", ["activity_id"])

    with op.batch_alter_table("routines") as batch:
        batch.add_column(sa.Column("cycle_length", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("cycle_start", sa.Date(), nullable=True))
        batch.add_column(sa.Column("goal_days", sa.Integer(), nullable=True))

    with op.batch_alter_table("routine_items") as batch:
        batch.add_column(sa.Column("activity_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_routine_items_activity_id", "routine_activities", ["activity_id"], ["id"]
        )
    op.create_index("ix_routine_items_activity_id", "routine_items", ["activity_id"])

    _migrate_labels_to_activities()

    # `type` se va al final, cuando ya se han leído los datos que
    # dependían de él (las rutinas "simple" tenían label NULL, así que no
    # generan ninguna actividad y quedan como reto sin vocabulario).
    with op.batch_alter_table("routines") as batch:
        batch.drop_column("type")


def _migrate_labels_to_activities() -> None:
    """Agrupa los `label` existentes de cada rutina en actividades."""
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT DISTINCT routine_id, label FROM routine_items "
            "WHERE label IS NOT NULL AND TRIM(label) <> '' "
            "ORDER BY routine_id, label"
        )
    ).fetchall()

    position_por_rutina: dict[int, int] = {}
    for routine_id, label in rows:
        position = position_por_rutina.get(routine_id, 0)
        position_por_rutina[routine_id] = position + 1
        result = bind.execute(
            sa.text(
                "INSERT INTO routine_activities "
                "(routine_id, name, short_label, color, position, quota) "
                "VALUES (:rid, :name, :short, NULL, :pos, NULL)"
            ),
            {"rid": routine_id, "name": label, "short": label[:8], "pos": position},
        )
        activity_id = result.lastrowid
        bind.execute(
            sa.text(
                "UPDATE routine_items SET activity_id = :aid "
                "WHERE routine_id = :rid AND label = :label"
            ),
            {"aid": activity_id, "rid": routine_id, "label": label},
        )


def downgrade() -> None:
    with op.batch_alter_table("routines") as batch:
        batch.add_column(
            sa.Column("type", sa.String(length=20), nullable=False, server_default="checklist")
        )

    op.drop_index("ix_routine_items_activity_id", table_name="routine_items")
    with op.batch_alter_table("routine_items") as batch:
        batch.drop_constraint("fk_routine_items_activity_id", type_="foreignkey")
        batch.drop_column("activity_id")

    with op.batch_alter_table("routines") as batch:
        batch.drop_column("goal_days")
        batch.drop_column("cycle_start")
        batch.drop_column("cycle_length")

    op.drop_table("routine_cycle_slots")
    op.drop_table("routine_activities")
