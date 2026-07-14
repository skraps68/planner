"""
Unit tests for LaborActualsImportService (labor actuals CSV importer with
optional capital/expense percentage split columns).
"""
import pytest

from app.services.actuals_import import (
    labor_actuals_import_service as svc,
    ActualsImportError,
)

CSV_SINGLE = "project_id,external_worker_id,worker_name,date,percentage\n" \
             "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03,80\n"
CSV_SPLIT = "project_id,external_worker_id,worker_name,date,capital_percentage,expense_percentage\n" \
            "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03,50,30\n"
CSV_NEITHER = "project_id,external_worker_id,worker_name,date\n" \
              "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03\n"
CSV_BOTH = "project_id,external_worker_id,worker_name,date,percentage,capital_percentage,expense_percentage\n" \
           "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03,80,50,30\n"
CSV_RESOURCE_ID = "project_id,resource_id,external_worker_id,worker_name,date,percentage\n" \
                   "11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,EMP1,Ann,2026-03-03,80\n"


def test_parse_single_percentage():
    recs = svc.parse_csv(CSV_SINGLE)
    assert len(recs) == 1
    assert recs[0].percentage_str == "80"


def test_parse_capital_expense_split():
    recs = svc.parse_csv(CSV_SPLIT)
    assert recs[0].capital_percentage_str == "50"
    assert recs[0].expense_percentage_str == "30"


def test_parse_csv_neither_percentage_form_rejects():
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_NEITHER)


def test_parse_csv_both_percentage_forms_rejects():
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_BOTH)


def test_parse_csv_resource_id_column_rejects():
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_RESOURCE_ID)
