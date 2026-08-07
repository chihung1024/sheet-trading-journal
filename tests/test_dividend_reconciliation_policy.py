from datetime import date
from types import SimpleNamespace

import pandas as pd

from journal_engine.core.daily_pnl_reconciler import _symbol_component


class DividendMarket:
    def __init__(self, symbol, prices, dividend, fx):
        self.symbol = symbol
        self.prices = prices
        self.dividend = dividend
        self.fx_rates = pd.Series(
            [fx, fx],
            index=[pd.Timestamp("2026-08-04"), pd.Timestamp("2026-08-05")],
        )
        self.realtime_fx_rate = None

    def get_price_asof(self, symbol, value_date):
        key = pd.Timestamp(value_date).strftime("%Y-%m-%d")
        return float(self.prices[key]), pd.Timestamp(value_date)

    def get_dividend(self, symbol, value_date):
        key = pd.Timestamp(value_date).strftime("%Y-%m-%d")
        return float(self.dividend if key == "2026-08-05" else 0.0)

    def get_transaction_multiplier(self, symbol, value_date):
        return 1.0


class DividendCalculator:
    def __init__(self, market):
        self.market = market

    def _is_taiwan_stock(self, symbol):
        return symbol.endswith((".TW", ".TWO"))

    def _get_effective_fx_rate(self, symbol, fx_rate):
        return 1.0 if self._is_taiwan_stock(symbol) else float(fx_rate)

    def _get_asset_effective_price_and_fx(self, symbol, value_date, current_fx):
        price, _ = self.market.get_price_asof(symbol, value_date)
        return price, self._get_effective_fx_rate(symbol, self.market.fx_rates.asof(pd.Timestamp(value_date)))


def _transactions(symbol, qty, price):
    df = pd.DataFrame(
        [
            {
                "Date": "2026-08-04",
                "Symbol": symbol,
                "Type": "BUY",
                "Qty": qty,
                "Price": price,
                "Commission": 0.0,
                "Tax": 0.0,
                "Tag": "",
                "id": 1,
            }
        ]
    )
    df["Date"] = pd.to_datetime(df["Date"])
    return df


def test_canonical_reconciler_uses_zero_withholding_for_taiwan_pending_dividend():
    symbol = "2330.TW"
    market = DividendMarket(
        symbol,
        {"2026-08-04": 500.0, "2026-08-05": 500.0},
        dividend=2.0,
        fx=32.0,
    )
    component = _symbol_component(
        DividendCalculator(market),
        _transactions(symbol, qty=10, price=500),
        symbol,
        base_date=date(2026, 8, 5),
        prev_date=date(2026, 8, 4),
        confirmed_dividends=set(),
    )

    assert component.dividend_income_twd == 20.0
    assert component.total_pnl_twd == 20.0


def test_canonical_reconciler_preserves_us_30pct_withholding():
    symbol = "NVDA"
    market = DividendMarket(
        symbol,
        {"2026-08-04": 100.0, "2026-08-05": 100.0},
        dividend=1.0,
        fx=30.0,
    )
    component = _symbol_component(
        DividendCalculator(market),
        _transactions(symbol, qty=2, price=100),
        symbol,
        base_date=date(2026, 8, 5),
        prev_date=date(2026, 8, 4),
        confirmed_dividends=set(),
    )

    assert component.dividend_income_twd == 42.0
    assert component.total_pnl_twd == 42.0
