from collections import defaultdict
from unittest.mock import patch

import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient
from journal_engine.core.input_provenance import build_market_inputs_identity
from journal_engine.core.validator import PortfolioValidator


def _history(
    *,
    final_close=101.0,
    dividend=0.0,
    split=0.0,
    capital_gain=0.0,
    action_only=False,
    partial_price=False,
):
    event_date = pd.Timestamp("2026-08-11")
    frame = pd.DataFrame(
        {
            "Open": [99.0, 100.0],
            "High": [101.0, 102.0],
            "Low": [98.0, 99.5],
            "Close": [100.0, final_close],
            "Adj Close": [100.0, final_close],
            "Volume": [1000.0, 12345.0],
            "Dividends": [0.0, dividend],
            "Stock Splits": [0.0, split],
            "Capital Gains": [0.0, capital_gain],
        },
        index=pd.to_datetime(["2026-08-10", "2026-08-11"]),
    )

    if action_only:
        for column in ("Open", "High", "Low", "Close", "Adj Close"):
            frame.loc[event_date, column] = float("nan")
        frame.loc[event_date, "Volume"] = 0.0
    elif partial_price:
        frame.loc[event_date, "Close"] = float("nan")
        frame.loc[event_date, "Adj Close"] = float("nan")

    return frame


class FakeTicker:
    def __init__(self, daily_frame):
        self.daily_frame = daily_frame

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        return self.daily_frame.copy(deep=True)


class ExplodingTicker:
    def history(self, **kwargs):
        raise RuntimeError("simulated provider retry failure")


def _run_download(client, ticker_factory):
    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch("journal_engine.clients.market_data.time.sleep") as sleep:
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))
    return market_data, sleep


def test_persistent_dividend_action_only_row_becomes_explicit_asof_effective_valuation():
    client = SemanticMarketDataClient()
    action_only = _history(dividend=1.25, action_only=True)
    spy = _history(final_close=500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        return FakeTicker(action_only if symbol == "AAA" else spy)

    market_data, sleep = _run_download(client, ticker_factory)
    frame = market_data["AAA"]
    event_date = pd.Timestamp("2026-08-11")

    assert calls["AAA"] == 2
    assert calls["SPY"] == 1
    sleep.assert_called_once()
    assert frame.loc[event_date, "Close_Adjusted"] == 100.0
    assert pd.isna(frame.loc[event_date, "Close"])
    assert pd.isna(frame.loc[event_date, "Close_Raw"])
    assert frame.loc[event_date, "Dividends"] == 1.25
    assert frame.loc[event_date, "Stock Splits"] == 0.0
    assert frame.loc[event_date, "Valuation_Source"] == "asof_carry_forward"
    assert frame.loc[event_date, "Valuation_Source_Date"] == "2026-08-10"
    assert client.get_dividend("AAA", event_date) == 1.25
    assert PortfolioValidator.validate_price_data("AAA", frame) is True

    identity = build_market_inputs_identity(
        {"AAA": frame},
        required_symbols=["AAA"],
    )
    assert identity.synthetic_row_counts == {"asof_carry_forward": 1}


def test_persistent_split_action_only_row_remains_fail_closed():
    client = SemanticMarketDataClient()
    action_only = _history(split=2.0, action_only=True)
    spy = _history(final_close=500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        return FakeTicker(action_only if symbol == "AAA" else spy)

    market_data, sleep = _run_download(client, ticker_factory)
    frame = market_data["AAA"]
    before = pd.Timestamp("2026-08-10")
    event_date = pd.Timestamp("2026-08-11")

    assert calls["AAA"] == 2
    sleep.assert_called_once()
    assert pd.isna(frame.loc[event_date, "Close_Adjusted"])
    assert frame.loc[event_date, "Stock Splits"] == 2.0
    assert frame.loc[before, "Split_Factor"] == 2.0
    assert frame.loc[event_date, "Split_Factor"] == 1.0
    assert "Valuation_Source" not in frame.columns
    assert PortfolioValidator.validate_price_data("AAA", frame) is False


def test_partial_price_bar_remains_fail_closed_after_retry():
    client = SemanticMarketDataClient()
    malformed = _history(dividend=1.25, partial_price=True)
    spy = _history(final_close=500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        return FakeTicker(malformed if symbol == "AAA" else spy)

    market_data, sleep = _run_download(client, ticker_factory)
    frame = market_data["AAA"]

    assert calls["AAA"] == 2
    sleep.assert_called_once()
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert "Valuation_Source" not in frame.columns
    assert PortfolioValidator.validate_price_data("AAA", frame) is False


def test_action_semantics_must_be_stable_across_successful_refetches():
    client = SemanticMarketDataClient()
    first = _history(dividend=1.25, action_only=True)
    changed = _history(dividend=1.30, action_only=True)
    spy = _history(final_close=500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        call_index = calls[symbol]
        calls[symbol] += 1
        if symbol == "AAA":
            return FakeTicker(first if call_index == 0 else changed)
        return FakeTicker(spy)

    market_data, sleep = _run_download(client, ticker_factory)
    frame = market_data["AAA"]

    assert calls["AAA"] == 2
    sleep.assert_called_once()
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert frame.loc[pd.Timestamp("2026-08-11"), "Dividends"] == 1.30
    assert PortfolioValidator.validate_price_data("AAA", frame) is False


def test_failed_second_fetch_is_not_evidence_of_persistent_action_semantics():
    client = SemanticMarketDataClient()
    first = _history(dividend=1.25, action_only=True)
    spy = _history(final_close=500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        call_index = calls[symbol]
        calls[symbol] += 1
        if symbol == "AAA":
            return FakeTicker(first) if call_index == 0 else ExplodingTicker()
        return FakeTicker(spy)

    market_data, sleep = _run_download(client, ticker_factory)
    frame = market_data["AAA"]

    assert calls["AAA"] == 2
    sleep.assert_called_once()
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", frame) is False


def test_unmodeled_capital_gain_event_remains_fail_closed():
    client = SemanticMarketDataClient()
    unsupported = _history(capital_gain=0.75, action_only=True)
    spy = _history(final_close=500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        return FakeTicker(unsupported if symbol == "AAA" else spy)

    market_data, sleep = _run_download(client, ticker_factory)
    frame = market_data["AAA"]

    assert calls["AAA"] == 2
    sleep.assert_called_once()
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", frame) is False


def test_action_only_row_without_prior_valuation_remains_fail_closed():
    client = SemanticMarketDataClient()
    action_only = _history(dividend=1.25, action_only=True).iloc[1:].copy()
    spy = _history(final_close=500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        return FakeTicker(action_only if symbol == "AAA" else spy)

    market_data, sleep = _run_download(client, ticker_factory)
    frame = market_data["AAA"]

    assert calls["AAA"] == 2
    sleep.assert_called_once()
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", frame) is False
