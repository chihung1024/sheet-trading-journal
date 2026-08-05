from types import SimpleNamespace

import pandas as pd
import pytest

from journal_engine.core.daily_pnl_reconciler import (
    DailyPnLReconciliationError,
    reconcile_snapshot_daily_pnl,
)


class FakeMarket:
    def __init__(self, prices, fx=32.0, dividends=None):
        self.prices = prices
        self.fx = fx
        self.realtime_fx_rate = None
        self.dividends = dividends or {}

    def get_price_asof(self, symbol, value_date):
        date_key = pd.Timestamp(value_date).strftime("%Y-%m-%d")
        if (symbol, date_key) in self.prices:
            return self.prices[(symbol, date_key)], pd.Timestamp(value_date)
        earlier = sorted(
            key_date
            for key_symbol, key_date in self.prices
            if key_symbol == symbol and key_date <= date_key
        )
        used = earlier[-1]
        return self.prices[(symbol, used)], pd.Timestamp(used)

    def get_dividend(self, symbol, value_date):
        return self.dividends.get(
            (symbol, pd.Timestamp(value_date).strftime("%Y-%m-%d")),
            0.0,
        )

    def get_transaction_multiplier(self, symbol, value_date):
        return 1.0


class FakeCalculator:
    def __init__(self, market):
        self.market = market

    def _is_taiwan_stock(self, symbol):
        return symbol.endswith(".TW")

    def _get_asset_effective_price_and_fx(
        self,
        symbol,
        value_date,
        current_fx,
    ):
        price, _used = self.market.get_price_asof(symbol, value_date)
        return price, 1.0 if self._is_taiwan_stock(symbol) else self.market.fx


def make_group(history):
    return SimpleNamespace(
        summary=SimpleNamespace(
            daily_pnl_twd=0.0,
            daily_pnl_breakdown=None,
            daily_pnl_base_value=10000.0,
            daily_pnl_roi_percent=None,
        ),
        holdings=[],
        history=history,
        pending_dividends=[],
        day_ledger=[],
        anomalies=[],
    )


def make_snapshot(history):
    group = make_group(history)
    return SimpleNamespace(
        groups={"all": group},
        summary=group.summary,
        holdings=group.holdings,
        history=group.history,
        pending_dividends=group.pending_dividends,
        exchange_rate=32.0,
    )


def test_closed_same_day_symbol_is_included_in_canonical_components():
    df = pd.DataFrame(
        [
            {
                "Date": "2026-08-04",
                "Symbol": "SPCH",
                "Type": "BUY",
                "Qty": 10,
                "Price": 10,
                "Commission": 0,
                "Tax": 0,
                "Tag": "Core",
                "id": 1,
            },
            {
                "Date": "2026-08-05",
                "Symbol": "SPCH",
                "Type": "SELL",
                "Qty": 10,
                "Price": 12,
                "Commission": 1,
                "Tax": 1,
                "Tag": "Core",
                "id": 2,
            },
        ]
    )
    df["Date"] = pd.to_datetime(df["Date"])
    market = FakeMarket(
        {
            ("SPCH", "2026-08-04"): 10,
            ("SPCH", "2026-08-05"): 10,
        }
    )
    calculator = FakeCalculator(market)
    # Beginning value 3200, ending 0, sell cash flow 3776 -> PnL 576.
    history = [
        {
            "date": "2026-08-04",
            "_raw_total_value": 3200.0,
            "_raw_net_cashflow_twd": -3200.0,
        },
        {
            "date": "2026-08-05",
            "_raw_total_value": 0.0,
            "_raw_net_cashflow_twd": 3776.0,
        },
    ]
    snapshot = make_snapshot(history)

    results = reconcile_snapshot_daily_pnl(snapshot, df, calculator)

    assert results[0]["status"] == "reconciled"
    assert snapshot.summary.daily_pnl_twd == 576.0
    assert snapshot.summary.daily_pnl_breakdown == {
        "tw_pnl_twd": 0.0,
        "us_pnl_twd": 576.0,
        "fx_pnl_twd": 0.0,
    }
    assert [
        row["symbol"] for row in snapshot.groups["all"].day_ledger
    ] == ["SPCH"]
    assert snapshot.groups["all"].day_ledger[0]["end_qty"] == 0.0


def test_same_day_buy_fee_and_price_move_reconcile():
    df = pd.DataFrame(
        [
            {
                "Date": "2026-08-05",
                "Symbol": "2330.TW",
                "Type": "BUY",
                "Qty": 2,
                "Price": 100,
                "Commission": 3,
                "Tax": 0,
                "Tag": "Core",
                "id": 1,
            },
        ]
    )
    df["Date"] = pd.to_datetime(df["Date"])
    market = FakeMarket(
        {
            ("2330.TW", "2026-08-04"): 98,
            ("2330.TW", "2026-08-05"): 105,
        }
    )
    calculator = FakeCalculator(market)
    history = [
        {
            "date": "2026-08-04",
            "_raw_total_value": 0.0,
            "_raw_net_cashflow_twd": 0.0,
        },
        {
            "date": "2026-08-05",
            "_raw_total_value": 210.0,
            "_raw_net_cashflow_twd": -203.0,
        },
    ]
    snapshot = make_snapshot(history)

    reconcile_snapshot_daily_pnl(snapshot, df, calculator)

    assert snapshot.summary.daily_pnl_twd == 7.0
    ledger = snapshot.groups["all"].day_ledger[0]
    assert ledger["fee_tax_pnl_twd"] == -3.0
    assert ledger["execution_pnl_twd"] == 10.0


def test_group_and_root_use_same_canonical_result():
    df = pd.DataFrame(
        [
            {
                "Date": "2026-08-04",
                "Symbol": "2330.TW",
                "Type": "BUY",
                "Qty": 1,
                "Price": 100,
                "Commission": 0,
                "Tax": 0,
                "Tag": "Core",
                "id": 1,
            },
        ]
    )
    df["Date"] = pd.to_datetime(df["Date"])
    market = FakeMarket(
        {
            ("2330.TW", "2026-08-04"): 100,
            ("2330.TW", "2026-08-05"): 110,
        }
    )
    calculator = FakeCalculator(market)
    history = [
        {
            "date": "2026-08-04",
            "_raw_total_value": 100.0,
            "_raw_net_cashflow_twd": -100.0,
        },
        {
            "date": "2026-08-05",
            "_raw_total_value": 110.0,
            "_raw_net_cashflow_twd": 0.0,
        },
    ]
    all_group = make_group(history)
    core_group = make_group(history)
    snapshot = SimpleNamespace(
        groups={"all": all_group, "Core": core_group},
        summary=all_group.summary,
        holdings=[],
        history=history,
        pending_dividends=[],
        exchange_rate=32.0,
    )

    reconcile_snapshot_daily_pnl(snapshot, df, calculator)

    assert snapshot.summary.daily_pnl_twd == 10.0
    assert snapshot.groups["Core"].summary.daily_pnl_twd == 10.0
    assert snapshot.summary is snapshot.groups["all"].summary


def test_unexplained_formula_component_difference_fails_closed():
    df = pd.DataFrame(
        [
            {
                "Date": "2026-08-04",
                "Symbol": "2330.TW",
                "Type": "BUY",
                "Qty": 1,
                "Price": 100,
                "Commission": 0,
                "Tax": 0,
                "Tag": "Core",
                "id": 1,
            },
        ]
    )
    df["Date"] = pd.to_datetime(df["Date"])
    market = FakeMarket(
        {
            ("2330.TW", "2026-08-04"): 100,
            ("2330.TW", "2026-08-05"): 110,
        }
    )
    calculator = FakeCalculator(market)
    history = [
        {
            "date": "2026-08-04",
            "_raw_total_value": 100.0,
            "_raw_net_cashflow_twd": -100.0,
        },
        {
            "date": "2026-08-05",
            "_raw_total_value": 999.0,
            "_raw_net_cashflow_twd": 0.0,
        },
    ]
    snapshot = make_snapshot(history)

    with pytest.raises(
        DailyPnLReconciliationError,
        match="canonical reconciliation failed",
    ):
        reconcile_snapshot_daily_pnl(snapshot, df, calculator)
