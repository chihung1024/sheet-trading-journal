# calculator_enhanced.py - 增強版計算模組，移植自portfolio-journal的metrics.calculator.js
# 實現 TWR、Daily P/L、XIRR等高級指標計算

import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import math


def find_nearest_date(prices_dict: Dict, target_date: datetime) -> Optional[Tuple[str, float]]:
    """
    查找最接近目標日期的價格
    """
    if not prices_dict:
        return None
    
    dates = sorted(prices_dict.keys())
    target_str = target_date.strftime('%Y-%m-%d') if isinstance(target_date, datetime) else target_date
    
    if target_str in prices_dict:
        return (target_str, prices_dict[target_str])
    
    # 向前找最近的日期
    for date_str in reversed(dates):
        if date_str <= target_str:
            return (date_str, prices_dict[date_str])
    
    return (dates[0], prices_dict[dates[0]]) if dates else None


def calculate_twr_history(
    daily_portfolio_values: Dict[str, float],
    daily_cashflows: Dict[str, float],
    benchmark_prices: Dict[str, float],
    start_date: datetime = None
) -> Tuple[Dict[str, float], Dict[str, float]]:
    """
    【核心】計算時間加權報酬 (Time Weighted Return - TWR)
    基於改進的Hold Period Return方法
    """
    if not daily_portfolio_values or start_date is None:
        return {}, {}
    
    twr_history = {}
    benchmark_history = {}
    
    dates = sorted(daily_portfolio_values.keys())
    start_str = start_date.strftime('%Y-%m-%d') if isinstance(start_date, datetime) else start_date
    
    # 獲取基準起始價格
    bench_start_info = find_nearest_date(benchmark_prices, start_date)
    if not bench_start_info:
        return {}, {}
    
    bench_start_price = bench_start_info[1]
    cumulative_hpr = 1.0
    last_market_value = 0.0
    
    for date_str in dates:
        mve = daily_portfolio_values[date_str]  # Market Value End
        cf = daily_cashflows.get(date_str, 0)   # Cash Flow
        mvb = last_market_value                   # Market Value Beginning
        
        # 計算當期報酬率因子
        if mvb > 1e-9:
            period_hpr = (mve - cf) / mvb
        elif cf > 1e-9:
            period_hpr = mve / cf
        else:
            period_hpr = 1.0
        
        if not math.isfinite(period_hpr):
            period_hpr = 1.0
        
        cumulative_hpr *= period_hpr
        twr_history[date_str] = (cumulative_hpr - 1) * 100
        last_market_value = mve
        
        # 基準報酬率計算
        bench_info = find_nearest_date(benchmark_prices, datetime.strptime(date_str, '%Y-%m-%d'))
        if bench_info and bench_start_price > 0:
            current_bench_price = bench_info[1]
            benchmark_history[date_str] = ((current_bench_price / bench_start_price) - 1) * 100
    
    return twr_history, benchmark_history


def calculate_daily_pl(
    today: datetime,
    yesterday: datetime,
    portfolio_state_today: Dict,
    portfolio_state_yesterday: Dict,
    daily_events: List[Dict],
    market_prices: Dict[str, Dict[str, float]],
    fx_rates: Dict[str, float]
) -> float:
    """
    【核心】計算指定日期的每日損益 (Daily Profit/Loss)
    公式: Ending_MV - Beginning_MV - (Transaction_CF + Dividend_CF)
    """
    # 1. 計算昨日開盤市值
    beginning_market_value = 0
    for symbol, state in portfolio_state_yesterday.items():
        qty = state.get('quantity', 0)
        if abs(qty) > 1e-9:
            price_info = find_nearest_date(market_prices.get(symbol, {}), yesterday)
            if price_info:
                price = price_info[1]
                fx = fx_rates.get(symbol, 1.0)
                beginning_market_value += qty * price * fx
    
    # 2. 計算今日收盤市值
    ending_market_value = 0
    for symbol, state in portfolio_state_today.items():
        qty = state.get('quantity', 0)
        if abs(qty) > 1e-9:
            price_info = find_nearest_date(market_prices.get(symbol, {}), today)
            if price_info:
                price = price_info[1]
                fx = fx_rates.get(symbol, 1.0)
                ending_market_value += qty * price * fx
    
    # 3. 計算今日現金流
    daily_cashflow = 0
    for event in daily_events:
        if event.get('type') == 'transaction':
            cost = event.get('quantity', 0) * event.get('price', 0)
            fx = fx_rates.get(event.get('symbol'), 1.0)
            if event.get('action') == 'buy':
                daily_cashflow += cost * fx
            else:  # sell
                daily_cashflow -= cost * fx
        elif event.get('type') == 'dividend':
            dividend_amount = event.get('amount', 0)
            fx = fx_rates.get(event.get('currency', 'USD'), 1.0)
            daily_cashflow -= dividend_amount * fx  # 視為負現金流
    
    # 4. 計算當日損益
    daily_pl = ending_market_value - beginning_market_value - daily_cashflow
    return daily_pl


def calculate_xirr(cash_flows: List[Tuple[datetime, float]], guess: float = 0.1, max_iterations: int = 50) -> Optional[float]:
    """
    【核心】計算內部報酬率 (Extended IRR)
    使用牛頓-拉夫遜方法
    
    Args:
        cash_flows: [(date, amount), ...] 按日期排序的現金流
        guess: 初始猜測值
        max_iterations: 最大迭代次數
    
    Returns:
        XIRR值或None（無法收斂）
    """
    if len(cash_flows) < 2:
        return None
    
    amounts = [cf[1] for cf in cash_flows]
    
    # 檢查是否有正負現金流
    if not any(v < 0 for v in amounts) or not any(v > 0 for v in amounts):
        return None
    
    dates = [cf[0] for cf in cash_flows]
    epoch = dates[0].timestamp()
    years = [(d.timestamp() - epoch) / (365.25 * 24 * 3600) for d in dates]
    
    current_guess = guess
    
    for i in range(max_iterations):
        # 計算NPV
        npv = sum(amount / ((1 + current_guess) ** year) for amount, year in zip(amounts, years))
        
        if abs(npv) < 1e-6:
            return current_guess
        
        # 計算導數
        derivative = sum(-year * amount / ((1 + current_guess) ** (year + 1)) for amount, year in zip(amounts, years))
        
        if abs(derivative) < 1e-9:
            break
        
        # 牛頓法更新
        current_guess -= npv / derivative
    
    return current_guess if npv and abs(npv) < 1e-6 else None


def calculate_core_metrics(
    transactions: List[Dict],
    dividends: List[Dict],
    market_prices: Dict[str, Dict[str, float]],
    fx_rates: Dict[str, float]
) -> Dict:
    """
    【核心】計算核心投資指標
    - 已實現損益
    - XIRR
    - 未實現損益
    - 總報酬率
    """
    # 按符號組織交易
    holdings = {}
    total_realized_pl = 0.0
    total_buy_cost = 0.0
    
    # 處理交易
    for tx in transactions:
        symbol = tx['symbol'].upper()
        if symbol not in holdings:
            holdings[symbol] = {
                'quantity': 0,
                'lots': [],
                'currency': tx.get('currency', 'USD'),
                'realized_pl': 0.0
            }
        
        qty = tx['quantity']
        price = tx['price']
        fx = fx_rates.get(symbol, 1.0)
        cost = qty * price * fx
        
        if tx['action'] == 'buy':
            total_buy_cost += cost
            holdings[symbol]['quantity'] += qty
            holdings[symbol]['lots'].append({
                'quantity': qty,
                'price': price,
                'fx': fx,
                'date': tx['date']
            })
        else:  # sell
            holdings[symbol]['quantity'] -= qty
            # FIFO: 從最早的批次開始減
            remaining_qty = qty
            for lot in holdings[symbol]['lots']:
                if remaining_qty <= 0:
                    break
                lot_qty = min(lot['quantity'], remaining_qty)
                realized_gain = (price - lot['price']) * lot_qty * lot['fx']
                total_realized_pl += realized_gain
                holdings[symbol]['realized_pl'] += realized_gain
                lot['quantity'] -= lot_qty
                remaining_qty -= lot_qty
    
    # 處理股息
    for div in dividends:
        symbol = div['symbol'].upper()
        if symbol in holdings:
            amount = div['amount']
            fx = fx_rates.get(symbol, 1.0)
            div_twd = amount * fx
            total_realized_pl += div_twd
            holdings[symbol]['realized_pl'] += div_twd
    
    # 計算未實現損益
    current_date = datetime.now()
    total_unrealized_pl = 0.0
    
    for symbol, h in holdings.items():
        if h['quantity'] > 1e-9:
            price_info = find_nearest_date(market_prices.get(symbol, {}), current_date)
            if price_info:
                current_price = price_info[1]
                fx = fx_rates.get(symbol, 1.0)
                total_cost = sum(lot['quantity'] * lot['price'] * lot['fx'] for lot in h['lots'])
                market_value = h['quantity'] * current_price * fx
                unrealized_pl = market_value - total_cost
                total_unrealized_pl += unrealized_pl
    
    total_pl = total_realized_pl + total_unrealized_pl
    overall_return_rate = (total_pl / total_buy_cost * 100) if total_buy_cost > 0 else 0
    
    return {
        'holdings': holdings,
        'total_realized_pl': total_realized_pl,
        'total_unrealized_pl': total_unrealized_pl,
        'total_pl': total_pl,
        'overall_return_rate': overall_return_rate,
        'total_buy_cost': total_buy_cost
    }
