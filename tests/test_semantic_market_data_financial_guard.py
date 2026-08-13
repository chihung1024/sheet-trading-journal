import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient


def test_complete_exact_date_candidate_rejects_unmodeled_capital_gain():
    frame = pd.DataFrame(
        {
            "Open": [100.0],
            "High": [102.0],
            "Low": [99.0],
            "Close": [101.0],
            "Adj Close": [101.0],
            "Volume": [1000.0],
            "Dividends": [0.0],
            "Stock Splits": [0.0],
            "Capital Gains": [0.5],
        },
        index=pd.to_datetime(["2026-08-11"]),
    )

    assert SemanticMarketDataClient._complete_narrow_daily_candidate(
        frame,
        pd.Timestamp("2026-08-11"),
    ) is None
