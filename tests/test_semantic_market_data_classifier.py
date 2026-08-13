import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient


def _prepared_event_row(
    *,
    dividend=0.5,
    split=0.0,
    volume=0.0,
    capital_gain=None,
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
        "Split_Factor": [1.0],
    }
    if capital_gain is not None:
        row["Capital Gains"] = [capital_gain]
    return pd.DataFrame(
        row,
        index=index if index is not None else pd.to_datetime(["2026-08-11"]),
    )


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


def test_classifier_requires_nonnegative_finite_supported_actions():
    negative_dividend = _prepared_event_row(dividend=-0.1)
    negative_split = _prepared_event_row(dividend=0.0, split=-2.0)
    malformed_dividend = _prepared_event_row(dividend="not-a-number")

    assert SemanticMarketDataClient._pure_action_only_signature(negative_dividend) is None
    assert SemanticMarketDataClient._pure_action_only_signature(negative_split) is None
    assert SemanticMarketDataClient._pure_action_only_signature(malformed_dividend) is None


def test_classifier_requires_material_supported_action():
    frame = _prepared_event_row(dividend=0.0, split=0.0)

    assert SemanticMarketDataClient._pure_action_only_signature(frame) is None


def test_classifier_rejects_malformed_optional_capital_gain():
    malformed = _prepared_event_row(capital_gain="not-a-number")

    assert SemanticMarketDataClient._pure_action_only_signature(malformed) is None


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
