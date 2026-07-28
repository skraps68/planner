"""Deterministic occurrence generation for non-labor cash forecasts."""
import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_DOWN
from typing import Iterable, List

from app.models.nonlabor_plan import (
    NonLaborFrequency,
    NonLaborPeriodPlacement,
)


AMOUNT_QUANTUM = Decimal("0.0001")


@dataclass(frozen=True)
class GeneratedOccurrence:
    occurrence_date: date
    amount: Decimal


def _month_end(value: date) -> date:
    return date(
        value.year,
        value.month,
        calendar.monthrange(value.year, value.month)[1],
    )


def _next_month(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def _period_dates(
    start_date: date,
    end_date: date,
    frequency: NonLaborFrequency,
    placement: NonLaborPeriodPlacement,
) -> List[date]:
    if start_date > end_date:
        raise ValueError("Schedule start date must be on or before end date")

    if frequency == NonLaborFrequency.DAILY:
        count = (end_date - start_date).days + 1
        return [start_date + timedelta(days=index) for index in range(count)]

    dates: List[date] = []
    if frequency == NonLaborFrequency.MONTHLY:
        cursor = date(start_date.year, start_date.month, 1)
        final = date(end_date.year, end_date.month, 1)
        while cursor <= final:
            clipped_start = max(start_date, cursor)
            clipped_end = min(end_date, _month_end(cursor))
            dates.append(
                clipped_start
                if placement == NonLaborPeriodPlacement.PERIOD_START
                else clipped_end
            )
            cursor = _next_month(cursor)
        return dates

    for year in range(start_date.year, end_date.year + 1):
        clipped_start = max(start_date, date(year, 1, 1))
        clipped_end = min(end_date, date(year, 12, 31))
        dates.append(
            clipped_start
            if placement == NonLaborPeriodPlacement.PERIOD_START
            else clipped_end
        )
    return dates


def generate_straight_line_occurrences(
    total_amount: Decimal,
    start_date: date,
    end_date: date,
    frequency: NonLaborFrequency,
    placement: NonLaborPeriodPlacement,
) -> List[GeneratedOccurrence]:
    """Spread a non-negative total equally across clipped calendar periods.

    The first and last month/year are not prorated in the MVP. The last
    occurrence absorbs the four-decimal remainder so the exact total is
    preserved.
    """
    amount = Decimal(total_amount)
    if amount < 0:
        raise ValueError("Total amount cannot be negative")

    dates = _period_dates(start_date, end_date, frequency, placement)
    if not dates:
        raise ValueError("Schedule must produce at least one occurrence")

    equal_amount = (amount / len(dates)).quantize(
        AMOUNT_QUANTUM, rounding=ROUND_DOWN
    )
    occurrences = [
        GeneratedOccurrence(
            occurrence_date=occurrence_date, amount=equal_amount
        )
        for occurrence_date in dates[:-1]
    ]
    allocated = equal_amount * (len(dates) - 1)
    occurrences.append(
        GeneratedOccurrence(
            occurrence_date=dates[-1],
            amount=(amount - allocated).quantize(AMOUNT_QUANTUM),
        )
    )
    return occurrences


def normalize_manual_occurrences(
    entries: Iterable[GeneratedOccurrence],
) -> List[GeneratedOccurrence]:
    """Validate, quantize, and order manually entered cash flows."""
    normalized: List[GeneratedOccurrence] = []
    seen_dates = set()
    for entry in entries:
        if entry.occurrence_date in seen_dates:
            raise ValueError(
                "Only one cash flow is allowed per plan line on "
                f"{entry.occurrence_date}"
            )
        amount = Decimal(entry.amount)
        if amount < 0:
            raise ValueError("Cash flow amounts cannot be negative")
        seen_dates.add(entry.occurrence_date)
        normalized.append(
            GeneratedOccurrence(
                occurrence_date=entry.occurrence_date,
                amount=amount.quantize(AMOUNT_QUANTUM),
            )
        )
    if not normalized:
        raise ValueError("At least one manual cash flow is required")
    return sorted(normalized, key=lambda item: item.occurrence_date)
