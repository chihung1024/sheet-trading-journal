import math

import pandas as pd
import pytest

from journal_engine.core.split_ledger import (
    SplitLedgerError,
    build_split_adjusted_validation_ledger,
)
from journal_engine.core.validator import PortfolioValidator


class FakeMarketClient:
    def __init__(self, multipliers):
        self.multipliers = multipliers

    def get_transaction_multiplier(self, symbol, date):
        key = (symbol, pd.Timestamp(date).strftime("%Y-%m-%d"))
        return self.multipliers.get(key, self.multipliers.get(symbol, 1.0))


def make_transactions():
    return pd.DataFrame(
        [
            {
                "Date": pd.Timestamp("2026-01-02"),
                "Symbol": "FORWARD",
                "Type": "BUY",
                "Qty": 10.0,
                "Price": 100.0,
            },
            {
                "Date": pd.Timestamp("2026-01-03"),
                "Symbol": "REVERSE",
                "Type": "SELL",
                "Qty": 50.0,
                "Price": 8.0,
            },
            {
                "Date": pd.Timestamp("2026-01-04"),
                "Symbol": "INCOME",
                "Type": "DIV",
                "Qty": 25.0,
                "Price": 0.5,
            },
        ]
    )


def test_builds_split_adjusted_ledger_without_mutating_source():
    source = make_transactions()
    original = source.copy(deep=True)
    market = FakeMarketClient({"FORWARD": 4.0, "REVERSE": 0.1, "INCOME": 10.0})

    adjusted = build_split_adjusted_validation_ledger(source, market)

    pd.testing.assert_frame_equal(source, original)
    assert adjusted is not source
    assert adjusted.loc[0, "Qty"] == pytest.approx(40.0)
    assert adjusted.loc[0, "Price"] == pytest.approx(25.0)
    assert adjusted.loc[1, "Qty"] == pytest.approx(5.0)
    assert adjusted.loc[1, "Price"] == pytest.approx(80.0)
    assert adjusted.loc[2, "Qty"] == pytest.approx(25.0)
    assert adjusted.loc[2, "Price"] == pytest.approx(0.5)


def test_transaction_notional_is_preserved_for_forward_and_reverse_splits():
    source = make_transactions()
    market = FakeMarketClient({"FORWARD": 7.0, "REVERSE": 1 / 25})

    adjusted = build_split_adjusted_validation_ledger(source, market)

    for index in (0, 1):
        original_notional = source.loc[index, "Qty"] * source.loc[index, "Price"]
        adjusted_notional = adjusted.loc[index, "Qty"] * adjusted.loc[index, "Price"]
        assert adjusted_notional == pytest.approx(original_notional)


def test_generic_extreme_reverse_split_uses_same_units_as_snapshot_validator():
    raw_qty = 426.8637
    post_split_qty = 0.86
    multiplier = post_split_qty / raw_qty
    source = pd.DataFrame(
        [
            {
                "Date": pd.Timestamp("2026-07-31"),
                "Symbol": "GENERICETF",
                "Type": "BUY",
                "Qty": raw_qty,
                "Price": 12.0,
            }
        ]
    )
    market = FakeMarketClient({"GENERICETF": multiplier})

    adjusted = build_split_adjusted_validation_ledger(source, market)
    holdings = {"GENERICETF": {"qty": post_split_qty}}

    assert PortfolioValidator.validate_holdings_consistency(holdings, adjusted) is True
    assert PortfolioValidator.validate_holdings_consistency(holdings, source) is False


def test_multiplier_is_resolved_per_transaction_date_for_multiple_split_events():
    source = pd.DataFrame(
        [
            {
                "Date": pd.Timestamp("2026-01-01"),
                "Symbol": "MULTI",
                "Type": "BUY",
                "Qty": 2.0,
                "Price": 100.0,
            },
            {
                "Date": pd.Timestamp("2026-06-01"),
                "Symbol": "MULTI",
                "Type": "BUY",
                "Qty": 3.0,
                "Price": 40.0,
            },
        ]
    )
    market = FakeMarketClient(
        {
            ("MULTI", "2026-01-01"): 10.0,
            ("MULTI", "2026-06-01"): 2.0,
        }
    )

    adjusted = build_split_adjusted_validation_ledger(source, market)

    assert adjusted["Qty"].tolist() == pytest.approx([20.0, 6.0])
    assert adjusted["Price"].tolist() == pytest.approx([10.0, 20.0])


@pytest.mark.parametrize("multiplier", [0.0, -1.0, math.nan, math.inf, "bad"])
def test_invalid_split_multipliers_fail_closed(multiplier):
    source = make_transactions().iloc[[0]].copy()
    market = FakeMarketClient({"FORWARD": multiplier})

    with pytest.raises(SplitLedgerError):
        build_split_adjusted_validation_ledger(source, market)


def test_missing_required_columns_fail_closed():
    source = pd.DataFrame([{"Symbol": "ABC", "Qty": 1.0}])

    with pytest.raises(SplitLedgerError, match="missing required columns"):
        build_split_adjusted_validation_ledger(source, FakeMarketClient({}))


def test_market_client_without_multiplier_api_fails_closed():
    source = make_transactions().iloc[[0]].copy()

    with pytest.raises(SplitLedgerError, match="does not provide split multipliers"):
        build_split_adjusted_validation_ledger(source, object())
