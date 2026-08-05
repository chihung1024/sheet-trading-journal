import pandas as pd

from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.split_ledger import (
    build_split_adjusted_validation_ledger,
    validate_adjusted_ledger_parity,
)
from journal_engine.core.transaction_calendar import ensure_transaction_dates_in_market_calendar


class FixedMultiplierMarket:
    def __init__(self, multiplier=1.0):
        self.multiplier = multiplier

    def get_transaction_multiplier(self, symbol, date):
        return self.multiplier


def make_ledger():
    return pd.DataFrame(
        [
            {
                "Date": pd.Timestamp("2026-01-03"),
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 10.0,
                "Price": 20.0,
            },
            {
                "Date": pd.Timestamp("2026-01-04"),
                "Symbol": "AAA",
                "Type": "SELL",
                "Qty": 2.0,
                "Price": 25.0,
            },
            {
                "Date": pd.Timestamp("2026-01-04"),
                "Symbol": "AAA",
                "Type": "DIV",
                "Qty": 8.0,
                "Price": 0.5,
            },
        ]
    )


def test_transaction_multiplier_uses_latest_row_at_or_before_date():
    client = MarketDataClient()
    client.market_data["AAA"] = pd.DataFrame(
        {
            "Split_Factor": [0.1, 1.0],
        },
        index=pd.to_datetime(["2026-01-01", "2026-01-05"]),
    )

    assert client.get_transaction_multiplier("AAA", "2026-01-01") == 0.1
    assert client.get_transaction_multiplier("AAA", "2026-01-03") == 0.1
    assert client.get_transaction_multiplier("AAA", "2026-01-05") == 1.0
    assert client.get_transaction_multiplier("AAA", "2026-01-07") == 1.0


def test_transaction_multiplier_normalizes_timezone_aware_timestamp():
    client = MarketDataClient()
    client.market_data["AAA"] = pd.DataFrame(
        {"Split_Factor": [0.25, 1.0]},
        index=pd.to_datetime(["2026-01-01", "2026-01-05"]),
    )

    timestamp = pd.Timestamp("2026-01-03 12:00:00", tz="Asia/Taipei")

    assert client.get_transaction_multiplier("AAA", timestamp) == 0.25


def test_transaction_multiplier_before_first_row_uses_first_known_factor():
    client = MarketDataClient()
    client.market_data["AAA"] = pd.DataFrame(
        {"Split_Factor": [0.2, 1.0]},
        index=pd.to_datetime(["2026-01-02", "2026-01-05"]),
    )

    assert client.get_transaction_multiplier("AAA", "2026-01-01") == 0.2


def test_split_ledger_parity_accepts_identical_adjusted_ledgers():
    raw = make_ledger()
    market = FixedMultiplierMarket(0.1)
    calculator_ledger = build_split_adjusted_validation_ledger(raw, market)
    validation_ledger = build_split_adjusted_validation_ledger(raw, market)

    assert validate_adjusted_ledger_parity(
        calculator_ledger,
        validation_ledger,
    ) is True


def test_split_ledger_parity_rejects_quantity_divergence():
    raw = make_ledger()
    market = FixedMultiplierMarket(0.1)
    calculator_ledger = build_split_adjusted_validation_ledger(raw, market)
    validation_ledger = build_split_adjusted_validation_ledger(raw, market)
    validation_ledger.at[0, "Qty"] += 0.01

    assert validate_adjusted_ledger_parity(
        calculator_ledger,
        validation_ledger,
    ) is False


def test_split_ledger_parity_rejects_date_or_identity_divergence():
    raw = make_ledger()
    market = FixedMultiplierMarket(0.1)
    calculator_ledger = build_split_adjusted_validation_ledger(raw, market)
    validation_ledger = build_split_adjusted_validation_ledger(raw, market)
    validation_ledger.at[1, "Date"] = pd.Timestamp("2026-01-05")
    validation_ledger.at[1, "Symbol"] = "BBB"

    assert validate_adjusted_ledger_parity(
        calculator_ledger,
        validation_ledger,
    ) is False


def test_calendar_alignment_preserves_prior_split_factor_on_missing_date():
    client = MarketDataClient()
    client.market_data["AAA"] = pd.DataFrame(
        {
            "Close_Adjusted": [10.0],
            "Close_Raw": [10.0],
            "Split_Factor": [0.002],
            "Dividends": [1.0],
            "Stock Splits": [500.0],
            "Capital Gains": [2.0],
        },
        index=pd.to_datetime(["2026-01-01"]),
    )
    transactions = pd.DataFrame(
        [
            {
                "Date": pd.Timestamp("2026-01-02"),
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 500.0,
                "Price": 10.0,
            }
        ]
    )

    ensure_transaction_dates_in_market_calendar(
        client,
        transactions,
        as_of_date="2026-01-02",
    )

    synthetic = client.market_data["AAA"].loc[pd.Timestamp("2026-01-02")]
    assert synthetic["Split_Factor"] == 0.002
    assert synthetic["Dividends"] == 0.0
    assert synthetic["Stock Splits"] == 0.0
    assert synthetic["Capital Gains"] == 0.0
    assert client.get_transaction_multiplier("AAA", "2026-01-02") == 0.002


def test_calendar_alignment_and_split_ledger_share_same_factor():
    client = MarketDataClient()
    client.market_data["AAA"] = pd.DataFrame(
        {
            "Close_Adjusted": [10.0],
            "Close_Raw": [10.0],
            "Split_Factor": [0.002],
            "Dividends": [0.0],
            "Stock Splits": [0.0],
        },
        index=pd.to_datetime(["2026-01-01"]),
    )
    raw = pd.DataFrame(
        [
            {
                "Date": pd.Timestamp("2026-01-02"),
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 500.0,
                "Price": 10.0,
            }
        ]
    )

    ensure_transaction_dates_in_market_calendar(
        client,
        raw,
        as_of_date="2026-01-02",
    )
    calculator_ledger = build_split_adjusted_validation_ledger(raw, client)
    validation_ledger = build_split_adjusted_validation_ledger(raw, client)

    assert calculator_ledger.at[0, "Qty"] == 1.0
    assert calculator_ledger.at[0, "Price"] == 5000.0
    assert validate_adjusted_ledger_parity(
        calculator_ledger,
        validation_ledger,
    ) is True
