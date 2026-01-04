import pandas as pd
import yfinance as yf
import json
import numpy as np
import requests
import os
from datetime import datetime
from collections import deque

# --- 設定區域 ---
WORKER_API_URL = 'https://journal-backend.chired.workers.dev/api/records'
API_KEY = os.environ.get("API_KEY", "")

API_HEADERS = {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json"
}

BASE_CURRENCY = 'TWD'
EXCHANGE_SYMBOL = 'USDTWD=X'
TAX_RATE_US = 0.30
TAX_RATE_TW = 0.00

def get_market_data(tickers, start_date):
    print(f"下載市場數據 (含自動配息)...")
    fx_rates = pd.Series(dtype=float)
    try:
        fx = yf.Ticker(EXCHANGE_SYMBOL)
        fx_hist = fx.history(start=start_date)
        fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None)
        fx_rates = fx_hist['Close']
    except Exception as e:
        print(f"匯率下載失敗: {e}")

    result = {}
    all_tickers = list(set(tickers + ['SPY'])) # 加入 SPY 做 Benchmark

    for t in all_tickers:
        try:
            ticker_obj = yf.Ticker(t)
            hist = ticker_obj.history(start=start_date, auto_adjust=True, actions=True)
            hist.index = pd.to_datetime(hist.index).tz_localize(None)
            
            currency = 'TWD' if (t.endswith('.TW') or t.endswith('.TWO')) else 'USD'
            
            result[t] = {
                'close': hist['Close'], 
                'splits': hist['Stock Splits'],
                'dividends': hist['Dividends'],
                'currency': currency
            }
        except Exception as e:
            print(f"無法下載 {t}: {e}")
            
    return result, fx_rates

def safe_float(val):
    try:
        if pd.isna(val) or str(val).strip() == '': return 0.0
        return float(val)
    except: return 0.0

def safe_str(val):
    if pd.isna(val): return "Other"
    return str(val).strip()

def get_split_adjustment(tx_date, split_data):
    multiplier = 1.0
    if split_data is None or split_data.empty: return multiplier
    tx_date = pd.Timestamp(tx_date).tz_localize(None)
    relevant_splits = split_data[split_data.index > tx_date]
    for split_ratio in relevant_splits:
        if split_ratio > 0: multiplier *= split_ratio
    return multiplier

def get_rate(date, fx_rates):
    try:
        if date in fx_rates.index: return fx_rates.loc[date]
        else: return fx_rates.asof(date)
    except: return 32.0

def update_portfolio():
    print("開始計算 (來源: Cloudflare D1)...")
    print(f"DEBUG: Using API Key: {API_KEY[:2]}****" if API_KEY else "DEBUG: Key Empty")

    validation_messages = []

    try:
        print(f"正在連線至 API: {WORKER_API_URL}")
        resp = requests.get(WORKER_API_URL, headers=API_HEADERS)
        
        if resp.status_code != 200:
            print(f"API 連線失敗: {resp.status_code}")
            return

        api_json = resp.json()
        records = api_json.get('data', [])
        print(f"成功取得 {len(records)} 筆交易紀錄")
        
        if not records:
            print("無交易紀錄，寫入空數據")
            with open('data.json', 'w', encoding='utf-8') as f:
                json.dump({"summary": {}, "holdings": [], "history": [], "allocation": {}}, f)
            return

        df = pd.DataFrame(records)
        df = df.rename(columns={'txn_date': 'Date', 'symbol': 'Symbol', 'txn_type': 'Type', 'qty': 'Qty', 'price': 'Price', 'fee': 'Comm', 'tag': 'Tag'})
        
        if 'Tax' not in df.columns: df['Tax'] = 0
        if 'Tag' not in df.columns: df['Tag'] = 'Stock'

        df['Date'] = pd.to_datetime(df['Date']).dt.normalize()
        df = df.dropna(subset=['Date']).sort_values('Date')
        
        for col in ['Comm', 'Tax', 'Qty', 'Price']:
            df[col] = df[col].apply(safe_float)
            
    except Exception as e:
        print(f"資料讀取失敗: {e}")
        return

    df = df[df['Symbol'].str.upper() != 'CASH'].copy()
    tickers = df['Symbol'].unique().tolist()
    
    start_date = df['Date'].min().strftime('%Y-%m-%d')
    market_data, fx_rates = get_market_data(tickers, start_date)

    start_dt = df['Date'].min()
    end_dt = pd.Timestamp.now().normalize()
    all_dates = pd.date_range(start=start_dt, end=end_dt)

    holdings = {t: 0.0 for t in tickers}
    fifo_queue = {t: deque() for t in tickers}
    symbol_tags = {} 
    
    net_invested_twd = 0.0
    total_realized_pnl_twd = 0.0
    closed_positions = [] 
    ledger = []           
    history_data = []
    
    transactions_map = {date: group.to_dict('records') for date, group in df.groupby('Date')}

    prev_total_value_twd = 0.0
    twr_cumulative = 1.0
    
    spy_start_price_twd = 0
    if 'SPY' in market_data:
        try:
            p = market_data['SPY']['close'].asof(start_dt)
            r = get_rate(start_dt, fx_rates)
            if not pd.isna(p) and not pd.isna(r): spy_start_price_twd = p * r
        except: pass

    # --- 逐日回測核心 ---
    for current_date in all_dates:
        daily_rate = get_rate(current_date, fx_rates)
        daily_cash_flow_twd = 0.0
        date_str = current_date.strftime('%Y-%m-%d')

        # 1. 處理配息
        for sym, qty in holdings.items():
            if qty > 0.001 and sym in market_data:
                divs = market_data[sym]['dividends']
                stock_curr = market_data[sym]['currency']
                if current_date in divs.index:
                    div_per_share = divs.loc[current_date]
                    if div_per_share > 0:
                        gross_div = div_per_share * qty
                        tax_rate = TAX_RATE_TW if stock_curr == 'TWD' else TAX_RATE_US
                        net_div = gross_div * (1 - tax_rate)
                        conversion = 1.0 if stock_curr == 'TWD' else daily_rate
                        net_div_twd = net_div * conversion
                        
                        net_invested_twd -= net_div_twd
                        daily_cash_flow_twd -= net_div_twd
                        total_realized_pnl_twd += net_div_twd
                        
                        entry = {'date': date_str, 'symbol': sym, 'type': 'DIV_AUTO', 'amount_twd': round(net_div_twd, 0)}
                        ledger.append(entry)

        # 2. 處理當日交易
        if current_date in transactions_map:
            for tx in transactions_map[current_date]:
                symbol = tx['Symbol']
                action = tx['Type'].strip().upper()
                raw_qty = safe_float(tx['Qty'])
                raw_price = safe_float(tx['Price'])
                
                if action not in ['BUY', 'SELL']: continue

                symbol_tags[symbol] = safe_str(tx.get('Tag', 'Stock'))
                comm = safe_float(tx['Comm'])
                tax = safe_float(tx['Tax'])
                
                stock_currency = 'USD'
                if symbol in market_data: stock_currency = market_data[symbol]['currency']
                elif symbol.endswith('.TW'): stock_currency = 'TWD'
                
                tx_rate = 1.0 if stock_currency == 'TWD' else daily_rate
                split_ratio = 1.0
                if symbol in market_data:
                    split_ratio = get_split_adjustment(current_date, market_data[symbol]['splits'])
                
                adj_qty = raw_qty * split_ratio
                raw_cost_amt = (raw_price * raw_qty) + comm
                raw_proceeds_amt = (raw_price * raw_qty) - comm - tax
                
                if action == 'BUY':
                    cost_twd = raw_cost_amt * tx_rate
                    net_invested_twd += cost_twd
                    daily_cash_flow_twd += cost_twd
                    holdings[symbol] += adj_qty
                    
                    unit_cost_origin = raw_cost_amt / adj_qty if adj_qty > 0 else 0
                    fifo_queue[symbol].append({'qty': adj_qty, 'unit_cost': unit_cost_origin, 'rate_at_buy': tx_rate})
                    
                elif action == 'SELL':
                    proceeds_twd = raw_proceeds_amt * tx_rate
                    net_invested_twd -= proceeds_twd
                    daily_cash_flow_twd -= proceeds_twd
                    holdings[symbol] -= adj_qty
                    
                    qty_to_sell = adj_qty
                    realized_pnl_tx = 0
                    while qty_to_sell > 0.000001 and fifo_queue[symbol]:
                        batch = fifo_queue[symbol][0]
                        sell_amt = min(qty_to_sell, batch['qty'])
                        cost_twd_part = (batch['unit_cost'] * batch['rate_at_buy']) * sell_amt
                        revenue_origin_unit = (raw_proceeds_amt / adj_qty)
                        rev_twd_part = (revenue_origin_unit * tx_rate) * sell_amt
                        pnl_twd = rev_twd_part - cost_twd_part
                        realized_pnl_tx += pnl_twd
                        
                        closed_positions.append({'close_date': date_str, 'symbol': symbol, 'pnl': round(pnl_twd, 0)})
                        batch['qty'] -= sell_amt
                        qty_to_sell -= sell_amt
                        if batch['qty'] < 0.000001: fifo_queue[symbol].popleft()
                    
                    total_realized_pnl_twd += realized_pnl_tx

        # 3. 計算當日市值
        market_val_twd = 0.0
        for sym, qty in holdings.items():
            if qty > 0.001:
                price = 0
                if sym in market_data:
                    closes = market_data[sym]['close']
                    try:
                        if current_date in closes.index: price = closes.loc[current_date]
                        else: price = closes.asof(current_date)
                    except: pass
                
                if (pd.isna(price) or price == 0) and fifo_queue[sym]:
                    price = fifo_queue[sym][-1]['unit_cost']
                
                conversion = 1.0 if market_data.get(sym, {}).get('currency') == 'TWD' else daily_rate
                market_val_twd += (price * qty * conversion)

        # 4. 計算 TWR
        capital_at_risk = prev_total_value_twd + daily_cash_flow_twd
        daily_return = 0.0
        if capital_at_risk > 0:
            daily_profit = market_val_twd - capital_at_risk
            daily_return = daily_profit / capital_at_risk
        
        twr_cumulative *= (1 + daily_return)
        
        bench_twr = 0.0
        if spy_start_price_twd > 0 and 'SPY' in market_data:
            try:
                p = market_data['SPY']['close'].asof(current_date)
                if not pd.isna(p):
                    curr_spy_twd = p * daily_rate
                    bench_twr = (curr_spy_twd / spy_start_price_twd) - 1
            except: pass

        history_data.append({
            "date": date_str,
            "total_value": round(market_val_twd, 0),
            "invested": round(net_invested_twd, 0),
            "twr": round((twr_cumulative - 1) * 100, 2),
            "benchmark_twr": round(bench_twr * 100, 2)
        })
        prev_total_value_twd = market_val_twd

    # --- 最終匯總 ---
    final_holdings = []
    allocation_by_tag = {}
    allocation_by_currency = {'TWD': 0, 'USD': 0}

    for sym, qty in holdings.items():
        if qty > 0.001:
            stock_cur = 'USD'
            curr_p_origin = 0
            if sym in market_data:
                stock_cur = market_data[sym]['currency']
                try: curr_p_origin = float(market_data[sym]['close'].iloc[-1])
                except: pass
            
            latest_rate = fx_rates.iloc[-1] if not fx_rates.empty else 32.0
            conversion = 1.0 if stock_cur == 'TWD' else latest_rate
            
            batches = fifo_queue[sym]
            total_cost_twd = sum((b['unit_cost'] * b['rate_at_buy']) * b['qty'] for b in batches)
            mkt_val_twd = curr_p_origin * qty * conversion
            pnl_twd = mkt_val_twd - total_cost_twd
            tag = symbol_tags.get(sym, 'Stock')
            
            allocation_by_tag[tag] = allocation_by_tag.get(tag, 0) + mkt_val_twd
            allocation_by_currency[stock_cur] = allocation_by_currency.get(stock_cur, 0) + mkt_val_twd

            final_holdings.append({
                "symbol": sym, "tag": tag, "currency": stock_cur,
                "qty": round(qty, 2),
                "market_value_twd": round(mkt_val_twd, 0),
                "pnl_twd": round(pnl_twd, 0),
                "pnl_percent": round((pnl_twd/total_cost_twd)*100, 2) if total_cost_twd!=0 else 0,
                "current_price_origin": round(curr_p_origin, 2)
            })

    curr_stats = history_data[-1] if history_data else {}
    
    final_output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "base_currency": BASE_CURRENCY,
        "exchange_rate": round(fx_rates.iloc[-1], 2) if not fx_rates.empty else 32.0,
        "summary": {
            "total_value": curr_stats.get('total_value', 0),
            "invested_capital": curr_stats.get('invested', 0),
            "total_pnl": round(curr_stats.get('total_value', 0) - curr_stats.get('invested', 0), 0),
            "twr": curr_stats.get('twr', 0),
            "realized_pnl": round(total_realized_pnl_twd, 0),
            "benchmark_twr": curr_stats.get('benchmark_twr', 0)
        },
        "holdings": final_holdings,
        "history": history_data, # 用於畫圖
        "allocation": { "tags": allocation_by_tag, "currency": allocation_by_currency } # 用於圓餅圖
    }

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
    print("更新完成 (data.json 已寫入)")

if __name__ == "__main__":
    update_portfolio()
