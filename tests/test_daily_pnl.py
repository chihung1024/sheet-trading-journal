import json
from pathlib import Path

import pandas as pd

from journal_engine.core.calculator import PortfolioCalculator


class FakeMarketDataClient:
    def __init__(self, price_table, fx=32.0):
        # 支援傳入字典來模擬隨時間變動的匯率 (FX)
        if isinstance(fx, dict):
            self.realtime_fx_rate = None
            idx = pd.to_datetime(list(fx.keys()))
            self.fx_rates = pd.Series(list(fx.values()), index=idx).sort_index()
        else:
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


# ==========================================
# 新增：核心邏輯重構後的防禦性測試 (Regression Tests)
# ==========================================

def test_daily_pnl_includes_dividend_income():
    """驗證當日損益 (Daily PnL) 是否正確包含當日發放的股息 (Income PnL)"""
    market = FakeMarketDataClient({
        'SPY': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100, 'Dividends': 0},
            # 股價不變，但發放每股 $1 股息
            {'Date': '2026-01-02', 'Close_Adjusted': 100, 'Dividends': 1.0},
        ]
    }, fx=30.0)
    
    df = _build_transactions([
        {'Date': '2026-01-01', 'Symbol': 'SPY', 'Type': 'BUY', 'Qty': 100, 'Price': 100},
    ])
    calc = PortfolioCalculator(df, market)
    snap = calc.run()
    
    # 2026-01-02: 股價未實現損益為 0。股息 = 100股 * $1 * 0.7(預扣稅) = $70
    # $70 * 30.0(匯率) = 2100 TWD
    expected_income_pnl = 2100.0
    assert round(snap.summary.daily_pnl_twd, 0) == expected_income_pnl
    assert round(snap.summary.daily_pnl_breakdown['us_pnl_twd'], 0) == expected_income_pnl


def test_new_position_fx_pnl_is_zero():
    """驗證當日新建立的美股部位，不會錯誤繼承前日匯率而憑空產生匯率損益"""
    market = FakeMarketDataClient({
        'SPY': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100, 'Dividends': 0},
            {'Date': '2026-01-02', 'Close_Adjusted': 100, 'Dividends': 0},
        ]
    }, fx={'2026-01-01': 30.0, '2026-01-02': 32.0}) # 模擬匯率大跳空
    
    df = _build_transactions([
        # 在 1/2 當天才買入，成本匯率就是 32.0
        {'Date': '2026-01-02', 'Symbol': 'SPY', 'Type': 'BUY', 'Qty': 100, 'Price': 100},
    ])
    calc = PortfolioCalculator(df, market)
    snap = calc.run()
    
    # 新倉不應該有任何匯率損益
    assert round(snap.summary.daily_pnl_breakdown['fx_pnl_twd'], 0) == 0.0
    assert round(snap.summary.daily_pnl_twd, 0) == 0.0


def test_old_position_captures_fx_pnl():
    """驗證昨日留倉的部位，在匯率跳動時能正確捕獲匯率損益分量"""
    market = FakeMarketDataClient({
        'SPY': [
            {'Date': '2026-01-01', 'Close_Adjusted': 100, 'Dividends': 0},
            {'Date': '2026-01-02', 'Close_Adjusted': 100, 'Dividends': 0},
        ]
    }, fx={'2026-01-01': 30.0, '2026-01-02': 32.0}) # 模擬匯率大跳空
    
    df = _build_transactions([
        # 1/1 買入，成本匯率為 30.0
        {'Date': '2026-01-01', 'Symbol': 'SPY', 'Type': 'BUY', 'Qty': 100, 'Price': 100},
    ])
    calc = PortfolioCalculator(df, market)
    snap = calc.run()
    
    # 股價維持 100 USD 不變。匯率從 30 變成 32。
    # 匯率損益 = 100股 * 100USD * (32 - 30) = 20,000 TWD
    expected_fx_pnl = 20000.0
    assert round(snap.summary.daily_pnl_breakdown['fx_pnl_twd'], 0) == expected_fx_pnl
    assert round(snap.summary.daily_pnl_twd, 0) == expected_fx_pnl
