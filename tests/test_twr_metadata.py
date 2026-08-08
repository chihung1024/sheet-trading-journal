from __future__ import annotations

from types import SimpleNamespace

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


def test_legacy_twr_without_status_remains_backward_compatible():
    assert PortfolioValidator.validate_twr_metadata(make_summary(twr=12.34)) is True


def test_reliable_twr_requires_clean_metadata():
    valid = make_summary(
        twr=12.34,
        twr_status="ok",
        twr_reason=None,
        twr_invalid_since=None,
    )
    polluted_reason = make_summary(
        twr=12.34,
        twr_status="ok",
        twr_reason="zero_denominator",
    )
    polluted_date = make_summary(
        twr=12.34,
        twr_status="ok",
        twr_invalid_since="2026-01-05",
    )

    assert PortfolioValidator.validate_twr_metadata(valid) is True
    assert PortfolioValidator.validate_twr_metadata(polluted_reason) is False
    assert PortfolioValidator.validate_twr_metadata(polluted_date) is False


def test_not_applicable_twr_requires_zero_compatibility_value_and_reason():
    valid = make_summary(
        twr=0.0,
        twr_status="not_applicable",
        twr_reason="no_history",
    )
    nonzero = make_summary(
        twr=5.0,
        twr_status="not_applicable",
        twr_reason="no_history",
    )
    missing_reason = make_summary(twr=0.0, twr_status="not_applicable")

    assert PortfolioValidator.validate_twr_metadata(valid) is True
    assert PortfolioValidator.validate_twr_metadata(nonzero) is False
    assert PortfolioValidator.validate_twr_metadata(missing_reason) is False


def test_undefined_twr_preserves_legacy_numeric_chain_but_requires_reason_and_date():
    valid = make_summary(
        twr=37.5,
        twr_status="undefined",
        twr_reason="zero_denominator",
        twr_invalid_since="2026-01-05",
    )
    missing_date = make_summary(
        twr=37.5,
        twr_status="undefined",
        twr_reason="zero_denominator",
    )
    invalid_date = make_summary(
        twr=37.5,
        twr_status="undefined",
        twr_reason="zero_denominator",
        twr_invalid_since="not-a-date",
    )
    missing_reason = make_summary(
        twr=37.5,
        twr_status="undefined",
        twr_invalid_since="2026-01-05",
    )

    assert PortfolioValidator.validate_twr_metadata(valid) is True
    assert PortfolioValidator.validate_twr_metadata(missing_date) is False
    assert PortfolioValidator.validate_twr_metadata(invalid_date) is False
    assert PortfolioValidator.validate_twr_metadata(missing_reason) is False


def test_twr_metadata_rejects_unknown_status_and_nonfinite_compatibility_value():
    unknown = make_summary(twr=0.0, twr_status="mystery", twr_reason="x")
    assert PortfolioValidator.validate_twr_metadata(unknown) is False

    bypassed = SimpleNamespace(
        twr=float("inf"),
        twr_status="undefined",
        twr_reason="zero_denominator",
        twr_invalid_since="2026-01-05",
    )
    assert PortfolioValidator.validate_twr_metadata(bypassed) is False
