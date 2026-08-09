from datetime import date, datetime

import pandas as pd
import pytest
import pytz

from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.daily_pnl_helper import DailyPnLHelper


class ClockFixtureMarket:
    def __init__(self):
        self.realtime_fx_rate = 30.0
        self.fx_rates = pd.Series([30.0], index=[pd.Timestamp("2026-01-01")])
        self.market_data = {
            "0050.TW": self._frame([100.0, 101.0, 102.0]),
            "2330.TW": self._frame([500.0, 510.0, 520.0]),
        }

    @staticmethod
    def _frame(values):
        return pd.DataFrame(
            {
                "Close_Adjusted": values,
                "Dividends": [0.0, 0.0, 0.0],
                "Split_Factor": [1.0, 1.0, 1.0],
            },
            index=pd.to_datetime(["2026-01-01", "2026-01-02", "2026-01-03"]),
        )

    def get_price(self, symbol, value_date):
        value_date = pd.Timestamp(value_date).normalize()
        frame = self.market_data[symbol]
        if value_date in frame.index:
            return float(frame.loc[value_date, "Close_Adjusted"])
        idx = frame.index.get_indexer([value_date], method="pad")[0]
        return 0.0 if idx == -1 else float(frame.iloc[idx]["Close_Adjusted"])

    def get_price_asof(self, symbol, value_date):
        value_date = pd.Timestamp(value_date).normalize()
        frame = self.market_data[symbol]
        if value_date in frame.index:
            return float(frame.loc[value_date, "Close_Adjusted"]), value_date
        idx = frame.index.get_indexer([value_date], method="pad")[0]
        if idx == -1:
            return 0.0, value_date
        used = frame.index[idx]
        return float(frame.iloc[idx]["Close_Adjusted"]), used

    def get_prev_trading_date(self, symbol, used_date):
        used_date = pd.Timestamp(used_date).normalize()
        frame = self.market_data[symbol]
        idx = frame.index.get_indexer([used_date], method="pad")[0]
        if idx <= 0:
            return frame.index[0]
        return frame.index[idx - 1]

    def get_transaction_multiplier(self, symbol, value_date):
        return 1.0

    def get_dividend(self, symbol, value_date):
        return 0.0


def _transactions():
    return pd.DataFrame(
        [
            {
                "Date": pd.Timestamp("2026-01-01"),
                "Symbol": "2330.TW",
                "Type": "BUY",
                "Qty": 1.0,
                "Price": 500.0,
                "Commission": 0.0,
                "Tax": 0.0,
                "Tag": "core",
            }
        ]
    )


def _taipei_datetime(year, month, day, hour, minute=0):
    return pytz.timezone("Asia/Taipei").localize(
        datetime(year, month, day, hour, minute)
    )


def test_daily_pnl_helper_accepts_explicit_clock_provider():
    fixed = _taipei_datetime(2026, 1, 2, 10, 0)
    helper = DailyPnLHelper(now_provider=lambda: fixed)

    assert helper.get_market_stage() == (helper.STAGE_MARKET_OPEN, "TW Market Open")
    assert helper.get_effective_display_date(True) == date(2026, 1, 2)


def test_daily_pnl_helper_rejects_naive_clock_provider():
    helper = DailyPnLHelper(now_provider=lambda: datetime(2026, 1, 2, 10, 0))

    with pytest.raises(ValueError, match="now_provider must return a timezone-aware datetime"):
        helper.get_market_stage()


def test_calculator_fixed_clock_controls_asof_updated_at_and_end_date():
    fixed = _taipei_datetime(2026, 1, 2, 15, 0)
    calculator = PortfolioCalculator(
        _transactions(),
        ClockFixtureMarket(),
        benchmark_ticker="0050.TW",
        oversell_policy="ERROR",
        calculation_now=fixed,
    )

    snapshot = calculator.run()

    assert calculator.calculation_as_of == date(2026, 1, 2)
    assert snapshot.updated_at == "2026-01-02 15:00"
    assert snapshot.summary.market_stage == "CLOSED"
    assert snapshot.history[-1]["date"] == "2026-01-02"
    assert all(row["date"] <= "2026-01-02" for row in snapshot.history)


def test_calculator_normalizes_explicit_clock_to_taipei():
    utc_fixed = pytz.UTC.localize(datetime(2026, 1, 2, 7, 0))
    calculator = PortfolioCalculator(
        _transactions(),
        ClockFixtureMarket(),
        benchmark_ticker="0050.TW",
        oversell_policy="ERROR",
        calculation_now=utc_fixed,
    )

    snapshot = calculator.run()

    assert calculator.calculation_as_of == date(2026, 1, 2)
    assert snapshot.updated_at == "2026-01-02 15:00"
    assert snapshot.summary.market_stage == "CLOSED"


def test_calculator_rejects_naive_explicit_clock():
    with pytest.raises(ValueError, match="calculation_now must be timezone-aware"):
        PortfolioCalculator(
            _transactions(),
            ClockFixtureMarket(),
            benchmark_ticker="0050.TW",
            calculation_now=datetime(2026, 1, 2, 15, 0),
        )
