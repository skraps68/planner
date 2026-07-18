"""worker_type_resource_role_refactor

Repurpose worker_types to employment classes, move the old job-role worker_types
into a new resource_roles table, add resources.resource_role_id, reassign workers
(~80% Employee) and labor resources (random role), replace rates with one per
employment class. RNG seeded for reproducibility.
"""
import random, uuid
from datetime import date
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

revision = '27f01e1d45e6'
down_revision = '0ae938974843'
branch_labels = None
depends_on = None

EMP_TYPES = [("Employee", "1000.00"), ("Full-Time Contractor", "1300.00"), ("Fixed Price Contractor", "1500.00")]


def upgrade() -> None:
    conn = op.get_bind()
    rng = random.Random(20260718)

    # 1. resource_roles table
    op.create_table(
        "resource_roles",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_unique_constraint("uq_resource_roles_name", "resource_roles", ["name"])
    op.create_index("ix_resource_roles_name", "resource_roles", ["name"])

    # 2. copy old job-role worker_types -> resource_roles, + Default
    old_types = conn.execute(sa.text("SELECT id, type, description FROM worker_types")).fetchall()
    role_ids = []
    for _oid, t, d in old_types:
        rid = str(uuid.uuid4())
        conn.execute(sa.text(
            "INSERT INTO resource_roles (id, name, description, created_at, updated_at, version) "
            "VALUES (:id, :n, :d, now(), now(), 1)"), {"id": rid, "n": t, "d": d})
        role_ids.append(rid)
    default_id = str(uuid.uuid4())
    conn.execute(sa.text(
        "INSERT INTO resource_roles (id, name, description, created_at, updated_at, version) "
        "VALUES (:id, 'Default', 'Default resource role', now(), now(), 1)"), {"id": default_id})
    role_ids.append(default_id)

    # 3. insert new employment-class worker_types
    emp_ids = {}
    for name, _rate in EMP_TYPES:
        wid = str(uuid.uuid4())
        conn.execute(sa.text(
            "INSERT INTO worker_types (id, type, description, created_at, updated_at, version) "
            "VALUES (:id, :t, :d, now(), now(), 1)"), {"id": wid, "t": name, "d": name})
        emp_ids[name] = wid

    # 4. reassign workers ~80% Employee
    worker_rows = conn.execute(sa.text("SELECT id FROM workers")).fetchall()
    contractor = [emp_ids["Full-Time Contractor"], emp_ids["Fixed Price Contractor"]]
    for (wkid,) in worker_rows:
        newt = emp_ids["Employee"] if rng.random() < 0.8 else rng.choice(contractor)
        conn.execute(sa.text("UPDATE workers SET worker_type_id = :t WHERE id = :id"),
                     {"t": newt, "id": str(wkid)})

    # 5. drop old rates, then old worker_types (now unreferenced)
    old_type_ids = [str(r[0]) for r in old_types]
    if old_type_ids:
        rates_before = conn.execute(sa.text(
            "SELECT COUNT(*) FROM rates WHERE worker_type_id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True)), {"ids": old_type_ids}).scalar()
        conn.execute(sa.text(
            "DELETE FROM rates WHERE worker_type_id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True)), {"ids": old_type_ids})
        rates_after = conn.execute(sa.text(
            "SELECT COUNT(*) FROM rates WHERE worker_type_id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True)), {"ids": old_type_ids}).scalar()
        print(f"old-type rates deleted: {rates_before} -> {rates_after}")
        if rates_after:
            raise Exception(f"{rates_after} rates still reference old worker_types after delete")

        conn.execute(sa.text(
            "DELETE FROM worker_types WHERE id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True)), {"ids": old_type_ids})

    # 6. one current rate per employment class
    for name, rate in EMP_TYPES:
        conn.execute(sa.text(
            "INSERT INTO rates (id, worker_type_id, rate_amount, start_date, end_date, created_at, updated_at, version) "
            "VALUES (:id, :wt, :amt, :sd, NULL, now(), now(), 1)"),
            {"id": str(uuid.uuid4()), "wt": emp_ids[name], "amt": rate, "sd": date.today().isoformat()})

    # 7. resources.resource_role_id + backfill + CHECK
    op.add_column("resources", sa.Column("resource_role_id", GUID(), nullable=True))
    op.create_index("ix_resources_resource_role_id", "resources", ["resource_role_id"])
    op.create_foreign_key("fk_resources_resource_role_id", "resources", "resource_roles",
                          ["resource_role_id"], ["id"])
    labor = conn.execute(sa.text("SELECT id FROM resources WHERE resource_type = 'LABOR'")).fetchall()
    for (rid,) in labor:
        conn.execute(sa.text("UPDATE resources SET resource_role_id = :role WHERE id = :id"),
                     {"role": rng.choice(role_ids), "id": str(rid)})
    op.create_check_constraint(
        "ck_resources_labor_role", "resources",
        "(resource_type = 'LABOR' AND resource_role_id IS NOT NULL) OR "
        "(resource_type = 'NON_LABOR' AND resource_role_id IS NULL)")
    bad = conn.execute(sa.text(
        "SELECT COUNT(*) FROM resources WHERE resource_type='LABOR' AND resource_role_id IS NULL")).scalar()
    if bad:
        raise Exception(f"{bad} labor resources left without a role")
    print("worker_type/resource_role refactor complete.")


def downgrade() -> None:
    # Structural rollback only (does not restore pre-refactor row values).
    op.drop_constraint("ck_resources_labor_role", "resources", type_="check")
    op.drop_constraint("fk_resources_resource_role_id", "resources", type_="foreignkey")
    op.drop_index("ix_resources_resource_role_id", table_name="resources")
    op.drop_column("resources", "resource_role_id")
    op.drop_index("ix_resource_roles_name", table_name="resource_roles")
    op.drop_table("resource_roles")
