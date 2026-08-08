import pandas as pd
import pytest

from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.transaction_calendar import (
    TransactionCalendarError,
    ensure_transaction_dates_in_market_calendar,
)


class BootstrapMarketClient:
    def __init__(self, rows_by_symbol, fx=32.0):
        self.market_data = {}
        self.realtime_fx_rate = fx
        self.fx_rates = pd.Series(
            [fx, fx, fx],
            index=pd.to_datetime(["2026-08-05", "2026-08-06", "2026-08-07"]),
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
        position = frame.index.get_indexer([timestamp], method="pad")[0]
        if position != -1:
            return float(frame.iloc[position]["Split_Factor"])
        return float(frame.iloc[0]["Split_Factor"])

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


def base_rows(*, split_factor=1.0):
    return {
        "LYTE": [
            {
                "Date": "2026-08-07",
                "Close_Adjusted": 26.42 / split_factor,
                "Close_Raw": 26.42,
                "Split_Factor": split_factor,
            }
        ],
        "SPY": [
            {"Date": "2026-08-05", "Close_Adjusted": 700.0, "Close_Raw": 700.0},
            {"Date": "2026-08-06", "Close_Adjusted": 701.0, "Close_Raw": 701.0},
            {"Date": "2026-08-07", "Close_Adjusted": 702.0, "Close_Raw": 702.0},
        ],
    }


def test_launch_day_before_first_market_row_uses_transaction_seed_with_provenance():
    market = BootstrapMarketClient(base_rows())
    transactions = make_transactions(
        [
            {"Date": "2026-08-06", "Symbol": "LYTE", "Type": "BUY", "Qty": 193, "Price": 25.83},
            {"Date": "2026-08-06", "Symbol": "LYTE", "Type": "SELL", "Qty": 193, "Price": 26.10},
        ]
    )

    inserted = ensure_transaction_dates_in_market_calendar(
        market,
        transactions,
        as_of_date="2026-08-08",
    )

    seeded = market.market_data["LYTE"].loc[pd.Timestamp("2026-08-06")]
    assert inserted == {"LYTE": [pd.Timestamp("2026-08-06")]}
    assert seeded["Close_Adjusted"] == pytest.approx(26.10)
    assert seeded["Close_Raw"] == pytest.approx(26.10)
    assert seeded["Valuation_Source"] == "transaction_price_seed"
    assert seeded["Valuation_Source_Date"] == "2026-08-06"
    assert seeded["Dividends"] == 0.0
    assert seeded["Stock Splits"] == 0.0
    assert seeded["Capital Gains"] == 0.0


def test_launch_seed_is_converted_to_split_adjusted_price_basis():
    market = BootstrapMarketClient(base_rows(split_factor=2.0))
    transactions = make_transactions(
        [{"Date": "2026-08-06", "Symbol": "LYTE", "Type": "BUY", "Qty": 10, "Price": 50.0}]
    )

    ensure_transaction_dates_in_market_calendar(market, transactions, as_of_date="2026-08-08")

    seeded = market.market_data["LYTE"].loc[pd.Timestamp("2026-08-06")]
    assert seeded["Close_Raw"] == pytest.approx(50.0)
    assert seeded["Close_Adjusted"] == pytest.approx(25.0)
    assert seeded["Split_Factor"] == pytest.approx(2.0)


def test_launch_day_round_trip_calculates_realized_pnl_without_vendor_close():
    market = BootstrapMarketClient(base_rows())
    transactions = make_transactions(
        [
            {"Date": "2026-08-06", "Symbol": "LYTE", "Type": "BUY", "Qty": 193, "Price": 25.83},
            {"Date": "2026-08-06", "Symbol": "LYTE", "Type": "SELL", "Qty": 193, "Price": 26.10},
        ]
    )
    ensure_transaction_dates_in_market_calendar(market, transactions, as_of_date="2026-08-08")

    snapshot = PortfolioCalculator(
        transactions.copy(deep=True),
        market,
        benchmark_ticker="SPY",
    ).run()

    expected_realized_twd = (26.10 - 25.83) * 193 * 32.0
    assert snapshot.summary.realized_pnl == pytest.approx(expected_realized_twd, abs=1.0)
    assert not snapshot.holdings
    launch_history = next(row for row in snapshot.history if row["date"] == "2026-08-06")
    assert launch_history["total_value"] == 0


def test_launch_day_open_position_uses_transaction_seed_for_eod_valuation():
    market = BootstrapMarketClient(base_rows())
    transactions = make_transactions(
        [{"Date": "2026-08-06", "Symbol": "LYTE", "Type": "BUY", "Qty": 10, "Price": 25.83}]
    )
    ensure_transaction_dates_in_market_calendar(market, transactions, as_of_date="2026-08-08")

    snapshot = PortfolioCalculator(
        transactions.copy(deep=True),
        market,
        benchmark_ticker="SPY",
    ).run()

    launch_history = next(row for row in snapshot.history if row["date"] == "2026-08-06")
    assert launch_history["total_value"] == round(10 * 25.83 * 32.0)


def test_large_leading_history_gap_still_fails_closed():
    market = BootstrapMarketClient(base_rows())
    transactions = make_transactions(
        [{"Date": "2026-07-01", "Symbol": "LYTE", "Type": "BUY", "Qty": 1, "Price": 25.0}]
    )

    with pytest.raises(TransactionCalendarError, match="precedes available market data by"):
        ensure_transaction_dates_in_market_calendar(market, transactions, as_of_date="2026-08-08")


def test_leading_date_without_positive_buy_sell_seed_still_fails_closed():
    market = BootstrapMarketClient(base_rows())
    transactions = make_transactions(
        [{"Date": "2026-08-06", "Symbol": "LYTE", "Type": "DIV", "Qty": 1, "Price": 1.0}]
    )

    with pytest.raises(TransactionCalendarError, match="no positive BUY/SELL transaction price seed"):
        ensure_transaction_dates_in_market_calendar(market, transactions, as_of_date="2026-08-08")
