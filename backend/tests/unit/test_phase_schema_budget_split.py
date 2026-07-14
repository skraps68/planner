from decimal import Decimal
import pytest
from pydantic import ValidationError
from app.schemas.phase import PhaseBatchItem


def test_batch_item_accepts_four_way_split():
    item = PhaseBatchItem(
        id=None, name="Ph", start_date="2026-01-01", end_date="2026-06-30",
        labor_capital_budget=Decimal("100"), labor_expense_budget=Decimal("50"),
        nonlabor_capital_budget=Decimal("30"), nonlabor_expense_budget=Decimal("20"),
        total_budget=Decimal("200"),
    )
    assert item.total_budget == Decimal("200")


def test_batch_item_rejects_bad_sum():
    with pytest.raises(ValidationError):
        PhaseBatchItem(
            id=None, name="Ph", start_date="2026-01-01", end_date="2026-06-30",
            labor_capital_budget=Decimal("100"), labor_expense_budget=Decimal("50"),
            nonlabor_capital_budget=Decimal("30"), nonlabor_expense_budget=Decimal("20"),
            total_budget=Decimal("999"),
        )
