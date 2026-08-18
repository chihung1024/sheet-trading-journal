from journal_engine.core.performance_metrics import (
    MAX_SUPPORTED_ABS_XIRR_PERCENT,
    calculate_xirr_metric,
)
from journal_engine.core.validator import PortfolioValidator


def _cashflow():
    return [{"date": "2025-01-01", "amount": -100.0}]


def test_solver_result_above_supported_domain_becomes_existing_unavailable_contract():
    rate = (MAX_SUPPORTED_ABS_XIRR_PERCENT + 1.0) / 100.0
    result = calculate_xirr_metric(
        _cashflow(),
        terminal_value_twd=120.0,
        terminal_date="2026-01-01",
        solver=lambda dates, amounts: rate,
    )

    assert result.value_percent == 0.0
    assert result.status == "undefined"
    assert result.reason == "solver_outside_supported_range"
    assert result.asof_date == "2026-01-01"
    assert result.cashflow_conventional is True


def test_exact_supported_boundary_remains_valid():
    rate = MAX_SUPPORTED_ABS_XIRR_PERCENT / 100.0
    result = calculate_xirr_metric(
        _cashflow(),
        terminal_value_twd=120.0,
        terminal_date="2026-01-01",
        solver=lambda dates, amounts: rate,
    )

    assert result.value_percent == MAX_SUPPORTED_ABS_XIRR_PERCENT
    assert result.status == "ok"
    assert result.reason is None


def test_metric_domain_matches_existing_upload_validator_boundary():
    assert PortfolioValidator.validate_xirr_value(MAX_SUPPORTED_ABS_XIRR_PERCENT) is True
    assert PortfolioValidator.validate_xirr_value(MAX_SUPPORTED_ABS_XIRR_PERCENT + 0.01) is False
