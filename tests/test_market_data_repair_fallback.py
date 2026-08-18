from collections import defaultdict
from unittest.mock import patch

import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient
from journal_engine.core.validator import PortfolioValidator


def _malformed_history():
    return pd.DataFrame(
        {
            "Open": [99.0, 100.0],
            "High": [101.0, 102.0],
            "Low": [98.0, 99.5],
            "Close": [100.0, float("nan")],
            "Adj Close": [100.0, float("nan")],
            "Volume": [1000.0, 12345.0],
            "Dividends": [0.0, 0.0],
            "Stock Splits": [0.0, 0.0],
            "Capital Gains": [0.0, 0.0],
        },
        index=pd.to_datetime(["2026-08-10", "2026-08-11"]),
    )


def _valid_history(final_close=101.0):
    return pd.DataFrame(
        {
            "Open": [99.0, 100.0],
            "High": [101.0, max(102.0, final_close)],
            "Low": [98.0, min(99.5, final_close)],
            "Close": [100.0, final_close],
            "Adj Close": [100.0, final_close],
            "Volume": [1000.0, 12345.0],
            "Dividends": [0.0, 0.0],
            "Stock Splits": [0.0, 0.0],
            "Capital Gains": [0.0, 0.0],
        },
        index=pd.to_datetime(["2026-08-10", "2026-08-11"]),
    )


def _single_day_repaired(close):
    return pd.DataFrame(
        {
            "Open": [100.0],
            "High": [max(102.0, close)],
            "Low": [min(99.5, close)],
            "Close": [close],
            "Adj Close": [close],
            "Volume": [12345.0],
            "Dividends": [0.0],
            "Stock Splits": [0.0],
            "Capital Gains": [0.0],
        },
        index=pd.to_datetime(["2026-08-11"]),
    )


class StaticTicker:
    def __init__(self, frame):
        self.frame = frame

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        return self.frame.copy(deep=True)


class RepairRequiredTicker:
    def __init__(self, malformed, repaired):
        self.malformed = malformed
        self.repaired = repaired

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        if kwargs.get("repair") is True:
            # Repaired daily valuation must preserve the ordinary regular-session
            # Close contract while retaining malformed rows for explicit validation.
            assert kwargs.get("prepost") is False
            assert kwargs.get("keepna") is True
            return self.repaired.copy(deep=True)
        return self.malformed.copy(deep=True)


def _download(client, ticker_factory):
    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch("journal_engine.clients.market_data.time.sleep"):
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))
    return market_data


def test_persistent_daily_nan_uses_two_same_provider_repaired_observations():
    client = SemanticMarketDataClient()
    malformed = _malformed_history()
    repaired = _single_day_repaired(101.75)
    spy = _valid_history(500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        if symbol == "AAA":
            return RepairRequiredTicker(malformed, repaired)
        return StaticTicker(spy)

    market_data = _download(client, ticker_factory)
    frame = market_data["AAA"]
    event_date = pd.Timestamp("2026-08-11")

    # Two broad raw attempts must fail before the two repaired exact-date observations.
    assert calls["AAA"] == 4
    assert frame.loc[event_date, "Close"] == 101.75
    assert frame.loc[event_date, "Close_Adjusted"] == 101.75
    assert PortfolioValidator.validate_price_data("AAA", frame) is True
    assert "two exact-date same-provider repaired daily observations" in client.price_metadata_by_symbol["AAA"]["selection_reason"]


def test_repaired_daily_observations_must_still_be_identical():
    client = SemanticMarketDataClient()
    malformed = _malformed_history()
    repaired_first = _single_day_repaired(101.75)
    repaired_second = _single_day_repaired(101.80)
    spy = _valid_history(500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        call_index = calls[symbol]
        calls[symbol] += 1
        if symbol != "AAA":
            return StaticTicker(spy)
        repaired = repaired_first if call_index == 2 else repaired_second
        return RepairRequiredTicker(malformed, repaired)

    market_data = _download(client, ticker_factory)
    frame = market_data["AAA"]

    assert calls["AAA"] == 4
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", frame) is False
