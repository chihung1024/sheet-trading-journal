import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd

from journal_engine.core.calculator import PortfolioCalculator


class FakeMarketDataClient:
    """Calculator 所需最小市場資料 stub。"""

    def __init__(self):
        idx = pd.to_datetime(["2026-01-01", "2026-01-02"]).normalize()

        self.market_data = {
            "AAA.TW": pd.DataFrame(
                {
                    "Close_Adjusted": [100.0, 110.0],
                    "Split_Factor": [1.0, 1.0],
                    "Dividends": [0.0, 0.0],
                },
                index=idx,
            ),
            "BBB.TW": pd.DataFrame(
                {
                    "Close_Adjusted": [50.0, 55.0],
                    "Split_Factor": [1.0, 1.0],
                    "Dividends": [0.0, 0.0],
                },
                index=idx,
            ),
            "0050.TW": pd.DataFrame(
                {
                    "Close_Adjusted": [150.0, 151.0],
                    "Split_Factor": [1.0, 1.0],
                    "Dividends": [0.0, 0.0],
                },
                index=idx,
            ),
        }
        self.fx_rates = pd.Series([1.0, 1.0], index=idx)
        self.realtime_fx_rate = 1.0

    def get_price(self, symbol, date):
        df = self.market_data[symbol]
        ts = pd.Timestamp(date).normalize()
        if ts in df.index:
            return float(df.loc[ts, "Close_Adjusted"])
        idx = df.index.get_indexer([ts], method="pad")[0]
        return float(df.iloc[idx]["Close_Adjusted"]) if idx != -1 else 0.0

    def get_price_asof(self, symbol, date):
        df = self.market_data[symbol]
        ts = pd.Timestamp(date).normalize()
        if ts in df.index:
            return float(df.loc[ts, "Close_Adjusted"]), ts
        idx = df.index.get_indexer([ts], method="pad")[0]
        used = df.index[idx] if idx != -1 else ts
        price = float(df.iloc[idx]["Close_Adjusted"]) if idx != -1 else 0.0
        return price, used

    def get_prev_trading_date(self, symbol, used_date):
        df = self.market_data[symbol]
        ts = pd.Timestamp(used_date).normalize()
        if ts not in df.index:
            return ts
        idx = df.index.get_loc(ts)
        return df.index[max(0, idx - 1)]

    def get_transaction_multiplier(self, symbol, date):
        return 1.0

    def get_dividend(self, symbol, date):
        return 0.0


def _make_df(rows):
    df = pd.DataFrame(rows)
    df["Date"] = pd.to_datetime(df["Date"])
    return df


def test_liquidated_position_daily_pnl_is_included_in_summary_and_holdings():
    market = FakeMarketDataClient()
    tx_df = _make_df(
        [
            {"Date": "2026-01-01", "Symbol": "AAA.TW", "Type": "BUY", "Qty": 10.0, "Price": 100.0, "Commission": 0.0, "Tax": 0.0, "Tag": ""},
            {"Date": "2026-01-02", "Symbol": "AAA.TW", "Type": "SELL", "Qty": 10.0, "Price": 110.0, "Commission": 0.0, "Tax": 0.0, "Tag": ""},
        ]
    )

    result = PortfolioCalculator(tx_df, market, benchmark_ticker="0050.TW").run()

    assert result.summary.daily_pnl_twd == 100.0
    assert result.summary.realized_pnl == 100.0
    assert result.summary.total_pnl == 100.0

    aaa = next(h for h in result.holdings if h.symbol == "AAA.TW")
    assert aaa.qty == 0.0
    assert aaa.daily_pl_twd == 100.0


def test_daily_pnl_is_aggregated_from_liquidated_and_open_positions():
    market = FakeMarketDataClient()
    tx_df = _make_df(
        [
            {"Date": "2026-01-01", "Symbol": "AAA.TW", "Type": "BUY", "Qty": 10.0, "Price": 100.0, "Commission": 0.0, "Tax": 0.0, "Tag": ""},
            {"Date": "2026-01-02", "Symbol": "AAA.TW", "Type": "SELL", "Qty": 10.0, "Price": 110.0, "Commission": 0.0, "Tax": 0.0, "Tag": ""},
            {"Date": "2026-01-01", "Symbol": "BBB.TW", "Type": "BUY", "Qty": 10.0, "Price": 50.0, "Commission": 0.0, "Tax": 0.0, "Tag": ""},
        ]
    )

    result = PortfolioCalculator(tx_df, market, benchmark_ticker="0050.TW").run()

    # AAA 清倉日已實現 +100；BBB 持倉未實現 +50（50 -> 55）
    assert result.summary.daily_pnl_twd == 150.0
    assert result.summary.daily_pnl_breakdown["tw_pnl_twd"] == 150.0
    assert result.summary.daily_pnl_breakdown["us_pnl_twd"] == 0.0
    assert result.summary.daily_pnl_breakdown["fx_pnl_twd"] == 0.0

    assert result.summary.realized_pnl == 100.0
    assert result.summary.total_pnl == 150.0
