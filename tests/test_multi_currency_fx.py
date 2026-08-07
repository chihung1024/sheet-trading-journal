from __future__ import annotations

import pandas as pd
import pytest

from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.daily_pnl_reconciler import reconcile_snapshot_daily_pnl
from journal_engine.core.dividend_policy import UnsupportedDividendPolicyError


class CurrencyAwareMarket:
    def __init__(self, prices_by_symbol, fx_by_date, dividends=None):
        self.market_data = {}
        self.fx_rates_by_currency = {}
        self.realtime_fx_rates_by_currency = {}
        self.realtime_fx_rate = None
        self._dividends = dividends or {}

        for symbol, rows in prices_by_symbol.items():
            frame = pd.DataFrame(rows)
            frame["Date"] = pd.to_datetime(frame["Date"])
            frame = frame.set_index("Date").sort_index()
            if "Dividends" not in frame.columns:
                frame["Dividends"] = 0.0
            if "Stock Splits" not in frame.columns:
                frame["Stock Splits"] = 0.0
            frame["Split_Factor"] = 1.0
            self.market_data[symbol] = frame

        fx_frame = pd.DataFrame(fx_by_date).T
        fx_frame.index = pd.to_datetime(fx_frame.index)
        for currency in fx_frame.columns:
            self.fx_rates_by_currency[currency] = pd.Series(
                fx_frame[currency].astype(float).values,
                index=fx_frame.index,
            ).sort_index()
        self.fx_rates = self.fx_rates_by_currency.get("USD", pd.Series(dtype=float))

    def get_fx_snapshot(self, value_date):
        target = pd.Timestamp(value_date).normalize()
        snapshot = {"TWD": 1.0}
        for currency, series in self.fx_rates_by_currency.items():
            value = series.asof(target)
            if pd.notna(value):
                snapshot[currency] = float(value)
        return snapshot

    def get_realtime_fx_snapshot(self, value_date=None):
        if value_date is not None:
            target = value_date
        elif not self.fx_rates.empty:
            target = self.fx_rates.index[-1]
        else:
            target = max(frame.index[-1] for frame in self.market_data.values())
        return self.get_fx_snapshot(target)

    def get_price(self, symbol, value_date):
        frame = self.market_data[symbol]
        target = pd.Timestamp(value_date).normalize()
        if target in frame.index:
            return float(frame.loc[target, "Close_Adjusted"])
        pos = frame.index.get_indexer([target], method="pad")[0]
        return 0.0 if pos == -1 else float(frame.iloc[pos]["Close_Adjusted"])

    def get_price_asof(self, symbol, value_date):
        frame = self.market_data[symbol]
        target = pd.Timestamp(value_date).normalize()
        if target in frame.index:
            return float(frame.loc[target, "Close_Adjusted"]), target
        pos = frame.index.get_indexer([target], method="pad")[0]
        if pos == -1:
            return 0.0, target
        return float(frame.iloc[pos]["Close_Adjusted"]), frame.index[pos]

    def get_prev_trading_date(self, symbol, used_date):
        frame = self.market_data[symbol]
        target = pd.Timestamp(used_date).normalize()
        pos = frame.index.get_indexer([target], method="pad")[0]
        if pos <= 0:
            return target if pos == -1 else frame.index[pos]
        return frame.index[pos - 1]

    def get_transaction_multiplier(self, symbol, value_date):
        return 1.0

    def get_dividend(self, symbol, value_date):
        key = (symbol, pd.Timestamp(value_date).strftime("%Y-%m-%d"))
        return float(self._dividends.get(key, 0.0))


def transactions(rows):
    frame = pd.DataFrame(rows)
    for column, default in (("Commission", 0.0), ("Tax", 0.0), ("Tag", "")):
        if column not in frame.columns:
            frame[column] = default
    frame["Date"] = pd.to_datetime(frame["Date"])
    return frame


def base_prices(krw_day2=101000.0):
    return {
        "SPY": [
            {"Date": "2026-08-04", "Close_Adjusted": 100.0},
            {"Date": "2026-08-05", "Close_Adjusted": 100.0},
        ],
        "005930.KS": [
            {"Date": "2026-08-04", "Close_Adjusted": 100000.0},
            {"Date": "2026-08-05", "Close_Adjusted": krw_day2},
        ],
    }


def test_twd_only_portfolio_does_not_require_usd_fx_context():
    prices = {
        "0050.TW": [
            {"Date": "2026-08-04", "Close_Adjusted": 50.0},
            {"Date": "2026-08-05", "Close_Adjusted": 51.0},
        ]
    }
    market = CurrencyAwareMarket(
        prices,
        {
            "2026-08-04": {"TWD": 1.0},
            "2026-08-05": {"TWD": 1.0},
        },
    )
    tx = transactions([
        {"Date": "2026-08-05", "Symbol": "0050.TW", "Type": "BUY", "Qty": 10, "Price": 51.0},
    ])

    snapshot = PortfolioCalculator(tx, market, benchmark_ticker="0050.TW").run()

    assert snapshot is not None
    assert snapshot.holdings[0].currency == "TWD"
    assert snapshot.holdings[0].market_value_twd == 510.0
    assert snapshot.history[-1]["_raw_fx_rates"] == {"TWD": 1.0}


def test_krw_market_value_and_price_pnl_use_twd_per_krw():
    market = CurrencyAwareMarket(
        base_prices(101000.0),
        {
            "2026-08-04": {"USD": 32.0, "KRW": 0.022},
            "2026-08-05": {"USD": 32.0, "KRW": 0.022},
        },
    )
    tx = transactions([
        {"Date": "2026-08-04", "Symbol": "005930.KS", "Type": "BUY", "Qty": 10, "Price": 100000.0},
    ])

    calculator = PortfolioCalculator(tx, market)
    snapshot = calculator.run()
    reconcile_snapshot_daily_pnl(snapshot, calculator.df, calculator)

    holding = snapshot.holdings[0]
    assert holding.currency == "KRW"
    assert holding.market_value_twd == 22220.0
    assert snapshot.summary.daily_pnl_twd == 220.0
    assert snapshot.summary.daily_pnl_breakdown["us_pnl_twd"] == 220.0
    assert snapshot.summary.daily_pnl_breakdown["fx_pnl_twd"] == 0.0
    assert snapshot.groups["all"].day_ledger[0]["currency"] == "KRW"


def test_krw_fx_change_is_attributed_to_fx_not_foreign_price_pnl():
    market = CurrencyAwareMarket(
        base_prices(100000.0),
        {
            "2026-08-04": {"USD": 32.0, "KRW": 0.022},
            "2026-08-05": {"USD": 32.0, "KRW": 0.023},
        },
    )
    tx = transactions([
        {"Date": "2026-08-04", "Symbol": "005930.KS", "Type": "BUY", "Qty": 10, "Price": 100000.0},
    ])

    calculator = PortfolioCalculator(tx, market)
    snapshot = calculator.run()
    reconcile_snapshot_daily_pnl(snapshot, calculator.df, calculator)

    assert snapshot.summary.daily_pnl_twd == 1000.0
    assert snapshot.summary.daily_pnl_breakdown["us_pnl_twd"] == 0.0
    assert snapshot.summary.daily_pnl_breakdown["fx_pnl_twd"] == 1000.0


def test_confirmed_krw_dividend_uses_actual_native_cashflow_without_tax_guess():
    market = CurrencyAwareMarket(
        base_prices(100000.0),
        {
            "2026-08-04": {"USD": 32.0, "KRW": 0.022},
            "2026-08-05": {"USD": 32.0, "KRW": 0.022},
        },
        dividends={("005930.KS", "2026-08-05"): 1000.0},
    )
    tx = transactions([
        {"Date": "2026-08-04", "Symbol": "005930.KS", "Type": "BUY", "Qty": 10, "Price": 100000.0},
        {"Date": "2026-08-05", "Symbol": "005930.KS", "Type": "DIV", "Qty": 1, "Price": 1000.0},
    ])

    calculator = PortfolioCalculator(tx, market)
    snapshot = calculator.run()
    reconcile_snapshot_daily_pnl(snapshot, calculator.df, calculator)

    assert snapshot.summary.realized_pnl == 22.0
    assert snapshot.summary.daily_pnl_twd == 22.0
    assert snapshot.pending_dividends == []
    assert snapshot.groups["all"].anomalies == []


def test_automatic_krw_pending_dividend_is_deferred_with_review_anomaly():
    market = CurrencyAwareMarket(
        base_prices(100000.0),
        {
            "2026-08-04": {"USD": 32.0, "KRW": 0.022},
            "2026-08-05": {"USD": 32.0, "KRW": 0.022},
        },
        dividends={("005930.KS", "2026-08-05"): 1000.0},
    )
    tx = transactions([
        {"Date": "2026-08-04", "Symbol": "005930.KS", "Type": "BUY", "Qty": 10, "Price": 100000.0},
    ])

    calculator = PortfolioCalculator(tx, market)
    snapshot = calculator.run()
    reconcile_snapshot_daily_pnl(snapshot, calculator.df, calculator)

    assert snapshot.summary.realized_pnl == 0.0
    assert snapshot.summary.daily_pnl_twd == 0.0
    assert snapshot.pending_dividends == []
    assert snapshot.groups["all"].anomalies == [
        {
            "code": "DIVIDEND_POLICY_REVIEW_REQUIRED",
            "symbol": "005930.KS",
            "date": "2026-08-05",
            "currency": "KRW",
            "message": "Automatic pending dividend not accrued because withholding policy is unreviewed for KRW",
        }
    ]


def test_foreign_benchmark_without_dividend_does_not_require_guessed_tax_policy():
    market = CurrencyAwareMarket(
        base_prices(100000.0),
        {
            "2026-08-04": {"USD": 32.0, "KRW": 0.022},
            "2026-08-05": {"USD": 32.0, "KRW": 0.022},
        },
    )
    tx = transactions([
        {"Date": "2026-08-04", "Symbol": "005930.KS", "Type": "BUY", "Qty": 1, "Price": 100000.0},
    ])

    snapshot = PortfolioCalculator(tx, market, benchmark_ticker="005930.KS").run()

    assert snapshot is not None
    assert snapshot.holdings[0].currency == "KRW"


def test_foreign_benchmark_dividend_fails_closed_when_tax_policy_is_unreviewed():
    market = CurrencyAwareMarket(
        base_prices(100000.0),
        {
            "2026-08-04": {"USD": 32.0, "KRW": 0.022},
            "2026-08-05": {"USD": 32.0, "KRW": 0.022},
        },
        dividends={("005930.KS", "2026-08-05"): 1000.0},
    )
    tx = transactions([
        {"Date": "2026-08-04", "Symbol": "005930.KS", "Type": "BUY", "Qty": 1, "Price": 100000.0},
    ])

    with pytest.raises(UnsupportedDividendPolicyError, match="Benchmark dividend"):
        PortfolioCalculator(tx, market, benchmark_ticker="005930.KS").run()
