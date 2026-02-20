from datetime import date
import pytest
from journal_engine.core.daily_pnl_engine import DailyPnLEngine, DailyPositionState, Trade

def test_daily_pnl_engine_basic_buy():
    """測試單純買入建倉：淨流出，市值增加，總損益應反映手續費耗損"""
    state = DailyPositionState(
        date=date(2026, 1, 1),
        symbol="AAPL",
        begin_qty=0.0,
        begin_price=0.0,
        begin_value=0.0,
        trades=[Trade(date=date(2026, 1, 1), symbol="AAPL", side="BUY", qty=10, price=150, fee=5)],
        end_qty=10.0,
        end_price=150.0,
        end_value=1500.0,
        cash_in=0.0,
        cash_out=1505.0  # 1500 + 5 fee
    )
    
    result = DailyPnLEngine.compute(state, realized_pnl=0.0, income_pnl=0.0)
    
    # 總損益 = 1500 - 0 + (0 - 1505) = -5 (手續費虧損)
    assert result.total_pnl == -5.0
    assert result.holding_pnl == -5.0

def test_daily_pnl_engine_basic_sell():
    """測試單純賣出獲利了結：市值減少，淨流入，產生已實現損益"""
    state = DailyPositionState(
        date=date(2026, 1, 2),
        symbol="AAPL",
        begin_qty=10.0,
        begin_price=150.0,
        begin_value=1500.0,
        trades=[Trade(date=date(2026, 1, 2), symbol="AAPL", side="SELL", qty=10, price=160, fee=5)],
        end_qty=0.0,
        end_price=160.0,
        end_value=0.0,
        cash_in=1595.0,  # 1600 - 5 fee
        cash_out=0.0
    )
    
    # 假設昨收也是 150，賣出 160，已實現損益 = (160 - 150)*10 - 5 = 95
    result = DailyPnLEngine.compute(state, realized_pnl=95.0, income_pnl=0.0)
    
    # 總損益 = 0 - 1500 + 1595 = 95
    assert result.total_pnl == 95.0
    assert result.holding_pnl == 0.0

def test_daily_pnl_engine_intraday_trading():
    """測試當沖（Intraday）：無留倉，當日買賣直接賺取價差"""
    state = DailyPositionState(
        date=date(2026, 1, 3),
        symbol="TSLA",
        begin_qty=0.0,
        begin_price=0.0,
        begin_value=0.0,
        trades=[
            Trade(date=date(2026, 1, 3), symbol="TSLA", side="BUY", qty=5, price=200, fee=2),
            Trade(date=date(2026, 1, 3), symbol="TSLA", side="SELL", qty=5, price=210, fee=2),
        ],
        end_qty=0.0,
        end_price=210.0,
        end_value=0.0,
        cash_in=1048.0,   # 1050 - 2
        cash_out=1002.0   # 1000 + 2
    )
    
    # 實現損益 = 1048 - 1002 = 46
    result = DailyPnLEngine.compute(state, realized_pnl=46.0, income_pnl=0.0)
    
    # 總損益 = 0 - 0 + (1048 - 1002) = 46
    assert result.total_pnl == 46.0
    # 當沖不留倉，未實現損益必為 0
    assert result.holding_pnl == 0.0

def test_daily_pnl_engine_dividend_income():
    """測試配息：市值下降（除息），但現金流入，Income PnL 介入"""
    state = DailyPositionState(
        date=date(2026, 1, 4),
        symbol="T",
        begin_qty=100.0,
        begin_price=20.0,
        begin_value=2000.0,
        trades=[Trade(date=date(2026, 1, 4), symbol="T", side="DIV", qty=100, price=1.0)],
        end_qty=100.0,
        end_price=19.0,  # 假設除息後股價等幅下跌
        end_value=1900.0,
        cash_in=100.0,   # 收到配息
        cash_out=0.0
    )
    
    result = DailyPnLEngine.compute(state, realized_pnl=0.0, income_pnl=100.0)
    
    # 總損益 = 1900 - 2000 + 100 = 0 (左手換右手)
    assert result.total_pnl == 0.0
    assert result.holding_pnl == -100.0  # 帳面因為除息跌了 100
    assert result.income_pnl == 100.0
