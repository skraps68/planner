"""phase_labor_nonlabor_budget

Split ProjectPhase.capital_budget/expense_budget into four labor/non-labor
columns. Backfill preserves every phase's capital/expense/total exactly by
loading existing values into the LABOR columns (non-labor = 0).
"""
from alembic import op
import sqlalchemy as sa

revision = '527d058114e2'
down_revision = '2654044250d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # 1. add nullable-first for backfill
    for col in ('labor_capital_budget', 'labor_expense_budget',
                'nonlabor_capital_budget', 'nonlabor_expense_budget'):
        op.add_column('project_phases', sa.Column(col, sa.Numeric(15, 2), nullable=True))
    # 2. backfill: old capital/expense -> labor; non-labor -> 0
    conn.execute(sa.text("""
        UPDATE project_phases SET
            labor_capital_budget = capital_budget,
            labor_expense_budget = expense_budget,
            nonlabor_capital_budget = 0,
            nonlabor_expense_budget = 0
    """))
    # 3. lock down not-null
    for col in ('labor_capital_budget', 'labor_expense_budget',
                'nonlabor_capital_budget', 'nonlabor_expense_budget'):
        op.alter_column('project_phases', col, nullable=False)
    # 4. drop old constraints + columns
    op.drop_constraint('check_budget_sum', 'project_phases', type_='check')
    op.drop_constraint('check_capital_budget_positive', 'project_phases', type_='check')
    op.drop_constraint('check_expense_budget_positive', 'project_phases', type_='check')
    op.drop_column('project_phases', 'capital_budget')
    op.drop_column('project_phases', 'expense_budget')
    # 5. new constraints
    op.create_check_constraint('check_labor_capital_budget_positive', 'project_phases', 'labor_capital_budget >= 0')
    op.create_check_constraint('check_labor_expense_budget_positive', 'project_phases', 'labor_expense_budget >= 0')
    op.create_check_constraint('check_nonlabor_capital_budget_positive', 'project_phases', 'nonlabor_capital_budget >= 0')
    op.create_check_constraint('check_nonlabor_expense_budget_positive', 'project_phases', 'nonlabor_expense_budget >= 0')
    op.create_check_constraint(
        'check_budget_sum', 'project_phases',
        'labor_capital_budget + labor_expense_budget + '
        'nonlabor_capital_budget + nonlabor_expense_budget = total_budget')
    count = conn.execute(sa.text("SELECT COUNT(*) FROM project_phases")).scalar()
    print(f"phase budget split migration complete. {count} phases migrated.")


def downgrade() -> None:
    conn = op.get_bind()
    op.add_column('project_phases', sa.Column('capital_budget', sa.Numeric(15, 2), nullable=True))
    op.add_column('project_phases', sa.Column('expense_budget', sa.Numeric(15, 2), nullable=True))
    conn.execute(sa.text("""
        UPDATE project_phases SET
            capital_budget = labor_capital_budget + nonlabor_capital_budget,
            expense_budget = labor_expense_budget + nonlabor_expense_budget
    """))
    op.alter_column('project_phases', 'capital_budget', nullable=False)
    op.alter_column('project_phases', 'expense_budget', nullable=False)
    op.drop_constraint('check_budget_sum', 'project_phases', type_='check')
    for name in ('check_labor_capital_budget_positive', 'check_labor_expense_budget_positive',
                 'check_nonlabor_capital_budget_positive', 'check_nonlabor_expense_budget_positive'):
        op.drop_constraint(name, 'project_phases', type_='check')
    for col in ('labor_capital_budget', 'labor_expense_budget',
                'nonlabor_capital_budget', 'nonlabor_expense_budget'):
        op.drop_column('project_phases', col)
    op.create_check_constraint('check_capital_budget_positive', 'project_phases', 'capital_budget >= 0')
    op.create_check_constraint('check_expense_budget_positive', 'project_phases', 'expense_budget >= 0')
    op.create_check_constraint('check_budget_sum', 'project_phases', 'capital_budget + expense_budget = total_budget')
