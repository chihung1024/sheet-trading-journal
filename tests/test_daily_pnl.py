import json
from pathlib import Path

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
        d = pd.Timestamp(d).normalize()
        if d in self.market_data[symbol].index:
            return float(self.market_data[symbol].loc[d, 'Dividends'])
        return 0.0


def _build_transactions(rows):
    df = pd.DataFrame(rows)
    if df.empty:
        df = pd.DataFrame(columns=['Date', 'Symbol', 'Type', 'Qty', 'Price', 'Commission', 'Tax', 'Tag'])
    for c in ['Commission', 'Tax', 'Tag']:
        if c not in df.columns:
            df[c] = 0.0 if c != 'Tag' else ''
    df['Date'] = pd.to_datetime(df['Date'])
    return df


def test_oversell_error_mode_raises():
    market = FakeMarketDataClient({
        'SPY': [{'Date': '2026-01-01', 'Close_Adjusted': 100}, {'Date': '2026-01-02', 'Close_Adjusted': 101}],
        'AAA': [{'Date': '2026-01-01', 'Close_Adjusted': 100}, {'Date': '2026-01-02', 'Close_Adjusted': 100}],
    })
    df = _build_transactions([
        {'Date': '2026-01-01', 'Symbol': 'AAA', 'Type': 'BUY', 'Qty': 1, 'Price': 100},
        {'Date': '2026-01-02', 'Symbol': 'AAA', 'Type': 'SELL', 'Qty': 2, 'Price': 100},
    ])
    calc = PortfolioCalculator(df, market, oversell_policy='ERROR')
    try:
        calc.run()
        assert False, 'should raise oversell error'
    except ValueError as e:
        assert 'Oversell' in str(e)


def test_dividend_pending_uses_original_fixed_30pct_model():
    market = FakeMarketDataClient({
        'SPY': [{'Date': '2026-01-01', 'Close_Adjusted': 100}, {'Date': '2026-01-02', 'Close_Adjusted': 101}],
        '2330.TW': [
            {'Date': '2026-01-01', 'Close_Adjusted': 500, 'Dividends': 0},
            {'Date': '2026-01-02', 'Close_Adjusted': 500, 'Dividends': 2},
        ],
        'NVDA': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100, 'Dividends': 0},
            {'Date': '2026-01-02', 'Close_Adjusted': 100, 'Dividends': 1},
        ],
    }, fx=30.0)
    df = _build_transactions([
        {'Date': '2026-01-01', 'Symbol': '2330.TW', 'Type': 'BUY', 'Qty': 10, 'Price': 500},
        {'Date': '2026-01-01', 'Symbol': 'NVDA', 'Type': 'BUY', 'Qty': 2, 'Price': 100},
    ])
    calc = PortfolioCalculator(df, market)
    snap = calc.run()
    all_pending = snap.pending_dividends
    by_symbol = {x.symbol: x for x in all_pending}
    assert by_symbol['2330.TW'].total_net_usd == 14.0
    assert by_symbol['NVDA'].total_net_usd == 1.4


def test_sequence_stabilizes_same_day_order():
    market = FakeMarketDataClient({
        'SPY': [{'Date': '2026-01-01', 'Close_Adjusted': 100}, {'Date': '2026-01-02', 'Close_Adjusted': 100}],
        'AAA': [{'Date': '2026-01-01', 'Close_Adjusted': 100}, {'Date': '2026-01-02', 'Close_Adjusted': 100}],
    })
    df = _build_transactions([
        {'Date': '2026-01-02', 'Symbol': 'AAA', 'Type': 'SELL', 'Qty': 5, 'Price': 100, '_sequence': 2},
        {'Date': '2026-01-01', 'Symbol': 'AAA', 'Type': 'BUY', 'Qty': 10, 'Price': 100, '_sequence': 0},
        {'Date': '2026-01-02', 'Symbol': 'AAA', 'Type': 'BUY', 'Qty': 5, 'Price': 100, '_sequence': 1},
    ])
    calc = PortfolioCalculator(df, market, oversell_policy='ERROR')
    snap = calc.run()
    h = snap.holdings[0]
    assert h.qty == 10.0


def test_golden_snapshot_regression_matrix():
    fixture = Path('tests/fixtures/golden_case_mixed_tw_us.json')
    data = json.loads(fixture.read_text())
    market = FakeMarketDataClient(data['market'], fx=data['fx'])
    df = _build_transactions(data['transactions'])
    calc = PortfolioCalculator(
        df,
        market,
        oversell_policy='ERROR'
    )
    snap = calc.run()

    expected = data['expected']
    assert round(snap.summary.total_value, 0) == expected['total_value']
    assert round(snap.summary.realized_pnl, 0) == expected['realized_pnl']
    assert round(snap.summary.daily_pnl_twd, 0) == expected['daily_pnl_twd']
    assert len(snap.groups['all'].day_ledger) >= 1
    assert len(snap.groups['all'].lot_ledger) >= 1

def test_twr_uses_previous_nav_plus_daily_buy_cost_as_base():
    market = FakeMarketDataClient({
        'SPY': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100},
            {'Date': '2026-01-02', 'Close_Adjusted': 100},
            {'Date': '2026-01-03', 'Close_Adjusted': 100},
        ],
        'AAA': [
            {'Date': '2026-01-01', 'Close_Adjusted': 10},
            {'Date': '2026-01-02', 'Close_Adjusted': 10},
            {'Date': '2026-01-03', 'Close_Adjusted': 10.5},
        ],
    })
    df = _build_transactions([
        {'Date': '2026-01-02', 'Symbol': 'AAA', 'Type': 'BUY', 'Qty': 1000, 'Price': 10},
        {'Date': '2026-01-03', 'Symbol': 'AAA', 'Type': 'BUY', 'Qty': 9000, 'Price': 10},
        {'Date': '2026-01-03', 'Symbol': 'AAA', 'Type': 'SELL', 'Qty': 9000, 'Price': 10.5},
    ])

    calc = PortfolioCalculator(df, market)
    snap = calc.run()

    day2 = next(x for x in snap.history if x['date'] == '2026-01-03')
    assert round(day2['twr'], 2) == 5.0


def test_twr_reduce_position_uses_correct_daily_return_base():
    market = FakeMarketDataClient({
        'SPY': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100},
            {'Date': '2026-01-02', 'Close_Adjusted': 100},
            {'Date': '2026-01-03', 'Close_Adjusted': 100},
        ],
        'AAA': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100},
            {'Date': '2026-01-02', 'Close_Adjusted': 100},
            {'Date': '2026-01-03', 'Close_Adjusted': 110},
        ],
    })

    # Day2 持有 1 股（前日淨值=100），Day3 減碼賣出 0.5 股 @110。
    # Day3: 期末市值 55，淨現金流(內部)=-55，daily_pnl=(55-100)-(-55)=10，
    # base=100+0=100，日報酬=10%。
    df = _build_transactions([
        {'Date': '2026-01-02', 'Symbol': 'AAA', 'Type': 'BUY', 'Qty': 1, 'Price': 100},
        {'Date': '2026-01-03', 'Symbol': 'AAA', 'Type': 'SELL', 'Qty': 0.5, 'Price': 110},
    ])

    calc = PortfolioCalculator(df, market)
    snap = calc.run()
    day = next(x for x in snap.history if x['date'] == '2026-01-03')
    assert round(day['twr'], 2) == 10.0


def test_twr_full_liquidation_uses_correct_daily_return_base():
    market = FakeMarketDataClient({
        'SPY': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100},
            {'Date': '2026-01-02', 'Close_Adjusted': 100},
            {'Date': '2026-01-03', 'Close_Adjusted': 100},
        ],
        'AAA': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100},
            {'Date': '2026-01-02', 'Close_Adjusted': 100},
            {'Date': '2026-01-03', 'Close_Adjusted': 110},
        ],
    })

    # Day2 持有 1 股（前日淨值=100），Day3 全數出清賣出 1 股 @110。
    # Day3: 期末市值 0，淨現金流(內部)=-110，daily_pnl=(0-100)-(-110)=10，
    # base=100，日報酬=10%。
    df = _build_transactions([
        {'Date': '2026-01-02', 'Symbol': 'AAA', 'Type': 'BUY', 'Qty': 1, 'Price': 100},
        {'Date': '2026-01-03', 'Symbol': 'AAA', 'Type': 'SELL', 'Qty': 1, 'Price': 110},
    ])

    calc = PortfolioCalculator(df, market)
    snap = calc.run()
    day = next(x for x in snap.history if x['date'] == '2026-01-03')
    assert round(day['twr'], 2) == 10.0
