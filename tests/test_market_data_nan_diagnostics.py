import logging

import pandas as pd

from journal_engine.clients.auto_price_selector import AutoPriceSelector
from journal_engine.core.validator import PortfolioValidator


def test_nan_provider_row_is_diagnosed_without_imputation(caplog):
    index = pd.to_datetime(["2026-08-10", "2026-08-11"])
    frame = pd.DataFrame(
        {
            "Open": [100.0, float("nan")],
            "High": [101.0, float("nan")],
            "Low": [99.0, float("nan")],
            "Close": [100.5, float("nan")],
            "Adj Close": [100.0, float("nan")],
            "Volume": [1000.0, 12345.0],
            "Dividends": [0.0, 1.25],
            "Stock Splits": [0.0, 0.0],
            "Capital Gains": [0.0, 0.0],
        },
        index=index,
    )

    with caplog.at_level(logging.ERROR, logger="journal_engine.clients.auto_price_selector"):
        selected = AutoPriceSelector("0050.TW", frame).get_adjusted_price_series()

    assert selected.isna().sum() == 1
    assert pd.isna(selected.loc[pd.Timestamp("2026-08-11")])

    prepared = frame.copy()
    prepared["Close_Adjusted"] = selected
    assert PortfolioValidator.validate_price_data("0050.TW", prepared) is False

    messages = "\n".join(record.getMessage() for record in caplog.records)
    assert "Selected price field Close contains 1 NaN row(s)" in messages
    assert "NaN selected-price provider row" in messages
    assert "date=2026-08-11T00:00:00" in messages
    assert "'Volume': 12345.0" in messages
    assert "'Dividends': 1.25" in messages
    assert "'Stock Splits': 0.0" in messages
    assert "'Capital Gains': 0.0" in messages
