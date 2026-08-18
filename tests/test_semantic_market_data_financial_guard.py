from unittest.mock import patch

import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient


def test_intraday_price_recovery_rejects_unmodeled_capital_gain_before_provider_request():
    frame = pd.DataFrame(
        {
            "Open": [100.0, 101.0],
            "High": [102.0, 103.0],
            "Low": [99.0, 100.0],
            "Close": [101.0, float("nan")],
            "Adj Close": [101.0, float("nan")],
            "Close_Adjusted": [101.0, float("nan")],
            "Volume": [1000.0, 1200.0],
            "Dividends": [0.0, 0.0],
            "Stock Splits": [0.0, 0.0],
            "Capital Gains": [0.0, 0.5],
            "Split_Factor": [1.0, 1.0],
        },
        index=pd.to_datetime(["2026-08-10", "2026-08-11"]),
    )
    client = SemanticMarketDataClient()

    with patch("journal_engine.clients.semantic_market_data.yf.Ticker") as ticker:
        recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)

    assert recovered is frame
    assert dates == ()
    ticker.assert_not_called()
    assert pd.isna(recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"])
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Capital Gains"] == 0.5
