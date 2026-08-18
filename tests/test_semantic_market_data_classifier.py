from unittest.mock import patch

import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient
from journal_engine.core.validator import PortfolioValidator


def _prepared_event_row(
    *,
    dividend=0.5,
    split=0.0,
    volume=0.0,
    capital_gain=None,
    split_factor=1.0,
    index=None,
):
    row = {
        "Open": [float("nan")],
        "High": [float("nan")],
        "Low": [float("nan")],
        "Close": [float("nan")],
        "Adj Close": [float("nan")],
        "Close_Adjusted": [float("nan")],
        "Volume": [volume],
        "Dividends": [dividend],
        "Stock Splits": [split],
        "Split_Factor": [split_factor],
    }
    if capital_gain is not None:
        row["Capital Gains"] = [capital_gain]
    return pd.DataFrame(
        row,
        index=index if index is not None else pd.to_datetime(["2026-08-11"]),
    )


def _prepared_two_row_event(*, existing_provenance=False):
    frame = pd.DataFrame(
        {
            "Open": [100.0, float("nan")],
            "High": [101.0, float("nan")],
            "Low": [99.0, float("nan")],
            "Close": [100.0, float("nan")],
            "Adj Close": [100.0, float("nan")],
            "Close_Adjusted": [100.0, float("nan")],
            "Volume": [1000.0, 0.0],
            "Dividends": [0.0, 0.5],
            "Stock Splits": [0.0, 0.0],
            "Split_Factor": [1.0, 1.0],
        },
        index=pd.to_datetime(["2026-08-10", "2026-08-11"]),
    )
    if existing_provenance:
        frame["Valuation_Source"] = ["market", "market"]
        frame["Valuation_Source_Date"] = ["2026-08-10", "2026-08-11"]
    return frame


def _prepared_partial_row(*, split=0.0, dividend=0.0, capital_gain=0.0, rows=2):
    dates = pd.date_range("2026-08-10", periods=rows, freq="D")
    frame = pd.DataFrame(
        {
            "Open": [100.0 + index for index in range(rows)],
            "High": [102.0 + index for index in range(rows)],
            "Low": [99.0 + index for index in range(rows)],
            "Close": [101.0 + index for index in range(rows)],
            "Adj Close": [101.0 + index for index in range(rows)],
            "Close_Adjusted": [101.0 + index for index in range(rows)],
            "Volume": [1000.0 + index for index in range(rows)],
            "Dividends": [0.0 for _ in range(rows)],
            "Stock Splits": [0.0 for _ in range(rows)],
            "Capital Gains": [0.0 for _ in range(rows)],
            "Split_Factor": [1.0 for _ in range(rows)],
        },
        index=dates,
    )
    event_date = dates[-1]
    frame.loc[event_date, "Close"] = float("nan")
    frame.loc[event_date, "Adj Close"] = float("nan")
    frame.loc[event_date, "Close_Adjusted"] = float("nan")
    frame.loc[event_date, "Dividends"] = dividend
    frame.loc[event_date, "Stock Splits"] = split
    frame.loc[event_date, "Capital Gains"] = capital_gain
    return frame


def _daily_action_row(*, capital_gain=0.0):
    return pd.Series(
        {
            "Open": 101.0,
            "High": 103.0,
            "Low": 100.0,
            "Close": float("nan"),
            "Adj Close": float("nan"),
            "Volume": 1200.0,
            "Dividends": 0.0,
            "Stock Splits": 0.0,
            "Capital Gains": capital_gain,
        }
    )


def _intraday_row(
    *,
    date="2026-08-11",
    open_price=101.0,
    final_close=102.0,
    first_high=103.0,
    first_low=100.0,
    second_high=103.0,
    second_low=101.0,
    tz="America/New_York",
):
    index = pd.DatetimeIndex(
        [f"{date} 09:30:00", f"{date} 10:30:00"],
        tz=tz,
    )
    return pd.DataFrame(
        {
            "Open": [open_price, 102.0],
            "High": [first_high, second_high],
            "Low": [first_low, second_low],
            "Close": [102.0, final_close],
            "Adj Close": [102.0, final_close],
            "Volume": [600.0, 600.0],
        },
        index=index,
    )


class _Ticker:
    def __init__(self, frame=None, error=None):
        self.frame = frame
        self.error = error

    def history(self, **_kwargs):
        if self.error is not None:
            raise self.error
        return self.frame.copy(deep=True)


def test_classifier_rejects_absent_or_incomplete_frames():
    assert SemanticMarketDataClient._dividend_action_only_signature(None) is None
    assert SemanticMarketDataClient._dividend_action_only_signature(pd.DataFrame()) is None
    assert SemanticMarketDataClient._dividend_action_only_signature(pd.DataFrame({"Close": [1.0]})) is None


def test_classifier_accepts_nan_volume_and_absent_optional_capital_gain():
    frame = _prepared_event_row(volume=float("nan"))
    assert SemanticMarketDataClient._dividend_action_only_signature(frame) == (
        (pd.Timestamp("2026-08-11"), 0.5, 0.0, 1.0),
    )


def test_classifier_requires_all_semantic_input_columns():
    assert SemanticMarketDataClient._dividend_action_only_signature(
        _prepared_event_row().drop(columns=["Volume"])
    ) is None


def test_classifier_rejects_mixed_partial_price_bar():
    frame = _prepared_event_row()
    frame.loc[frame.index[0], "Open"] = 100.0
    assert SemanticMarketDataClient._dividend_action_only_signature(frame) is None


def test_classifier_rejects_nonzero_or_nonfinite_volume():
    assert SemanticMarketDataClient._dividend_action_only_signature(_prepared_event_row(volume=1.0)) is None
    assert SemanticMarketDataClient._dividend_action_only_signature(
        _prepared_event_row(volume=float("inf"))
    ) is None


def test_classifier_requires_positive_finite_dividend():
    for dividend in (0.0, -0.1, "not-a-number"):
        assert SemanticMarketDataClient._dividend_action_only_signature(
            _prepared_event_row(dividend=dividend)
        ) is None


def test_classifier_rejects_any_nonzero_split_even_with_valid_dividend():
    for split in (2.0, -2.0):
        assert SemanticMarketDataClient._dividend_action_only_signature(
            _prepared_event_row(dividend=0.5, split=split)
        ) is None


def test_classifier_requires_positive_finite_split_factor():
    for factor in (0.0, "not-a-number"):
        assert SemanticMarketDataClient._dividend_action_only_signature(
            _prepared_event_row(split_factor=factor)
        ) is None


def test_classifier_rejects_malformed_or_material_capital_gain():
    for gain in ("not-a-number", 0.75):
        assert SemanticMarketDataClient._dividend_action_only_signature(
            _prepared_event_row(capital_gain=gain)
        ) is None


def test_classifier_rejects_nat_event_date():
    assert SemanticMarketDataClient._dividend_action_only_signature(
        _prepared_event_row(index=pd.DatetimeIndex([pd.NaT]))
    ) is None


def test_classifier_normalizes_timezone_aware_event_date():
    frame = _prepared_event_row(
        index=pd.DatetimeIndex([pd.Timestamp("2026-08-11", tz="America/New_York")])
    )
    assert SemanticMarketDataClient._dividend_action_only_signature(frame) == (
        (pd.Timestamp("2026-08-11"), 0.5, 0.0, 1.0),
    )


def test_classifier_no_invalid_selected_price_rows_returns_empty_signature():
    frame = _prepared_event_row()
    frame.loc[frame.index[0], "Close_Adjusted"] = 100.0
    assert SemanticMarketDataClient._dividend_action_only_signature(frame) == ()


def test_materializer_revalidates_signature_before_mutating():
    frame = _prepared_two_row_event()
    wrong_signature = ((pd.Timestamp("2026-08-12"), 0.5, 0.0, 1.0),)
    result, applied = SemanticMarketDataClient._materialize_action_only_asof_valuations(
        frame, wrong_signature
    )
    assert applied is False
    assert result is frame
    assert pd.isna(result.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"])


def test_materializer_respects_existing_provenance_columns():
    frame = _prepared_two_row_event(existing_provenance=True)
    signature = SemanticMarketDataClient._dividend_action_only_signature(frame)
    result, applied = SemanticMarketDataClient._materialize_action_only_asof_valuations(
        frame, signature
    )
    assert applied is True
    assert result.loc[pd.Timestamp("2026-08-10"), "Valuation_Source"] == "market"
    assert result.loc[pd.Timestamp("2026-08-10"), "Valuation_Source_Date"] == "2026-08-10"
    assert result.loc[pd.Timestamp("2026-08-11"), "Valuation_Source"] == "asof_carry_forward"
    assert result.loc[pd.Timestamp("2026-08-11"), "Valuation_Source_Date"] == "2026-08-10"


def test_recovery_scalar_and_date_helpers_fail_closed_and_normalize_timezone():
    assert SemanticMarketDataClient._finite_number("bad") is None
    assert SemanticMarketDataClient._finite_number(float("inf")) is None
    assert SemanticMarketDataClient._finite_number("12.5") == 12.5
    assert SemanticMarketDataClient._normalize_date("bad-date") is None
    assert SemanticMarketDataClient._normalize_date(pd.NaT) is None
    assert SemanticMarketDataClient._normalize_date(
        pd.Timestamp("2026-08-11 13:00", tz="Asia/Taipei")
    ) == pd.Timestamp("2026-08-11")


def test_recovery_action_signature_requires_complete_finite_actions():
    valid = _daily_action_row()
    assert SemanticMarketDataClient._action_signature_from_row(valid) == (0.0, 0.0, 0.0)
    assert SemanticMarketDataClient._action_signature_from_row(valid.drop(labels=["Dividends"])) is None
    malformed_split = valid.copy()
    malformed_split["Stock Splits"] = "bad"
    assert SemanticMarketDataClient._action_signature_from_row(malformed_split) is None
    malformed_gain = valid.copy()
    malformed_gain["Capital Gains"] = float("inf")
    assert SemanticMarketDataClient._action_signature_from_row(malformed_gain) is None


def test_intraday_candidate_rejects_absent_empty_naive_wrong_date_and_duplicates():
    event_date = pd.Timestamp("2026-08-11")
    assert SemanticMarketDataClient._complete_intraday_price_candidate(None, event_date) is None
    assert SemanticMarketDataClient._complete_intraday_price_candidate(
        pd.DataFrame(), event_date
    ) is None

    naive = _intraday_row()
    naive.index = naive.index.tz_localize(None)
    assert SemanticMarketDataClient._complete_intraday_price_candidate(naive, event_date) is None
    assert SemanticMarketDataClient._complete_intraday_price_candidate(
        _intraday_row(date="2026-08-12"), event_date
    ) is None

    duplicate = _intraday_row()
    duplicate.index = pd.DatetimeIndex([duplicate.index[0], duplicate.index[0]])
    assert SemanticMarketDataClient._complete_intraday_price_candidate(
        duplicate, event_date
    ) is None


def test_intraday_candidate_requires_multiple_complete_structurally_valid_price_bars():
    event_date = pd.Timestamp("2026-08-11")

    single = _intraday_row().iloc[[0]]
    assert SemanticMarketDataClient._complete_intraday_price_candidate(single, event_date) is None

    for column in ("Open", "High", "Low", "Close", "Adj Close"):
        missing = _intraday_row().drop(columns=[column])
        assert SemanticMarketDataClient._complete_intraday_price_candidate(
            missing, event_date
        ) is None

    nonpositive = _intraday_row(final_close=0.0)
    impossible_high = _intraday_row(open_price=104.0, first_high=103.0)
    impossible_low = _intraday_row(final_close=100.5, second_low=101.0)
    adjusted_mismatch = _intraday_row()
    adjusted_mismatch.loc[adjusted_mismatch.index[-1], "Adj Close"] = 101.5
    for frame in (nonpositive, impossible_high, impossible_low, adjusted_mismatch):
        assert SemanticMarketDataClient._complete_intraday_price_candidate(
            frame, event_date
        ) is None


def test_intraday_candidate_ignores_fully_empty_keepna_bucket_but_rejects_partial_bucket():
    event_date = pd.Timestamp("2026-08-11")
    frame = _intraday_row()
    empty = pd.DataFrame(
        {column: [float("nan")] for column in ("Open", "High", "Low", "Close", "Adj Close", "Volume")},
        index=pd.DatetimeIndex(["2026-08-11 10:00:00"], tz="America/New_York"),
    )
    with_empty = pd.concat([frame.iloc[[0]], empty, frame.iloc[[1]]]).sort_index()
    assert SemanticMarketDataClient._complete_intraday_price_candidate(
        with_empty, event_date
    ) is not None

    partial = with_empty.copy(deep=True)
    partial.loc[pd.Timestamp("2026-08-11 10:00:00", tz="America/New_York"), "Open"] = 101.25
    assert SemanticMarketDataClient._complete_intraday_price_candidate(
        partial, event_date
    ) is None


def test_cross_granularity_price_candidates_require_all_fields_and_agreement():
    values = {
        "Open": 101.0,
        "High": 103.0,
        "Low": 100.0,
        "Close": 102.0,
        "Adj Close": 102.0,
    }
    assert SemanticMarketDataClient._intraday_price_candidates_agree(values, dict(values)) is True

    missing = dict(values)
    missing.pop("Adj Close")
    assert SemanticMarketDataClient._intraday_price_candidates_agree(values, missing) is False

    different = dict(values)
    different["Low"] = 99.5
    assert SemanticMarketDataClient._intraday_price_candidates_agree(values, different) is False


def test_intraday_candidate_accepts_timezone_aware_stable_price_sequence():
    event_date = pd.Timestamp("2026-08-11")
    candidate = SemanticMarketDataClient._complete_intraday_price_candidate(
        _intraday_row(), event_date
    )
    assert candidate is not None
    values, signature = candidate
    assert values == {
        "Open": 101.0,
        "High": 103.0,
        "Low": 100.0,
        "Close": 102.0,
        "Adj Close": 102.0,
    }
    assert len(signature) == 2
    assert "-04:00" in signature[0][0]


def test_exact_date_intraday_recovery_noops_without_selected_nan_or_required_shape():
    client = SemanticMarketDataClient()
    valid = _prepared_partial_row()
    valid.loc[valid.index[-1], "Close"] = 102.0
    valid.loc[valid.index[-1], "Adj Close"] = 102.0
    valid.loc[valid.index[-1], "Close_Adjusted"] = 102.0

    result, dates = client._recover_with_exact_date_intraday_evidence("AAA", valid)
    assert result is valid
    assert dates == ()

    result, dates = client._recover_with_exact_date_intraday_evidence("AAA", pd.DataFrame())
    assert result.empty
    assert dates == ()


def test_exact_date_intraday_recovery_bounds_many_invalid_rows_and_rejects_invalid_index():
    client = SemanticMarketDataClient()
    too_many = _prepared_partial_row(rows=6)
    too_many["Close_Adjusted"] = float("nan")
    result, dates = client._recover_with_exact_date_intraday_evidence("AAA", too_many)
    assert result is too_many
    assert dates == ()

    malformed_index = _prepared_partial_row()
    malformed_index.index = pd.DatetimeIndex([pd.Timestamp("2026-08-10"), pd.NaT])
    result, dates = client._recover_with_exact_date_intraday_evidence("AAA", malformed_index)
    assert result is malformed_index
    assert dates == ()


def test_exact_date_intraday_recovery_rejects_missing_or_nonzero_daily_action_evidence():
    client = SemanticMarketDataClient()
    missing = _prepared_partial_row().drop(columns=["Dividends"])
    result, dates = client._recover_with_exact_date_intraday_evidence("AAA", missing)
    assert result is missing
    assert dates == ()

    split = _prepared_partial_row(split=2.0)
    with patch("journal_engine.clients.semantic_market_data.yf.Ticker") as ticker:
        result, dates = client._recover_with_exact_date_intraday_evidence("AAA", split)
    assert result is split
    assert dates == ()
    ticker.assert_not_called()


def test_exact_date_intraday_recovery_rejects_provider_exception():
    client = SemanticMarketDataClient()
    frame = _prepared_partial_row()
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        return_value=_Ticker(error=RuntimeError("provider unavailable")),
    ):
        result, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)
    assert result is frame
    assert dates == ()


def test_exact_date_intraday_recovery_rejects_disagreeing_granularities():
    client = SemanticMarketDataClient()
    frame = _prepared_partial_row()
    tickers = iter(
        [
            _Ticker(_intraday_row(final_close=102.0)),
            _Ticker(_intraday_row(final_close=102.5)),
            _Ticker(pd.DataFrame()),
        ]
    )
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        side_effect=lambda _symbol: next(tickers),
    ):
        result, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)
    assert result is frame
    assert dates == ()


def test_exact_date_intraday_recovery_never_recomputes_split_factor_from_intraday_prices():
    client = SemanticMarketDataClient()
    frame = _prepared_partial_row(split=2.0)
    before = frame["Split_Factor"].copy(deep=True)
    with patch("journal_engine.clients.semantic_market_data.yf.Ticker") as ticker:
        recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)
    assert recovered is frame
    assert dates == ()
    assert recovered["Split_Factor"].equals(before)
    ticker.assert_not_called()
    assert PortfolioValidator.validate_price_data("AAA", recovered) is False


def test_exact_date_intraday_recovery_preserves_existing_market_provenance_columns():
    client = SemanticMarketDataClient()
    frame = _prepared_partial_row()
    frame["Valuation_Source"] = ["market", "asof_carry_forward"]
    frame["Valuation_Source_Date"] = ["2026-08-10", "2026-08-10"]
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        return_value=_Ticker(_intraday_row()),
    ):
        recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Valuation_Source"] == "market"
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Valuation_Source_Date"] == "2026-08-11"
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.0



def test_exact_date_intraday_recovery_stops_when_quorum_becomes_impossible():
    client = SemanticMarketDataClient()
    frame = _prepared_partial_row()
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        return_value=_Ticker(pd.DataFrame()),
    ) as ticker:
        result, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)

    assert result is frame
    assert dates == ()
    assert ticker.call_count == 2
