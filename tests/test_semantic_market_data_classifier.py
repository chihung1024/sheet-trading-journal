import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient


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
