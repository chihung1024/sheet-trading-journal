from unittest.mock import patch

import pandas as pd

from journal_engine.clients.market_data import MarketDataClient
from journal_engine.clients.semantic_market_data import SemanticMarketDataClient


def _partial_frame(*, include_capital_gain=True, tz=None):
    index = pd.DatetimeIndex([pd.Timestamp("2026-08-10"), pd.Timestamp("2026-08-11")])
    if tz:
        index = index.tz_localize(tz)
    data = {
        "Open": [100.0, 101.0],
        "High": [102.0, 103.0],
        "Low": [99.0, 100.0],
        "Close": [101.0, float("nan")],
        "Adj Close": [101.0, float("nan")],
        "Close_Adjusted": [101.0, float("nan")],
        "Close_Raw": [101.0, float("nan")],
        "Volume": [1000.0, 1200.0],
        "Dividends": [0.0, 0.0],
        "Stock Splits": [0.0, 0.0],
        "Split_Factor": [1.0, 1.0],
        "Dividend_Adj_Factor": [1.0, 1.0],
    }
    if include_capital_gain:
        data["Capital Gains"] = [0.0, 0.0]
    return pd.DataFrame(data, index=index)


def _intraday(*, adj_close=102.0):
    return pd.DataFrame(
        {
            "Open": [101.0, 102.0],
            "High": [103.0, 103.0],
            "Low": [100.0, 101.0],
            "Close": [102.0, 102.0],
            "Adj Close": [102.0, adj_close],
            "Volume": [600.0, 600.0],
        },
        index=pd.DatetimeIndex(
            ["2026-08-11 09:30:00", "2026-08-11 10:30:00"],
            tz="America/New_York",
        ),
    )


class _Ticker:
    def __init__(self, frame):
        self.frame = frame

    def history(self, **_kwargs):
        return self.frame.copy(deep=True)


def test_action_signature_accepts_absent_optional_capital_gain():
    row = _partial_frame(include_capital_gain=False).iloc[-1]
    assert SemanticMarketDataClient._action_signature_from_row(row) == (0.0, 0.0, 0.0)


def test_intraday_candidate_rejects_nonpositive_adjusted_close():
    event_date = pd.Timestamp("2026-08-11")
    assert SemanticMarketDataClient._complete_intraday_price_candidate(
        _intraday(adj_close=0.0), event_date
    ) is None


def test_recovery_normalizes_timezone_aware_broad_index():
    client = SemanticMarketDataClient()
    frame = _partial_frame(tz="Asia/Taipei")
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        return_value=_Ticker(_intraday()),
    ):
        recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert recovered.index.tz is None
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.0


def test_recovery_rejects_duplicate_provider_date_before_mutation():
    client = SemanticMarketDataClient()
    row = _partial_frame().iloc[[-1]].copy()
    frame = pd.concat([_partial_frame().iloc[[-2]], row, row])
    result, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)
    assert result is frame
    assert dates == ()


def test_recovery_succeeds_when_optional_capital_gain_column_is_absent():
    client = SemanticMarketDataClient()
    frame = _partial_frame(include_capital_gain=False)
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        return_value=_Ticker(_intraday()),
    ):
        recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert "Capital Gains" not in recovered.columns
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.0


def test_recovery_rejects_when_canonical_rebuild_still_has_selected_nan():
    client = SemanticMarketDataClient()
    frame = _partial_frame()
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        return_value=_Ticker(_intraday()),
    ), patch.object(
        MarketDataClient,
        "_prepare_data",
        autospec=True,
        return_value=frame,
    ):
        recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)

    assert recovered is frame
    assert dates == ()


def test_download_rejects_dividend_fallback_when_retry_price_sources_disagree():
    client = SemanticMarketDataClient()
    frame = _partial_frame()
    signature = ((pd.Timestamp("2026-08-11"), 0.5, 0.0, 1.0),)

    def fake_base_download(instance, _tickers, _start_date):
        instance.market_data = {"AAA": frame}
        instance._invalid_attempt_evidence = {
            "AAA": [
                {"signature": signature, "price_source": "Close"},
                {"signature": signature, "price_source": "Adj Close"},
            ]
        }
        return instance.market_data, pd.Series(dtype=float)

    with patch.object(
        MarketDataClient,
        "download_data",
        autospec=True,
        side_effect=fake_base_download,
    ), patch.object(
        SemanticMarketDataClient,
        "_recover_with_exact_date_intraday_evidence",
        return_value=(frame, ()),
    ):
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))

    assert market_data["AAA"] is frame
    assert market_data["AAA"]["Close_Adjusted"].isna().sum() == 1


def test_download_accepts_recovery_even_when_optional_metadata_is_empty():
    client = SemanticMarketDataClient()
    frame = _partial_frame()
    recovered = frame.copy(deep=True)
    recovered.loc[pd.Timestamp("2026-08-11"), "Close"] = 102.0
    recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] = 102.0
    recovered.attrs.clear()

    def fake_base_download(instance, _tickers, _start_date):
        instance.market_data = {"AAA": frame}
        return instance.market_data, pd.Series(dtype=float)

    with patch.object(
        MarketDataClient,
        "download_data",
        autospec=True,
        side_effect=fake_base_download,
    ), patch.object(
        SemanticMarketDataClient,
        "_recover_with_exact_date_intraday_evidence",
        return_value=(recovered, (pd.Timestamp("2026-08-11"),)),
    ):
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))

    assert market_data["AAA"] is recovered
    assert "AAA" not in client.price_metadata_by_symbol
