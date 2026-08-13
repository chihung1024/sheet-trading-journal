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


def _narrow_daily_row(
    *,
    date="2026-08-11",
    open_price=100.0,
    high=103.0,
    low=99.0,
    close=102.0,
    volume=1234.0,
    dividend=0.0,
    split=0.0,
    capital_gain=0.0,
    include_adj_close=True,
):
    data = {
        "Open": [open_price],
        "High": [high],
        "Low": [low],
        "Close": [close],
        "Volume": [volume],
        "Dividends": [dividend],
        "Stock Splits": [split],
        "Capital Gains": [capital_gain],
    }
    if include_adj_close:
        data["Adj Close"] = [close]
    return pd.DataFrame(data, index=pd.to_datetime([date]))


class _Ticker:
    def __init__(self, frame=None, error=None):
        self.frame = frame
        self.error = error

    def history(self, **_kwargs):
        if self.error is not None:
            raise self.error
        return self.frame.copy(deep=True)


def test_classifier_rejects_absent_or_incomplete_frames():
    assert SemanticMarketDataClient._pure_action_only_signature(None) is None
    assert SemanticMarketDataClient._pure_action_only_signature(pd.DataFrame()) is None
    assert SemanticMarketDataClient._pure_action_only_signature(
        pd.DataFrame({"Close": [1.0]})
    ) is None


def test_classifier_accepts_nan_volume_and_absent_optional_capital_gain():
    frame = _prepared_event_row(volume=float("nan"))

    signature = SemanticMarketDataClient._pure_action_only_signature(frame)

    assert signature == ((pd.Timestamp("2026-08-11"), 0.5, 0.0, 1.0),)


def test_classifier_requires_all_semantic_input_columns():
    frame = _prepared_event_row().drop(columns=["Volume"])

    assert SemanticMarketDataClient._pure_action_only_signature(frame) is None


def test_classifier_rejects_mixed_partial_price_bar():
    frame = _prepared_event_row()
    frame.loc[frame.index[0], "Open"] = 100.0

    assert SemanticMarketDataClient._pure_action_only_signature(frame) is None


def test_classifier_rejects_nonzero_or_nonfinite_volume():
    nonzero = _prepared_event_row(volume=1.0)
    nonfinite = _prepared_event_row(volume=float("inf"))

    assert SemanticMarketDataClient._pure_action_only_signature(nonzero) is None
    assert SemanticMarketDataClient._pure_action_only_signature(nonfinite) is None


def test_classifier_requires_positive_finite_dividend():
    zero = _prepared_event_row(dividend=0.0)
    negative = _prepared_event_row(dividend=-0.1)
    malformed = _prepared_event_row(dividend="not-a-number")

    assert SemanticMarketDataClient._pure_action_only_signature(zero) is None
    assert SemanticMarketDataClient._pure_action_only_signature(negative) is None
    assert SemanticMarketDataClient._pure_action_only_signature(malformed) is None


def test_classifier_rejects_any_nonzero_split_even_with_valid_dividend():
    positive_split = _prepared_event_row(dividend=0.5, split=2.0)
    negative_split = _prepared_event_row(dividend=0.5, split=-2.0)

    assert SemanticMarketDataClient._pure_action_only_signature(positive_split) is None
    assert SemanticMarketDataClient._pure_action_only_signature(negative_split) is None


def test_classifier_requires_positive_finite_split_factor():
    zero = _prepared_event_row(split_factor=0.0)
    malformed = _prepared_event_row(split_factor="not-a-number")

    assert SemanticMarketDataClient._pure_action_only_signature(zero) is None
    assert SemanticMarketDataClient._pure_action_only_signature(malformed) is None


def test_classifier_rejects_malformed_or_material_capital_gain():
    malformed = _prepared_event_row(capital_gain="not-a-number")
    material = _prepared_event_row(capital_gain=0.75)

    assert SemanticMarketDataClient._pure_action_only_signature(malformed) is None
    assert SemanticMarketDataClient._pure_action_only_signature(material) is None


def test_classifier_rejects_nat_event_date():
    frame = _prepared_event_row(index=pd.DatetimeIndex([pd.NaT]))

    assert SemanticMarketDataClient._pure_action_only_signature(frame) is None


def test_classifier_normalizes_timezone_aware_event_date():
    frame = _prepared_event_row(
        index=pd.DatetimeIndex([pd.Timestamp("2026-08-11", tz="America/New_York")])
    )

    signature = SemanticMarketDataClient._pure_action_only_signature(frame)

    assert signature == ((pd.Timestamp("2026-08-11"), 0.5, 0.0, 1.0),)


def test_classifier_no_invalid_selected_price_rows_returns_empty_signature():
    frame = _prepared_event_row()
    frame.loc[frame.index[0], "Close_Adjusted"] = 100.0

    assert SemanticMarketDataClient._pure_action_only_signature(frame) == ()


def test_materializer_revalidates_signature_before_mutating():
    frame = _prepared_two_row_event()
    wrong_signature = ((pd.Timestamp("2026-08-12"), 0.5, 0.0, 1.0),)

    result, applied = SemanticMarketDataClient._materialize_action_only_asof_valuations(
        frame,
        wrong_signature,
    )

    assert applied is False
    assert result is frame
    assert pd.isna(result.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"])


def test_materializer_respects_existing_provenance_columns():
    frame = _prepared_two_row_event(existing_provenance=True)
    signature = SemanticMarketDataClient._pure_action_only_signature(frame)

    result, applied = SemanticMarketDataClient._materialize_action_only_asof_valuations(
        frame,
        signature,
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
    valid = _narrow_daily_row().iloc[0]
    assert SemanticMarketDataClient._action_signature_from_row(valid) == (0.0, 0.0, 0.0)

    assert SemanticMarketDataClient._action_signature_from_row(valid.drop(labels=["Dividends"])) is None
    malformed_split = valid.copy()
    malformed_split["Stock Splits"] = "bad"
    assert SemanticMarketDataClient._action_signature_from_row(malformed_split) is None
    malformed_gain = valid.copy()
    malformed_gain["Capital Gains"] = float("inf")
    assert SemanticMarketDataClient._action_signature_from_row(malformed_gain) is None


def test_complete_narrow_candidate_rejects_absent_wrong_date_and_duplicate_rows():
    event_date = pd.Timestamp("2026-08-11")
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(None, event_date) is None
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(pd.DataFrame(), event_date) is None
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(
        _narrow_daily_row(date="2026-08-12"), event_date
    ) is None
    duplicate = pd.concat([_narrow_daily_row(), _narrow_daily_row()])
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(duplicate, event_date) is None


def test_complete_narrow_candidate_rejects_invalid_index_and_missing_price_fields():
    event_date = pd.Timestamp("2026-08-11")
    bad_index = _narrow_daily_row()
    bad_index.index = pd.DatetimeIndex([pd.NaT])
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(bad_index, event_date) is None

    for column in ("Open", "High", "Low", "Close"):
        missing = _narrow_daily_row().drop(columns=[column])
        assert SemanticMarketDataClient._complete_narrow_daily_candidate(missing, event_date) is None

    nonpositive = _narrow_daily_row(close=0.0)
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(nonpositive, event_date) is None


def test_complete_narrow_candidate_rejects_impossible_ohlc_and_bad_volume():
    event_date = pd.Timestamp("2026-08-11")
    impossible_high = _narrow_daily_row(open_price=105.0, high=104.0, low=99.0, close=102.0)
    impossible_low = _narrow_daily_row(open_price=100.0, high=103.0, low=101.0, close=100.5)
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(impossible_high, event_date) is None
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(impossible_low, event_date) is None

    missing_volume = _narrow_daily_row().drop(columns=["Volume"])
    negative_volume = _narrow_daily_row(volume=-1.0)
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(missing_volume, event_date) is None
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(negative_volume, event_date) is None


def test_complete_narrow_candidate_requires_action_and_adjusted_price_integrity():
    event_date = pd.Timestamp("2026-08-11")
    missing_action = _narrow_daily_row().drop(columns=["Dividends"])
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(missing_action, event_date) is None

    bad_adjusted = _narrow_daily_row()
    bad_adjusted.loc[event_date, "Adj Close"] = float("nan")
    assert SemanticMarketDataClient._complete_narrow_daily_candidate(bad_adjusted, event_date) is None

    without_adjusted = _narrow_daily_row(include_adj_close=False)
    values, signature = SemanticMarketDataClient._complete_narrow_daily_candidate(
        without_adjusted, event_date
    )
    assert values["Close"] == 102.0
    assert "Adj Close" not in values
    assert signature


def test_complete_narrow_candidate_normalizes_timezone_aware_index():
    frame = _narrow_daily_row()
    frame.index = pd.DatetimeIndex([pd.Timestamp("2026-08-11", tz="Asia/Taipei")])
    candidate = SemanticMarketDataClient._complete_narrow_daily_candidate(
        frame, pd.Timestamp("2026-08-11")
    )
    assert candidate is not None


def test_exact_date_recovery_noops_without_selected_nan_or_required_frame_shape():
    client = SemanticMarketDataClient()
    valid = _prepared_partial_row()
    valid.loc[valid.index[-1], "Close"] = 102.0
    valid.loc[valid.index[-1], "Adj Close"] = 102.0
    valid.loc[valid.index[-1], "Close_Adjusted"] = 102.0

    result, dates = client._recover_with_exact_date_daily_evidence("AAA", valid)
    assert result is valid
    assert dates == ()

    result, dates = client._recover_with_exact_date_daily_evidence("AAA", pd.DataFrame())
    assert result.empty
    assert dates == ()


def test_exact_date_recovery_bounds_many_invalid_rows_and_rejects_invalid_index():
    client = SemanticMarketDataClient()
    too_many = _prepared_partial_row(rows=6)
    too_many["Close_Adjusted"] = float("nan")
    result, dates = client._recover_with_exact_date_daily_evidence("AAA", too_many)
    assert result is too_many
    assert dates == ()

    malformed_index = _prepared_partial_row()
    malformed_index.index = pd.DatetimeIndex([pd.Timestamp("2026-08-10"), pd.NaT])
    result, dates = client._recover_with_exact_date_daily_evidence("AAA", malformed_index)
    assert result is malformed_index
    assert dates == ()


def test_exact_date_recovery_rejects_missing_original_action_evidence():
    client = SemanticMarketDataClient()
    frame = _prepared_partial_row().drop(columns=["Dividends"])
    result, dates = client._recover_with_exact_date_daily_evidence("AAA", frame)
    assert result is frame
    assert dates == ()


def test_exact_date_recovery_rejects_provider_exception():
    client = SemanticMarketDataClient()
    frame = _prepared_partial_row()
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        return_value=_Ticker(error=RuntimeError("provider unavailable")),
    ):
        result, dates = client._recover_with_exact_date_daily_evidence("AAA", frame)
    assert result is frame
    assert dates == ()


def test_exact_date_recovery_rejects_unstable_exact_date_evidence():
    client = SemanticMarketDataClient()
    frame = _prepared_partial_row()
    first = _narrow_daily_row(close=102.0)
    second = _narrow_daily_row(close=102.5)
    tickers = iter([_Ticker(first), _Ticker(second)])
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        side_effect=lambda _symbol: next(tickers),
    ):
        result, dates = client._recover_with_exact_date_daily_evidence("AAA", frame)
    assert result is frame
    assert dates == ()


def test_exact_date_recovery_recomputes_split_factor_from_real_provider_row():
    client = SemanticMarketDataClient()
    frame = _prepared_partial_row(split=2.0)
    frame.loc[frame.index[0], "Split_Factor"] = 1.0
    narrow = _narrow_daily_row(split=2.0)
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        return_value=_Ticker(narrow),
    ):
        recovered, dates = client._recover_with_exact_date_daily_evidence("AAA", frame)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.0
    assert recovered.loc[pd.Timestamp("2026-08-10"), "Split_Factor"] == 2.0
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Split_Factor"] == 1.0
    assert PortfolioValidator.validate_price_data("AAA", recovered) is True


def test_exact_date_recovery_preserves_existing_market_provenance_columns():
    client = SemanticMarketDataClient()
    frame = _prepared_partial_row()
    frame["Valuation_Source"] = ["market", "asof_carry_forward"]
    frame["Valuation_Source_Date"] = ["2026-08-10", "2026-08-10"]
    narrow = _narrow_daily_row()
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        return_value=_Ticker(narrow),
    ):
        recovered, dates = client._recover_with_exact_date_daily_evidence("AAA", frame)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Valuation_Source"] == "market"
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Valuation_Source_Date"] == "2026-08-11"
