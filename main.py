import pandas as pd
import yfinance as yf
import json
import numpy as np
from datetime import datetime
from collections import deque

# --- 設定 ---
SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2Km74qaJt42zPpsQk2GCu2Bl9ATPNH9bllT6QyXxYps9i-r2RZcF10KKTTVAgm7PffGVe0zRDthLH/pub?gid=0&single=true&output=csv'
BASE_CURRENCY = 'TWD'
EXCHANGE_SYMBOL = 'USDTWD=X'

# 預設稅率 (美股 30%, 台股 0%)
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
    all_tickers = list(set(tickers + ['SPY']))

    for t in all_tickers:
        try:
            ticker_obj = yf.Ticker(t)
            # actions=True 確保抓到股息
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
        if pd.isna(val) or val == '': return 0.0
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
    print("開始計算 (僅處理 BUY/SELL，配息全自動)...")
    try:
        df = pd.read_csv(SHEET_URL)
        df.columns = df.columns.str.strip()
        df['Date'] = pd.to_datetime(df['Date']).dt.normalize()
        df = df.sort_values('Date')
        
        for col in ['Comm', 'Tax', 'Qty', 'Price']:
            if col not in df.columns: df[col] = 0
            df[col] = df[col].fillna(0)
        if 'Tag' not in df.columns: df['Tag'] = 'Other'
        
    except Exception as e:
        print(f"Google Sheet 讀取失敗: {e}")
        return

    df = df[df['Symbol'].str.upper() != 'CASH'].copy()
    tickers = df['Symbol'].unique().tolist()
    if not tickers: return

    # 1. 下載數據
    start_date = df['Date'].min().strftime('%Y-%m-%d')
    market_data, fx_rates = get_market_data(tickers, start_date)

    # 2. 時間軸
    start_dt = df['Date'].min()
    end_dt = pd.Timestamp.now().normalize()
    all_dates = pd.date_range(start=start_dt, end=end_dt)

    # 3. 狀態變數
    holdings = {t: 0.0 for t in tickers}
    fifo_queue = {t: deque() for t in tickers}
    symbol_tags = {} 
    
    net_invested_twd = 0.0
    total_realized_pnl_twd = 0.0
    
    closed_positions = [] 
    ledger = []           
    history_data = []
    
    transactions_map = {}
    for date, group in df.groupby('Date'):
        transactions_map[date] = group.to_dict('records')

    prev_total_value_twd = 0.0
    twr_cumulative = 1.0
    
    # Benchmark
    spy_start_price_twd = 0
    if 'SPY' in market_data:
        try:
            p = market_data['SPY']['close'].asof(start_dt)
            r = get_rate(start_dt, fx_rates)
            if not pd.isna(p) and not pd.isna(r): spy_start_price_twd = p * r
        except: pass

    for current_date in all_dates:
        daily_rate = get_rate(current_date, fx_rates)
        daily_cash_flow_twd = 0.0
        date_str = current_date.strftime('%Y-%m-%d')

        # --- A. 自動配息處理 (Auto Dividend) ---
        # 邏輯：檢查今日是否除息，若持有則發放
        for sym, qty in holdings.items():
            if qty > 0.001 and sym in market_data:
                divs = market_data[sym]['dividends']
                stock_curr = market_data[sym]['currency']
                
                if current_date in divs.index:
                    div_per_share = divs.loc[current_date]
                    if div_per_share > 0:
                        gross_div = div_per_share * qty
                        
                        # 稅務處理
                        tax_rate = TAX_RATE_TW if stock_curr == 'TWD' else TAX_RATE_US
                        net_div = gross_div * (1 - tax_rate)
                        
                        # 換算 TWD
                        conversion = 1.0 if stock_curr == 'TWD' else daily_rate
                        net_div_twd = net_div * conversion
                        
                        # 入帳
                        net_invested_twd -= net_div_twd
                        daily_cash_flow_twd -= net_div_twd
                        total_realized_pnl_twd += net_div_twd
                        
                        entry = {
                            'date': date_str,
                            'symbol': sym,
                            'type': 'DIV_AUTO',
                            'qty': 0, 'price': 0,
                            'amount_twd': round(net_div_twd, 0),
                            'tag': symbol_tags.get(sym, 'Other'),
                            'note': f"自動配息 @ {round(div_per_share, 4)}"
                        }
                        # 加入紀錄
                        ledger.append(entry)
                        closed_positions.append({
                            **entry,
                            'pnl': entry['amount_twd'],
                            'type': 'DIVIDEND',
                            'close_date': date_str,
                            'buy_price': 0, 'sell_price': 0, 'pnl_percent': 0
                        })

        # --- B. 處理當日交易 (僅 BUY / SELL) ---
        if current_date in transactions_map:
            for tx in transactions_map[current_date]:
                symbol = tx['Symbol']
                action = tx['Type'].strip().upper()
                
                # 忽略非 BUY/SELL 的紀錄 (例如舊的手動配息)
                if action not in ['BUY', 'SELL']:
                    continue

                symbol_tags[symbol] = safe_str(tx.get('Tag', 'Other'))
                
                raw_qty = safe_float(tx['Qty'])
                raw_price = safe_float(tx['Price'])
                comm = safe_float(tx['Comm'])
                tax = safe_float(tx['Tax'])
                
                stock_currency = 'USD'
                if symbol in market_data: stock_currency = market_data[symbol]['currency']
                elif symbol.endswith('.TW') or symbol.endswith('.TWO'): stock_currency = 'TWD'
                
                tx_rate = 1.0 if stock_currency == 'TWD' else daily_rate
                
                # 拆股調整
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
                    fifo_queue[symbol].append({'qty': adj_qty, 'unit_cost': unit_cost_origin, 'rate_at_buy': tx_rate, 'raw_date': current_date})
                    
                    ledger.append({
                        'date': date_str, 'symbol': symbol, 'type': 'BUY',
                        'qty': round(adj_qty, 2), 'price': raw_price,
                        'amount_twd': round(-cost_twd, 0),
                        'tag': symbol_tags[symbol], 'note': '買入'
                    })
                    
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
                        
                        closed_positions.append({
                            'symbol': symbol, 'tag': symbol_tags[symbol],
                            'open_date': batch['raw_date'].strftime('%Y-%m-%d'),
                            'close_date': date_str,
                            'qty': round(sell_amt, 2),
                            'buy_price': round(batch['unit_cost'], 2),
                            'sell_price': round(revenue_origin_unit, 2),
                            'pnl': round(pnl_twd, 0),
                            'pnl_percent': round((pnl_twd/cost_twd_part)*100, 2) if cost_twd_part!=0 else 0,
                            'type': 'TRADE', 'currency': stock_currency
                        })
                        batch['qty'] -= sell_amt
                        qty_to_sell -= sell_amt
                        if batch['qty'] < 0.000001: fifo_queue[symbol].popleft()
                    
                    total_realized_pnl_twd += realized_pnl_tx
                    
                    ledger.append({
                        'date': date_str, 'symbol': symbol, 'type': 'SELL',
                        'qty': round(adj_qty, 2), 'price': raw_price,
                        'amount_twd': round(proceeds_twd, 0),
                        'tag': symbol_tags[symbol],
                        'note': f"獲利: {round(realized_pnl_tx,0)}"
                    })

        # --- C. 市值 ---
        market_val_twd = 0.0
        for sym, qty in holdings.items():
            if qty > 0.001:
                price = 0
                curr_sym_currency = 'USD'
                if sym in market_data:
                    curr_sym_currency = market_data[sym]['currency']
                    closes = market_data[sym]['close']
                    try:
                        if current_date in closes.index: price = closes.loc[current_date]
                        else: price = closes.asof(current_date)
                    except: pass
                if pd.isna(price): price = 0
                
                conversion = 1.0 if curr_sym_currency == 'TWD' else daily_rate
                market_val_twd += (price * qty * conversion)

        # --- D. TWR ---
        if prev_total_value_twd > 0:
            daily_return = (market_val_twd - daily_cash_flow_twd) / prev_total_value_twd - 1
        else:
            daily_return = 0.0
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

    # --- 整理 ---
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
            tag = symbol_tags.get(sym, 'Other')
            
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
            "realized_pnl": round(total_realized_pnl_twd, 0)
        },
        "holdings": final_holdings,
        "closed_positions": sorted(closed_positions, key=lambda x: x['close_date'], reverse=True),
        "ledger": sorted(ledger, key=lambda x: x['date'], reverse=True),
        "history": history_data,
        "allocation": { "tags": allocation_by_tag, "currency": allocation_by_currency }
    }

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
    print("更新完成 (配息全自動，手動DIV已忽略)")

if __name__ == "__main__":
    update_portfolio()
