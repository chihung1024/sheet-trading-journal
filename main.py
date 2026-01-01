import pandas as pd
import yfinance as yf
import json
import numpy as np
from datetime import datetime
from collections import deque, defaultdict

# --- 設定 ---
SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2Km74qaJt42zPpsQk2GCu2Bl9ATPNH9bllT6QyXxYps9i-r2RZcF10KKTTVAgm7PffGVe0zRDthLH/pub?gid=0&single=true&output=csv'
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
    all_tickers = list(set(tickers + ['SPY']))

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
    print("開始計算 (支援 Tag 歷史分拆)...")
    validation_messages = []

    try:
        df = pd.read_csv(SHEET_URL)
        df.columns = df.columns.str.strip()
        df['Date'] = pd.to_datetime(df['Date'], errors='coerce').dt.normalize()
        
        invalid_dates = df[df['Date'].isna()]
        if not invalid_dates.empty:
            for idx, row in invalid_dates.iterrows():
                validation_messages.append(f"⚠️ 行號 {idx+2}: 日期格式錯誤，已略過。")
        
        df = df.dropna(subset=['Date']).sort_values('Date')
        
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

    start_date = df['Date'].min().strftime('%Y-%m-%d')
    market_data, fx_rates = get_market_data(tickers, start_date)

    start_dt = df['Date'].min()
    end_dt = pd.Timestamp.now().normalize()
    all_dates = pd.date_range(start=start_dt, end=end_dt)

    holdings = {t: 0.0 for t in tickers}
    fifo_queue = {t: deque() for t in tickers}
    symbol_tags = {} 
    
    # 總體累計投入 (Net Invested)
    net_invested_twd = 0.0
    # 依 Tag 分類累計投入 (用於後續 TWR 計算)
    invested_by_tag = defaultdict(float)

    total_realized_pnl_twd = 0.0
    
    closed_positions = [] 
    ledger = []           
    history_data = [] # 這裡將存包含 breakdown 的詳細歷史
    
    transactions_map = {}
    for date, group in df.groupby('Date'):
        transactions_map[date] = group.to_dict('records')

    # SPY Benchmark 處理
    spy_start_price_twd = 0
    if 'SPY' in market_data:
        try:
            p = market_data['SPY']['close'].asof(start_dt)
            r = get_rate(start_dt, fx_rates)
            if not pd.isna(p) and not pd.isna(r): spy_start_price_twd = p * r
        except: pass

    # 前一日數據 (用於 TWR 鏈鎖計算 - 總體)
    prev_total_value = 0.0
    twr_cumulative = 1.0

    for current_date in all_dates:
        daily_rate = get_rate(current_date, fx_rates)
        date_str = current_date.strftime('%Y-%m-%d')
        
        # 當日現金流 (總體)
        daily_flow_total = 0.0

        # --- A. 自動配息 ---
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
                        
                        tag = symbol_tags.get(sym, 'Other')
                        net_invested_twd -= net_div_twd
                        invested_by_tag[tag] -= net_div_twd # Tag 現金流出 (配息視為回本)
                        daily_flow_total -= net_div_twd
                        
                        total_realized_pnl_twd += net_div_twd
                        
                        entry = {
                            'date': date_str, 'symbol': sym, 'type': 'DIV_AUTO',
                            'qty': 0, 'price': 0, 'amount_twd': round(net_div_twd, 0),
                            'tag': tag,
                            'note': f"自動配息 @ {round(div_per_share, 4)}"
                        }
                        ledger.append(entry)
                        closed_positions.append({
                            **entry, 'pnl': entry['amount_twd'], 'type': 'DIVIDEND',
                            'close_date': date_str, 'buy_price': 0, 'sell_price': 0, 'pnl_percent': 0
                        })

        # --- B. 交易處理 ---
        if current_date in transactions_map:
            for tx in transactions_map[current_date]:
                symbol = tx['Symbol']
                action = tx['Type'].strip().upper()
                if action not in ['BUY', 'SELL']: continue

                raw_qty = safe_float(tx['Qty'])
                raw_price = safe_float(tx['Price'])
                comm = safe_float(tx['Comm'])
                tax = safe_float(tx['Tax'])
                tag = safe_str(tx.get('Tag', 'Other'))
                symbol_tags[symbol] = tag

                stock_currency = 'USD'
                if symbol in market_data: stock_currency = market_data[symbol]['currency']
                elif symbol.endswith('.TW') or symbol.endswith('.TWO'): stock_currency = 'TWD'
                
                tx_rate = 1.0 if stock_currency == 'TWD' else daily_rate
                split_ratio = 1.0
                if symbol in market_data:
                    split_ratio = get_split_adjustment(current_date, market_data[symbol]['splits'])
                
                adj_qty = raw_qty * split_ratio
                
                if action == 'BUY':
                    cost_twd = ((raw_price * raw_qty) + comm) * tx_rate
                    
                    net_invested_twd += cost_twd
                    invested_by_tag[tag] += cost_twd # Tag 現金流入
                    daily_flow_total += cost_twd
                    
                    holdings[symbol] += adj_qty
                    unit_cost_origin = ((raw_price * raw_qty) + comm) / adj_qty if adj_qty > 0 else 0
                    fifo_queue[symbol].append({'qty': adj_qty, 'unit_cost': unit_cost_origin, 'rate_at_buy': tx_rate, 'raw_date': current_date})
                    
                    ledger.append({
                        'date': date_str, 'symbol': symbol, 'type': 'BUY',
                        'qty': round(adj_qty, 2), 'price': raw_price,
                        'amount_twd': round(-cost_twd, 0),
                        'tag': tag, 'note': '買入'
                    })
                    
                elif action == 'SELL':
                    proceeds_twd = ((raw_price * raw_qty) - comm - tax) * tx_rate
                    
                    net_invested_twd -= proceeds_twd
                    invested_by_tag[tag] -= proceeds_twd # Tag 現金流出
                    daily_flow_total -= proceeds_twd
                    
                    holdings[symbol] -= adj_qty
                    
                    # 實現損益計算 (FIFO)
                    qty_to_sell = adj_qty
                    realized_pnl_tx = 0
                    while qty_to_sell > 0.000001 and fifo_queue[symbol]:
                        batch = fifo_queue[symbol][0]
                        sell_amt = min(qty_to_sell, batch['qty'])
                        
                        cost_twd_part = (batch['unit_cost'] * batch['rate_at_buy']) * sell_amt
                        revenue_origin_unit = ((raw_price * raw_qty) - comm - tax) / raw_qty if raw_qty > 0 else 0
                        rev_twd_part = (revenue_origin_unit * tx_rate) * sell_amt
                        
                        pnl_twd = rev_twd_part - cost_twd_part
                        realized_pnl_tx += pnl_twd
                        
                        closed_positions.append({
                            'symbol': symbol, 'tag': tag,
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
                        'tag': tag, 'note': f"獲利: {round(realized_pnl_tx,0)}"
                    })

        # --- C. 市值計算 (按 Tag 分拆) ---
        total_market_val = 0.0
        # 結構: {'AI': 10000, '長期': 50000}
        current_mv_by_tag = defaultdict(float)
        
        for sym, qty in holdings.items():
            if qty > 0.001:
                price = 0
                sym_curr = 'USD'
                if sym in market_data:
                    sym_curr = market_data[sym]['currency']
                    closes = market_data[sym]['close']
                    try:
                        if current_date in closes.index: price = closes.loc[current_date]
                        else: price = closes.asof(current_date)
                    except: pass
                
                # 防呆: 無股價時用成本價
                if (pd.isna(price) or price == 0) and fifo_queue[sym]:
                    price = fifo_queue[sym][-1]['unit_cost']
                
                conversion = 1.0 if sym_curr == 'TWD' else daily_rate
                val_twd = price * qty * conversion
                
                total_market_val += val_twd
                tag = symbol_tags.get(sym, 'Other')
                current_mv_by_tag[tag] += val_twd

        # --- D. TWR 計算 (總體) ---
        # 這裡只算總體的 TWR，個別 Tag 的 TWR 留給前端動態計算 (因為前端可任意組合 Tag)
        # 公式: (End - Start - Flow) / (Start + Flow)
        # Flow 假設期初發生 (Simple Dietz 近似)，分母用 Start + Flow
        capital_base = prev_total_value + daily_flow_total
        daily_return = 0.0
        if capital_base > 0:
            daily_profit = total_market_val - capital_base
            daily_return = daily_profit / capital_base
            
        twr_cumulative *= (1 + daily_return)
        
        # SPY Benchmark
        bench_twr = 0.0
        if spy_start_price_twd > 0 and 'SPY' in market_data:
            try:
                p = market_data['SPY']['close'].asof(current_date)
                if not pd.isna(p):
                    curr_spy = p * daily_rate
                    bench_twr = (curr_spy / spy_start_price_twd) - 1
            except: pass

        # --- E. 儲存當日數據 (含 Breakdown) ---
        # 我們把每個 Tag 當下的 "Market Value" 和 "Invested Capital" 存下來
        # 前端就可以做加總: Sum(Selected Tags MV), Sum(Selected Tags Invested) -> Recompute TWR
        tags_snapshot = {}
        all_active_tags = set(list(current_mv_by_tag.keys()) + list(invested_by_tag.keys()))
        for t in all_active_tags:
            tags_snapshot[t] = {
                'mv': round(current_mv_by_tag[t], 0),
                'inv': round(invested_by_tag[t], 0)
            }

        history_data.append({
            "date": date_str,
            "total_value": round(total_market_val, 0),
            "invested": round(net_invested_twd, 0),
            "twr": round((twr_cumulative - 1) * 100, 2),
            "benchmark_twr": round(bench_twr * 100, 2),
            "tags": tags_snapshot  # 關鍵新增欄位
        })
        
        prev_total_value = total_market_val

    # --- 整理最終輸出 ---
    final_holdings = []
    allocation_by_tag = {}
    allocation_by_currency = {'TWD': 0, 'USD': 0}

    for sym, qty in holdings.items():
        if qty > 0.001:
            stock_cur = 'USD'
            curr_p = 0
            if sym in market_data:
                stock_cur = market_data[sym]['currency']
                try: curr_p = float(market_data[sym]['close'].iloc[-1])
                except: pass
            
            latest_rate = fx_rates.iloc[-1] if not fx_rates.empty else 32.0
            conversion = 1.0 if stock_cur == 'TWD' else latest_rate
            
            mkt_val = curr_p * qty * conversion
            tag = symbol_tags.get(sym, 'Other')
            
            # 成本計算
            batches = fifo_queue[sym]
            cost_val = sum((b['unit_cost'] * b['rate_at_buy']) * b['qty'] for b in batches)
            pnl = mkt_val - cost_val
            
            allocation_by_tag[tag] = allocation_by_tag.get(tag, 0) + mkt_val
            allocation_by_currency[stock_cur] = allocation_by_currency.get(stock_cur, 0) + mkt_val

            final_holdings.append({
                "symbol": sym, "tag": tag, "currency": stock_cur,
                "qty": round(qty, 2),
                "market_value_twd": round(mkt_val, 0),
                "pnl_twd": round(pnl, 0),
                "pnl_percent": round((pnl/cost_val)*100, 2) if cost_val!=0 else 0,
                "current_price_origin": round(curr_p, 2)
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
        "messages": validation_messages,
        "holdings": final_holdings,
        "closed_positions": sorted(closed_positions, key=lambda x: x['close_date'], reverse=True),
        "ledger": sorted(ledger, key=lambda x: x['date'], reverse=True),
        "history": history_data, # 這裡現在包含了 tags breakdown
        "allocation": { "tags": allocation_by_tag, "currency": allocation_by_currency }
    }

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
    print("更新完成 (含 Tag 歷史分拆)")

if __name__ == "__main__":
    update_portfolio()
