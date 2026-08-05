import pandas as pd
import pytest

from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.split_ledger import build_split_adjusted_validation_ledger
from journal_engine.core.transaction_calendar import (
    TransactionCalendarError,
    ensure_transaction_dates_in_market_calendar,
)
from journal_engine.core.validator import PortfolioValidator


class CalendarMarketClient:
    def __init__(self, rows_by_symbol, fx=32.0):
        self.market_data = {}
        self.realtime_fx_rate = fx
        self.fx_rates = pd.Series(
            [fx],
            index=[pd.Timestamp("2026-01-01")],
            dtype=float,
        )

        for symbol, rows in rows_by_symbol.items():
            frame = pd.DataFrame(rows)
            frame["Date"] = pd.to_datetime(frame["Date"])
            frame = frame.set_index("Date").sort_index()
            defaults = {
                "Close_Adjusted": 100.0,
                "Close_Raw": 100.0,
                "Split_Factor": 1.0,
                "Dividends": 0.0,
                "Stock Splits": 0.0,
                "Capital Gains": 0.0,
            }
            for column, default in defaults.items():
                if column not in frame.columns:
                    frame[column] = default
            self.market_data[symbol] = frame

    def get_price(self, symbol, date):
        price, _ = self.get_price_asof(symbol, date)
        return price

    def get_price_asof(self, symbol, date):
        timestamp = pd.Timestamp(date).normalize()
        frame = self.market_data[symbol]
        if timestamp in frame.index:
            return float(frame.loc[timestamp, "Close_Adjusted"]), timestamp
        position = frame.index.get_indexer([timestamp], method="pad")[0]
        if position == -1:
            return 0.0, timestamp
        used = frame.index[position]
        return float(frame.iloc[position]["Close_Adjusted"]), used

    def get_prev_trading_date(self, symbol, used_date):
        timestamp = pd.Timestamp(used_date).normalize()
        frame = self.market_data[symbol]
        if timestamp not in frame.index:
            position = frame.index.get_indexer([timestamp], method="pad")[0]
            if position == -1:
                return timestamp
            timestamp = frame.index[position]
        position = frame.index.get_indexer([timestamp])[0]
        return frame.index[position - 1] if position > 0 else timestamp

    def get_transaction_multiplier(self, symbol, date):
        timestamp = pd.Timestamp(date).normalize()
        frame = self.market_data[symbol]
        if timestamp in frame.index:
            return float(frame.loc[timestamp, "Split_Factor"])
        if timestamp < frame.index.min():
            return float(frame.iloc[0]["Split_Factor"])
        return float(frame.iloc[-1]["Split_Factor"])

    def get_dividend(self, symbol, date):
        timestamp = pd.Timestamp(date).normalize()
        frame = self.market_data[symbol]
        if timestamp in frame.index:
            return float(frame.loc[timestamp, "Dividends"])
        return 0.0


def make_transactions(rows):
    frame = pd.DataFrame(rows)
    for column, default in (
        ("Commission", 0.0),
        ("Tax", 0.0),
        ("Tag", ""),
    ):
        if column not in frame.columns:
            frame[column] = default
    frame["Date"] = pd.to_datetime(frame["Date"])
    return frame


def base_market():
    rows = [
        {
            "Date": "2026-01-01",
            "Close_Adjusted": 100.0,
            "Close_Raw": 100.0,
            "Split_Factor": 1.0,
            "Dividends": 2.0,
            "Stock Splits": 4.0,
            "Capital Gains": 1.0,
        }
    ]
    return CalendarMarketClient({"AAA": rows, "SPY": rows})


def test_missing_transaction_date_reproduces_silent_calculator_omission():
    market = base_market()
    transactions = make_transactions(
        [
            {
                "Date": "2026-01-01",
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 0.86,
                "Price": 100.0,
            },
            {
                "Date": "2026-01-02",
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 426.0037,
                "Price": 100.0,
            },
        ]
    )

    snapshot = PortfolioCalculator(
        transactions.copy(deep=True),
        market,
        benchmark_ticker="SPY",
    ).run()
    validation_ledger = build_split_adjusted_validation_ledger(transactions, market)

    assert snapshot.holdings[0].qty == 0.86
    assert PortfolioValidator.validate_snapshot_for_upload(
        snapshot,
        validation_ledger,
    ) is False


def test_transaction_calendar_fix_processes_same_ledger_end_to_end():
    market = base_market()
    transactions = make_transactions(
        [
            {
                "Date": "2026-01-01",
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 0.86,
                "Price": 100.0,
            },
            {
                "Date": "2026-01-02",
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 426.0037,
                "Price": 100.0,
            },
        ]
    )

    inserted = ensure_transaction_dates_in_market_calendar(market, transactions)
    snapshot = PortfolioCalculator(
        transactions.copy(deep=True),
        market,
        benchmark_ticker="SPY",
    ).run()
    validation_ledger = build_split_adjusted_validation_ledger(transactions, market)

    assert inserted == {"AAA": [pd.Timestamp("2026-01-02")]}
    assert snapshot.holdings[0].qty == 426.86
    assert PortfolioValidator.validate_snapshot_for_upload(
        snapshot,
        validation_ledger,
    ) is True


def test_synthetic_date_carries_valuation_but_not_corporate_actions():
    market = base_market()
    transactions = make_transactions(
        [
            {
                "Date": "2026-01-02",
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 1.0,
                "Price": 100.0,
            }
        ]
    )

    ensure_transaction_dates_in_market_calendar(market, transactions)
    synthetic = market.market_data["AAA"].loc[pd.Timestamp("2026-01-02")]

    assert synthetic["Close_Adjusted"] == 100.0
    assert synthetic["Split_Factor"] == 1.0
    assert synthetic["Dividends"] == 0.0
    assert synthetic["Stock Splits"] == 0.0
    assert synthetic["Capital Gains"] == 0.0


def test_existing_market_date_is_idempotent():
    market = base_market()
    transactions = make_transactions(
        [
            {
                "Date": "2026-01-01",
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 1.0,
                "Price": 100.0,
            }
        ]
    )
    original = market.market_data["AAA"].copy(deep=True)

    inserted = ensure_transaction_dates_in_market_calendar(market, transactions)

    assert inserted == {}
    pd.testing.assert_frame_equal(market.market_data["AAA"], original)


def test_transaction_before_first_market_row_fails_closed():
    market = base_market()
    transactions = make_transactions(
        [
            {
                "Date": "2025-12-31",
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 1.0,
                "Price": 100.0,
            }
        ]
    )

    with pytest.raises(TransactionCalendarError, match="precedes available market data"):
        ensure_transaction_dates_in_market_calendar(market, transactions)


def test_future_transaction_date_fails_closed():
    market = base_market()
    transactions = make_transactions(
        [
            {
                "Date": "2026-01-03",
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 1.0,
                "Price": 100.0,
            }
        ]
    )

    with pytest.raises(TransactionCalendarError, match="is after calculation date"):
        ensure_transaction_dates_in_market_calendar(
            market,
            transactions,
            as_of_date="2026-01-02",
        )


def test_missing_market_symbol_fails_closed():
    market = base_market()
    transactions = make_transactions(
        [
            {
                "Date": "2026-01-02",
                "Symbol": "MISSING",
                "Type": "BUY",
                "Qty": 1.0,
                "Price": 100.0,
            }
        ]
    )

    with pytest.raises(TransactionCalendarError, match="has no downloaded market data"):
        ensure_transaction_dates_in_market_calendar(market, transactions)


def test_validator_detects_symbol_missing_entirely_from_snapshot(caplog):
    transactions = make_transactions(
        [
            {
                "Date": "2026-01-02",
                "Symbol": "NEW",
                "Type": "BUY",
                "Qty": 5.0,
                "Price": 10.0,
            }
        ]
    )

    with caplog.at_level("ERROR"):
        valid = PortfolioValidator.validate_holdings_consistency({}, transactions)

    assert valid is False
    assert "Buy=5.0000" in caplog.text
    assert "Actual=0.0000" in caplog.text
    assert "2026-01-02..2026-01-02" in caplog.text


def test_validator_detects_stale_snapshot_only_symbol():
    transactions = pd.DataFrame(columns=["Date", "Symbol", "Type", "Qty"])
    holdings = {"STALE": {"qty": 2.0}}

    assert PortfolioValidator.validate_holdings_consistency(
        holdings,
        transactions,
    ) is False


def test_validator_accepts_union_when_buy_sell_and_snapshot_reconcile():
    transactions = make_transactions(
        [
            {
                "Date": "2026-01-01",
                "Symbol": "AAA",
                "Type": "BUY",
                "Qty": 10.0,
                "Price": 10.0,
            },
            {
                "Date": "2026-01-02",
                "Symbol": "AAA",
                "Type": "SELL",
                "Qty": 4.0,
                "Price": 11.0,
            },
        ]
    )
    holdings = {"AAA": {"qty": 6.0}}

    assert PortfolioValidator.validate_holdings_consistency(
        holdings,
        transactions,
    ) is True
