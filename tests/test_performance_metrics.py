from __future__ import annotations

import math

import pandas as pd
import pytest

from journal_engine.core import calculator as calculator_module
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.performance_metrics import XirrMetric, calculate_xirr_metric


def test_xirr_uses_raw_terminal_value_and_exact_valuation_date():
    observed = {}

    def solver(dates, amounts):
        observed["dates"] = list(dates)
        observed["amounts"] = list(amounts)
        return 0.123456

    result = calculate_xirr_metric(
        [{"date": pd.Timestamp("2025-08-05"), "amount": -100.25}],
        terminal_value_twd=123.456789,
        terminal_date=pd.Timestamp("2026-08-05"),
        solver=solver,
    )

    assert result.value_percent == 12.35
    assert result.status == "ok"
    assert result.reason is None
    assert result.asof_date == "2026-08-05"
    assert result.cashflow_conventional is True
    assert observed["dates"][-1].isoformat() == "2026-08-05"
    assert observed["amounts"][-1] == 123.456789


def test_xirr_zero_return_is_distinct_from_undefined():
    solved = calculate_xirr_metric(
        [{"date": "2025-01-01", "amount": -100.0}],
        terminal_value_twd=100.0,
        terminal_date="2026-01-01",
        solver=lambda dates, amounts: 0.0,
    )
    undefined = calculate_xirr_metric(
        [{"date": "2025-01-01", "amount": -100.0}],
        terminal_value_twd=100.0,
        terminal_date="2026-01-01",
        solver=lambda dates, amounts: None,
    )

    assert solved.value_percent == 0.0
    assert solved.status == "ok"
    assert solved.reason is None
    assert undefined.value_percent == 0.0
    assert undefined.status == "undefined"
    assert undefined.reason == "solver_no_solution"


def test_xirr_solver_exception_and_nonfinite_result_are_explicit():
    def explode(dates, amounts):
        raise RuntimeError("solver failed")

    error = calculate_xirr_metric(
        [{"date": "2025-01-01", "amount": -100.0}],
        120.0,
        "2026-01-01",
        solver=explode,
    )
    nonfinite = calculate_xirr_metric(
        [{"date": "2025-01-01", "amount": -100.0}],
        120.0,
        "2026-01-01",
        solver=lambda dates, amounts: math.inf,
    )

    assert (error.value_percent, error.status, error.reason) == (
        0.0,
        "undefined",
        "solver_error",
    )
    assert (nonfinite.value_percent, nonfinite.status, nonfinite.reason) == (
        0.0,
        "undefined",
        "solver_non_finite",
    )


def test_xirr_rejects_missing_sign_change_and_zero_date_span_before_solver():
    calls = []

    def solver(dates, amounts):
        calls.append((dates, amounts))
        return 0.1

    no_positive = calculate_xirr_metric(
        [{"date": "2025-01-01", "amount": -100.0}],
        0.0,
        "2026-01-01",
        solver=solver,
    )
    same_date = calculate_xirr_metric(
        [{"date": "2025-01-01", "amount": -100.0}],
        110.0,
        "2025-01-01",
        solver=solver,
    )

    assert no_positive.status == "undefined"
    assert no_positive.reason == "insufficient_sign_change"
    assert same_date.status == "undefined"
    assert same_date.reason == "insufficient_date_span"
    assert calls == []


def test_xirr_marks_nonconventional_cashflows_without_discarding_solver_result():
    result = calculate_xirr_metric(
        [
            {"date": "2025-01-01", "amount": -100.0},
            {"date": "2025-06-01", "amount": 150.0},
            {"date": "2025-09-01", "amount": -80.0},
        ],
        terminal_value_twd=60.0,
        terminal_date="2026-01-01",
        solver=lambda dates, amounts: 0.08,
    )

    assert result.status == "ok"
    assert result.value_percent == 8.0
    assert result.cashflow_conventional is False


def test_xirr_invalid_inputs_and_no_cashflows_are_machine_readable():
    no_cashflows = calculate_xirr_metric([], 0.0, "2026-01-01")
    bad_terminal = calculate_xirr_metric(
        [{"date": "2025-01-01", "amount": -1.0}],
        terminal_value_twd=float("nan"),
        terminal_date="2026-01-01",
    )
    bad_terminal_date = calculate_xirr_metric(
        [{"date": "2025-01-01", "amount": -1.0}],
        terminal_value_twd=2.0,
        terminal_date="not-a-date",
    )
    bad_cashflow = calculate_xirr_metric(
        [{"date": "bad-date", "amount": -1.0}],
        terminal_value_twd=2.0,
        terminal_date="2026-01-01",
    )

    assert no_cashflows.status == "not_applicable"
    assert no_cashflows.reason == "no_cashflows"
    assert bad_terminal.reason == "invalid_terminal_value"
    assert bad_terminal_date.reason == "invalid_terminal_date"
    assert bad_cashflow.reason == "invalid_cashflow"


class TinyTwdMarket:
    def __init__(self):
        self.realtime_fx_rate = None
        self.fx_rates = pd.Series(dtype=float)
        self.market_data = {
            "0050.TW": pd.DataFrame(
                {
                    "Close_Adjusted": [10.0, 10.04],
                    "Dividends": [0.0, 0.0],
                    "Stock Splits": [0.0, 0.0],
                    "Split_Factor": [1.0, 1.0],
                },
                index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
            )
        }

    def get_transaction_multiplier(self, symbol, value_date):
        return 1.0

    def get_price(self, symbol, value_date):
        frame = self.market_data[symbol]
        target = pd.Timestamp(value_date).normalize()
        pos = frame.index.get_indexer([target], method="pad")[0]
        return 0.0 if pos == -1 else float(frame.iloc[pos]["Close_Adjusted"])

    def get_price_asof(self, symbol, value_date):
        frame = self.market_data[symbol]
        target = pd.Timestamp(value_date).normalize()
        pos = frame.index.get_indexer([target], method="pad")[0]
        if pos == -1:
            return 0.0, target
        return float(frame.iloc[pos]["Close_Adjusted"]), frame.index[pos]

    def get_prev_trading_date(self, symbol, used_date):
        frame = self.market_data[symbol]
        target = pd.Timestamp(used_date).normalize()
        pos = frame.index.get_indexer([target], method="pad")[0]
        return frame.index[max(pos - 1, 0)] if pos >= 0 else target

    def get_dividend(self, symbol, value_date):
        return 0.0


def test_calculator_passes_raw_terminal_value_and_history_date_to_xirr(monkeypatch):
    observed = {}

    def fake_metric(cashflows, terminal_value_twd, terminal_date):
        observed["cashflows"] = list(cashflows)
        observed["terminal_value_twd"] = terminal_value_twd
        observed["terminal_date"] = terminal_date
        return XirrMetric(
            value_percent=1.23,
            status="ok",
            reason=None,
            asof_date="2026-01-02",
            cashflow_conventional=True,
        )

    monkeypatch.setattr(calculator_module, "calculate_xirr_metric", fake_metric)
    tx = pd.DataFrame(
        [
            {
                "Date": pd.Timestamp("2026-01-01"),
                "Symbol": "0050.TW",
                "Type": "BUY",
                "Qty": 3.0,
                "Price": 10.0,
                "Commission": 0.0,
                "Tax": 0.0,
                "Tag": "",
            }
        ]
    )
    calculator = PortfolioCalculator(
        tx,
        TinyTwdMarket(),
        benchmark_ticker="0050.TW",
    )

    group = calculator._calculate_single_portfolio(
        tx,
        pd.to_datetime(["2026-01-01", "2026-01-02"]),
        current_fx=32.0,
        group_name="all",
        current_stage="CLOSED",
        stage_desc="Markets Closed",
        benchmark_tax_rate=0.0,
    )

    # Serialized holding market value is rounded to 30, but raw final valuation is 30.12.
    assert group.holdings[0].market_value_twd == 30.0
    assert group.history[-1]["_raw_total_value"] == pytest.approx(30.12)
    assert observed["terminal_value_twd"] == pytest.approx(30.12)
    assert observed["terminal_date"] == "2026-01-02"
    assert group.summary.xirr == 1.23
    assert group.summary.xirr_status == "ok"
    assert group.summary.xirr_asof_date == "2026-01-02"
