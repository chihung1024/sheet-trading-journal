from __future__ import annotations

import pandas as pd

from journal_engine.core.validator import PortfolioValidator
from journal_engine.models import PortfolioSummary


def make_summary(**overrides):
    values = {
        "total_value": 100.0,
        "invested_capital": 100.0,
        "total_pnl": 0.0,
        "twr": 0.0,
        "xirr": 0.0,
        "realized_pnl": 0.0,
        "benchmark_twr": 0.0,
        "daily_pnl_twd": 0.0,
    }
    values.update(overrides)
    return PortfolioSummary(**values)


def test_legacy_xirr_without_status_remains_backward_compatible():
    assert PortfolioValidator.validate_xirr_metadata(make_summary(xirr=12.34)) is True


def test_ok_xirr_requires_valid_asof_and_no_error_reason():
    valid = make_summary(
        xirr=0.0,
        xirr_status="ok",
        xirr_reason=None,
        xirr_asof_date="2026-08-05",
        xirr_cashflow_conventional=True,
    )
    missing_asof = make_summary(xirr=1.0, xirr_status="ok")
    invalid_asof = make_summary(
        xirr=1.0,
        xirr_status="ok",
        xirr_asof_date="not-a-date",
    )
    polluted = make_summary(
        xirr=1.0,
        xirr_status="ok",
        xirr_reason="solver_error",
        xirr_asof_date="2026-08-05",
    )

    assert PortfolioValidator.validate_xirr_metadata(valid) is True
    assert PortfolioValidator.validate_xirr_metadata(missing_asof) is False
    assert PortfolioValidator.validate_xirr_metadata(invalid_asof) is False
    assert PortfolioValidator.validate_xirr_metadata(polluted) is False


def test_unavailable_xirr_requires_zero_sentinel_and_reason():
    undefined = make_summary(
        xirr=0.0,
        xirr_status="undefined",
        xirr_reason="solver_no_solution",
        xirr_asof_date="2026-08-05",
        xirr_cashflow_conventional=True,
    )
    not_applicable = make_summary(
        xirr=0.0,
        xirr_status="not_applicable",
        xirr_reason="no_cashflows",
    )
    fake_nonzero = make_summary(
        xirr=5.0,
        xirr_status="undefined",
        xirr_reason="solver_error",
    )
    missing_reason = make_summary(xirr=0.0, xirr_status="undefined")

    assert PortfolioValidator.validate_xirr_metadata(undefined) is True
    assert PortfolioValidator.validate_xirr_metadata(not_applicable) is True
    assert PortfolioValidator.validate_xirr_metadata(fake_nonzero) is False
    assert PortfolioValidator.validate_xirr_metadata(missing_reason) is False


def test_xirr_metadata_rejects_unknown_status_and_non_boolean_conventional_flag():
    unknown = make_summary(xirr=0.0, xirr_status="mystery", xirr_reason="x")
    invalid_flag = make_summary(
        xirr=1.0,
        xirr_status="ok",
        xirr_asof_date=pd.Timestamp("2026-08-05").strftime("%Y-%m-%d"),
        xirr_cashflow_conventional="yes",
    )

    assert PortfolioValidator.validate_xirr_metadata(unknown) is False
    assert PortfolioValidator.validate_xirr_metadata(invalid_flag) is False
