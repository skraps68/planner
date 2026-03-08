"""
fix_overallocations.py

Finds all resource-date combinations where total allocation across all projects
exceeds 100%, and randomly reduces assignments to bring the total to a random
target between 70% and 95%.

Reduction strategy:
  - Pick a random target between 70% and 95%
  - Sort assignments largest-first
  - Reduce the largest assignment first; if excess exceeds it, zero it out
    and move to the next until the target is reached
  - Capital/expense ratio is preserved within each reduced assignment
"""

import random
import psycopg2
from decimal import Decimal, ROUND_HALF_UP

DB_CONFIG = {
    "host": "db",
    "port": 5432,
    "dbname": "planner",
    "user": "postgres",
    "password": "postgres",
}


def fix_overallocations(dry_run=False):
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Find all over-allocated resource-date pairs
    cur.execute("""
        SELECT r.id, r.name, a.assignment_date,
               SUM(a.capital_percentage + a.expense_percentage) AS total
        FROM resource_assignments a
        JOIN resources r ON a.resource_id = r.id
        GROUP BY r.id, r.name, a.assignment_date
        HAVING SUM(a.capital_percentage + a.expense_percentage) > 100
        ORDER BY r.name, a.assignment_date
    """)
    overallocated = cur.fetchall()

    print(f"Found {len(overallocated)} over-allocated resource-day combinations.")
    if dry_run:
        print("DRY RUN — no changes will be written.\n")

    updates = []  # list of (id, new_cap, new_exp)

    for resource_id, resource_name, assignment_date, total in overallocated:
        target = Decimal(random.randint(70, 95))
        remaining_excess = Decimal(str(total)) - target

        # Get all assignments for this resource on this date, largest first
        cur.execute("""
            SELECT a.id, p.name, a.capital_percentage, a.expense_percentage,
                   (a.capital_percentage + a.expense_percentage) AS asn_total
            FROM resource_assignments a
            JOIN projects p ON a.project_id = p.id
            WHERE a.resource_id = %s AND a.assignment_date = %s
            ORDER BY (a.capital_percentage + a.expense_percentage) DESC
        """, (resource_id, assignment_date))
        assignments = cur.fetchall()

        day_updates = []
        for asn_id, project_name, cap, exp, asn_total in assignments:
            if remaining_excess <= 0:
                break

            cap = Decimal(str(cap))
            exp = Decimal(str(exp))
            asn_total = Decimal(str(asn_total))

            reduction = min(remaining_excess, asn_total)
            new_asn_total = asn_total - reduction

            if asn_total > 0:
                ratio = new_asn_total / asn_total
                new_cap = (cap * ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                new_exp = (exp * ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            else:
                new_cap = Decimal("0")
                new_exp = Decimal("0")

            remaining_excess -= reduction
            day_updates.append((asn_id, project_name, cap, exp, new_cap, new_exp, asn_total, new_asn_total))

        final_total = target + max(remaining_excess, Decimal("0"))
        print(
            f"  {resource_name} | {assignment_date} | {total:.1f}% → {final_total:.1f}% (target {target}%)"
        )
        for asn_id, project_name, cap, exp, new_cap, new_exp, asn_total, new_asn_total in day_updates:
            print(
                f"    [{project_name}] {asn_total:.1f}% → {new_asn_total:.1f}%"
                f"  (cap {cap:.1f}→{new_cap:.1f}, exp {exp:.1f}→{new_exp:.1f})"
            )
            updates.append((asn_id, float(new_cap), float(new_exp)))

    if not dry_run:
        for asn_id, new_cap, new_exp in updates:
            cur.execute("""
                UPDATE resource_assignments
                SET capital_percentage = %s,
                    expense_percentage = %s,
                    version = version + 1
                WHERE id = %s
            """, (new_cap, new_exp, asn_id))
        conn.commit()
        print(f"\nDone. Updated {len(updates)} assignment rows across {len(overallocated)} resource-days.")
    else:
        print(f"\nDry run complete. Would update {len(updates)} assignment rows.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    import sys
    dry_run = "--dry-run" in sys.argv
    fix_overallocations(dry_run=dry_run)
