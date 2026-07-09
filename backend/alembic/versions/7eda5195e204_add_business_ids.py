"""add business ids

Revision ID: 7eda5195e204
Revises: 35744cbabc7e
Create Date: 2026-07-09 15:46:52.568443

"""
import sqlalchemy as sa
from alembic import op

revision = "7eda5195e204"
down_revision = "35744cbabc7e"
branch_labels = None
depends_on = None

BASES = {"portfolio": 10000000, "program": 20000000, "project": 30000000}
TABLES = {"portfolio": "portfolios", "program": "programs", "project": "projects"}


def upgrade() -> None:
    # 1. Config table + seed
    op.create_table(
        "business_id_config",
        sa.Column("entity_type", sa.String(20), primary_key=True),
        sa.Column("base_id", sa.Integer(), nullable=False),
        sa.Column("next_sequence", sa.Integer(), nullable=False, server_default="1"),
    )

    # 2. Nullable columns
    for table in TABLES.values():
        op.add_column(table, sa.Column("business_id", sa.String(9), nullable=True))

    # 3. Backfill in created_at order, per type, consuming the sequence
    conn = op.get_bind()
    for entity_type, table in TABLES.items():
        base = BASES[entity_type]
        rows = conn.execute(
            sa.text(f"SELECT id FROM {table} ORDER BY created_at, id")
        ).fetchall()
        seq = 1
        for (row_id,) in rows:
            conn.execute(
                sa.text(f"UPDATE {table} SET business_id = :bid WHERE id = :rid"),
                {"bid": str(base + seq).zfill(9), "rid": str(row_id)},
            )
            seq += 1
        conn.execute(
            sa.text(
                "INSERT INTO business_id_config (entity_type, base_id, next_sequence) "
                "VALUES (:t, :b, :s)"
            ),
            {"t": entity_type, "b": base, "s": seq},
        )

    # 4. Tighten: NOT NULL + unique index
    for table in TABLES.values():
        op.alter_column(table, "business_id", nullable=False)
        op.create_index(
            f"ix_{table}_business_id", table, ["business_id"], unique=True
        )


def downgrade() -> None:
    for table in TABLES.values():
        op.drop_index(f"ix_{table}_business_id", table_name=table)
        op.drop_column(table, "business_id")
    op.drop_table("business_id_config")
