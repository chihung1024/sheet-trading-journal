import pandas as pd

from journal_engine.core.calculator import PortfolioCalculator


class FakeMarketDataClient:
    def __init__(self, price_table, fx=32.0):
        self.realtime_fx_rate = fx
        self.fx_rates = pd.Series([fx], index=[pd.Timestamp('2026-01-01')])
        self.market_data = {}
        self._price_table = {}
        for symbol, rows in price_table.items():
            df = pd.DataFrame(rows)
            df['Date'] = pd.to_datetime(df['Date'])
            df = df.set_index('Date').sort_index()
            if 'Dividends' not in df.columns:
                df['Dividends'] = 0.0
            df['Split_Factor'] = 1.0
            self.market_data[symbol] = df
            for d, v in df['Close_Adjusted'].items():
                self._price_table[(symbol, pd.Timestamp(d).normalize())] = float(v)

    def get_price(self, symbol, d):
        d = pd.Timestamp(d).normalize()
        if (symbol, d) in self._price_table:
            return self._price_table[(symbol, d)]
        idx = self.market_data[symbol].index
        pad_idx = idx.get_indexer([d], method='pad')[0]
        if pad_idx == -1:
            return 0.0
        return float(self.market_data[symbol].iloc[pad_idx]['Close_Adjusted'])

    def get_price_asof(self, symbol, d):
        d = pd.Timestamp(d).normalize()
        idx = self.market_data[symbol].index
        if d in idx:
            return float(self.market_data[symbol].loc[d, 'Close_Adjusted']), d
        pad_idx = idx.get_indexer([d], method='pad')[0]
        if pad_idx == -1:
            return 0.0, d
        used = idx[pad_idx]
        return float(self.market_data[symbol].iloc[pad_idx]['Close_Adjusted']), used

    def get_prev_trading_date(self, symbol, used_date):
        used = pd.Timestamp(used_date).normalize()
        idx = self.market_data[symbol].index
        if used not in idx:
            pad = idx.get_indexer([used], method='pad')[0]
            if pad == -1:
                return used
            used = idx[pad]
        pos = idx.get_indexer([used])[0]
        return idx[pos - 1] if pos > 0 else used

    def get_transaction_multiplier(self, symbol, d):
        return 1.0

    def get_dividend(self, symbol, d):
        return 0.0


def test_holding_row_daily_pl_excludes_realized_intraday_pnl():
    market = FakeMarketDataClient({
        'SPY': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100},
            {'Date': '2026-01-02', 'Close_Adjusted': 100},
        ],
        '2330.TW': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100},
            {'Date': '2026-01-02', 'Close_Adjusted': 100},
        ],
    }, fx=32.0)

    df = pd.DataFrame([
        {'Date': '2026-01-01', 'Symbol': '2330.TW', 'Type': 'BUY', 'Qty': 100, 'Price': 100, 'Commission': 0, 'Tax': 0, 'Tag': ''},
        {'Date': '2026-01-02', 'Symbol': '2330.TW', 'Type': 'SELL', 'Qty': 50, 'Price': 120, 'Commission': 0, 'Tax': 0, 'Tag': ''},
    ])
    df['Date'] = pd.to_datetime(df['Date'])

    snap = PortfolioCalculator(df, market).run()

    holding = next(h for h in snap.holdings if h.symbol == '2330.TW')
    assert holding.daily_change_percent == 0.0
    assert holding.daily_pl_twd == 0.0

    # Summary 當日損益仍需包含當日已實現獲利
    assert snap.summary.daily_pnl_twd == 1000.0
