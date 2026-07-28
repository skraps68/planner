from datetime import date
from decimal import Decimal

import pytest

from app.models.nonlabor_plan import (
    NonLaborFrequency,
    NonLaborPeriodPlacement,
)
from app.services.nonlabor_schedule import (
    GeneratedOccurrence,
    generate_straight_line_occurrences,
    normalize_manual_occurrences,
)


def test_monthly_period_end_clips_partial_periods_and_preserves_total():
    occurrences = generate_straight_line_occurrences(
        Decimal("100.00"),
        date(2026, 1, 15),
        date(2026, 3, 10),
        NonLaborFrequency.MONTHLY,
        NonLaborPeriodPlacement.PERIOD_END,
    )

    assert [item.occurrence_date for item in occurrences] == [
        date(2026, 1, 31),
        date(2026, 2, 28),
        date(2026, 3, 10),
    ]
    assert [item.amount for item in occurrences] == [
        Decimal("33.3333"),
        Decimal("33.3333"),
        Decimal("33.3334"),
    ]
    assert sum(item.amount for item in occurrences) == Decimal("100.0000")


def test_monthly_period_start_clips_first_partial_period():
    occurrences = generate_straight_line_occurrences(
        Decimal("20"),
        date(2026, 1, 15),
        date(2026, 2, 10),
        NonLaborFrequency.MONTHLY,
        NonLaborPeriodPlacement.PERIOD_START,
    )
    assert [item.occurrence_date for item in occurrences] == [
        date(2026, 1, 15),
        date(2026, 2, 1),
    ]


def test_daily_includes_every_calendar_day_including_leap_day():
    occurrences = generate_straight_line_occurrences(
        Decimal("3"),
        date(2028, 2, 28),
        date(2028, 3, 1),
        NonLaborFrequency.DAILY,
        NonLaborPeriodPlacement.PERIOD_START,
    )
    assert [item.occurrence_date for item in occurrences] == [
        date(2028, 2, 28),
        date(2028, 2, 29),
        date(2028, 3, 1),
    ]


def test_yearly_period_end_uses_clipped_schedule_end():
    occurrences = generate_straight_line_occurrences(
        Decimal("200"),
        date(2026, 7, 1),
        date(2027, 6, 30),
        NonLaborFrequency.YEARLY,
        NonLaborPeriodPlacement.PERIOD_END,
    )
    assert [item.occurrence_date for item in occurrences] == [
        date(2026, 12, 31),
        date(2027, 6, 30),
    ]


def test_manual_entries_are_sorted_and_quantized():
    occurrences = normalize_manual_occurrences(
        [
            GeneratedOccurrence(date(2026, 2, 1), Decimal("2.12345")),
            GeneratedOccurrence(date(2026, 1, 1), Decimal("1")),
        ]
    )
    assert occurrences == [
        GeneratedOccurrence(date(2026, 1, 1), Decimal("1.0000")),
        GeneratedOccurrence(date(2026, 2, 1), Decimal("2.1234")),
    ]


def test_manual_entries_reject_duplicate_dates():
    with pytest.raises(ValueError, match="Only one cash flow"):
        normalize_manual_occurrences(
            [
                GeneratedOccurrence(date(2026, 1, 1), Decimal("1")),
                GeneratedOccurrence(date(2026, 1, 1), Decimal("2")),
            ]
        )


def test_negative_amounts_are_rejected():
    with pytest.raises(ValueError, match="cannot be negative"):
        generate_straight_line_occurrences(
            Decimal("-1"),
            date(2026, 1, 1),
            date(2026, 1, 31),
            NonLaborFrequency.MONTHLY,
            NonLaborPeriodPlacement.PERIOD_END,
        )
