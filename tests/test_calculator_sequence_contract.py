import pandas as pd
import pytest

from journal_engine.core.calculator import PortfolioCalculator


class SequenceContractMarketDataClient:
    """Minimal market client for same-day calculator ordering regressions."""

    def __init__(self):
        self.realtime_fx_rate = 32.0
        self.fx_rates = pd.Series(
            [32.0, 32.0],
            index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
        )
        self.market_data = {}
        for symbol in ("SPY", "AAA"):
            frame = pd.DataFrame(
                [
                    {"Date": "2026-01-01", "Close_Adjusted": 100.0, "Dividends": 0.0},
                    {"Date": "2026-01-02", "Close_Adjusted": 100.0, "Dividends": 0.0},
                ]
            )
            frame["Date"] = pd.to_datetime(frame["Date"])
            frame = frame.set_index("Date").sort_index()
            frame["Split_Factor"] = 1.0
            self.market_data[symbol] = frame

    def get_price(self, symbol, value_date):
        price, _ = self.get_price_asof(symbol, value_date)
        return price

    def get_price_asof(self, symbol, value_date):
        value_date = pd.Timestamp(value_date).normalize()
        frame = self.market_data[symbol]
        if value_date in frame.index:
            return float(frame.loc[value_date, "Close_Adjusted"]), value_date
        pos = frame.index.get_indexer([value_date], method="pad")[0]
        if pos == -1:
            return 0.0, value_date
        used = frame.index[pos]
        return float(frame.iloc[pos]["Close_Adjusted"]), used

    def get_prev_trading_date(self, symbol, used_date):
        used_date = pd.Timestamp(used_date).normalize()
        idx = self.market_data[symbol].index
        pos = idx.get_indexer([used_date])[0]
        return idx[pos - 1] if pos > 0 else used_date

    def get_transaction_multiplier(self, symbol, value_date):
        return 1.0

    def get_dividend(self, symbol, value_date):
        value_date = pd.Timestamp(value_date).normalize()
        frame = self.market_data[symbol]
        if value_date in frame.index:
            return float(frame.loc[value_date, "Dividends"])
        return 0.0


def _transactions(sequence_column):
    rows = [
        {
            "Date": "2026-01-02",
            "Symbol": "AAA",
            "Type": "SELL",
            "Qty": 5.0,
            "Price": 100.0,
            "Commission": 0.0,
            "Tax": 0.0,
            "Tag": "",
            sequence_column: 1,
        },
        {
            "Date": "2026-01-02",
            "Symbol": "AAA",
            "Type": "BUY",
            "Qty": 5.0,
            "Price": 100.0,
            "Commission": 0.0,
            "Tax": 0.0,
            "Tag": "",
            sequence_column: 2,
        },
    ]
    frame = pd.DataFrame(rows)
    frame["Date"] = pd.to_datetime(frame["Date"])
    return frame


def test_sequence_column_precedes_same_day_type_priority():
    """Public `Sequence` must be honored before BUY/DIV/SELL fallback priority.

    Sequence explicitly orders SELL before BUY. In ERROR mode that must surface an
    oversell. If Sequence were ignored, fallback BUY-before-SELL ordering would
    hide the oversell and this regression would fail.
    """

    calculator = PortfolioCalculator(
        _transactions("Sequence"),
        SequenceContractMarketDataClient(),
        oversell_policy="ERROR",
    )

    with pytest.raises(ValueError, match="Oversell"):
        calculator.run()


def test_private_sequence_column_does_not_change_financial_order():
    """Historical `_sequence` is not a supported calculator ordering contract.

    With no recognized Timestamp/Sequence column, the calculator must retain its
    current stable fallback priority (BUY -> DIV -> SELL). The same rows therefore
    complete without an oversell and end flat.
    """

    calculator = PortfolioCalculator(
        _transactions("_sequence"),
        SequenceContractMarketDataClient(),
        oversell_policy="ERROR",
    )

    snapshot = calculator.run()

    assert snapshot.holdings == []
