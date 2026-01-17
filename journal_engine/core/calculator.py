import pandas as pd
import numpy as np
from collections import deque
from datetime import datetime, timedelta
from pyxirr import xirr
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, DividendRecord, PortfolioGroupData
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client):
        self.df = transactions_df
        self.market = market_client

    def run(self):
        """執行多群組投資組合計算主流程"""
        print("=== 開始執行多群組投資組合計算 ===")
        
        # 1. 全域復權處理 (只做一次)
        self._back_adjust_transactions_global()
        
        # 2. 準備日期範圍
        start_date = self.df['Date'].min()
        end_date = datetime.now()
        date_range = pd.date_range(start=start_date, end=end_date, freq='D').normalize()
        
        # 取得最新匯率
        current_fx = DEFAULT_FX_RATE
        if not self.market.fx_rates.empty:
            current_fx = float(self.market.fx_rates.iloc[-1])
        
        # 3. 識別所有群組
        all_tags = set()
        for tags_str in self.df['Tag'].dropna().unique():
            if not tags_str: 
                continue
            split_tags = [t.strip() for t in tags_str.replace(';', ',').split(',') if t.strip()]
            all_tags.update(split_tags)
        
        groups_to_calc = ['all'] + sorted(list(all_tags))
        print(f"識別到的群組: {groups_to_calc}")

        # 4. 迴圈計算每個群組
        final_groups_data = {}
        
        for group_name in groups_to_calc:
            print(f"\n--- 計算群組: {group_name} ---")
            
            # 篩選該群組的交易紀錄
            if group_name == 'all':
                group_df = self.df.copy()
            else:
                mask = self.df['Tag'].apply(
                    lambda x: group_name in [t.strip() for t in (x or '').replace(';', ',').split(',')]
                )
                group_df = self.df[mask].copy()
            
            if group_df.empty:
                print(f"群組 {group_name} 無交易紀錄，跳過")
                continue

            # 執行單一群組計算
            group_result = self._calculate_single_portfolio(group_df, date_range, current_fx)
            final_groups_data[group_name] = group_result

        # 5. 組合最終結果 (all 放在頂層以相容舊版)
        all_data = final_groups_data.get('all')
        
        if not all_data:
            print("警告: 無 'all' 群組數據")
            return None
        
        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY,
            exchange_rate=round(current_fx, 2),
            # 頂層欄位 (Backward Compatibility)
            summary=all_data.summary,
            holdings=all_data.holdings,
            history=all_data.history,
            pending_dividends=all_data.pending_dividends,
            # 新增群組欄位
            groups=final_groups_data
        )

    def _back_adjust_transactions_global(self):
        """全域復權處理"""
        print("正在進行全域交易數據復權處理...")
        for index, row in self.df.iterrows():
            sym = row['Symbol']
            date = row['Date']
            if row['Type'] not in ['BUY', 'SELL']: 
                continue
            
            split_factor = self.market.get_transaction_multiplier(sym, date)
            div_adj_factor = self.market.get_dividend_adjustment_factor(sym, date)
            
            if split_factor != 1.0 or div_adj_factor != 1.0:
                old_qty = row['Qty']
                old_price = row['Price']
                new_qty = old_qty * split_factor
                new_price = (old_price / split_factor) * div_adj_factor
                self.df.at[index, 'Qty'] = new_qty
                self.df.at[index, 'Price'] = new_price

    def _calculate_single_portfolio(self, df, date_range, current_fx):
        """單一群組的核心計算邏輯"""
        # 初始化狀態變數
        holdings = {}
        fifo_queues = {}
        invested_capital = 0.0
        total_realized_pnl_twd = 0.0
        history_data = []
        confirmed_dividends = set()
        dividend_history = []
        xirr_cashflows = []
        benchmark_units = 0.0
        benchmark_invested = 0.0
        cumulative_twr_factor = 1.0
        prev_total_equity = 0.0

        # 預掃描配息
        div_txs = df[df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            confirmed_dividends.add(key)

        # 逐日計算
        for d in date_range:
            current_date = d.date()
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): 
                    fx = DEFAULT_FX_RATE
            except: 
                fx = DEFAULT_FX_RATE
            
            # --- 優化點：同一日期內的處理順序 ---
            daily_txns = df[df['Date'].dt.date == current_date].copy()
            if not daily_txns.empty:
                priority_map = {'BUY': 1, 'DIV': 2, 'SELL': 3}
                daily_txns['priority'] = daily_txns['Type'].map(priority_map).fillna(99)
                daily_txns = daily_txns.sort_values(by='priority', kind='stable')
            
            for _, row in daily_txns.iterrows():
                sym = row['Symbol']
                qty = row['Qty']
                price = row['Price']
                comm = row['Commission']
                tax = row['Tax']
                txn_type = row['Type']
                tag = row['Tag']

                if sym not in holdings:
                    holdings[sym] = {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': tag}
                    fifo_queues[sym] = deque()
                
                if tag: 
                    holdings[sym]['tag'] = tag

                if txn_type == 'BUY':
                    cost_usd = (qty * price) + comm + tax
                    cost_twd = cost_usd * fx
                    holdings[sym]['qty'] += qty
                    holdings[sym]['cost_basis_usd'] += cost_usd
                    holdings[sym]['cost_basis_twd'] += cost_twd
                    fifo_queues[sym].append({
                        'qty': qty, 'price': price, 'cost_total_usd': cost_usd, 
                        'cost_total_twd': cost_twd, 'date': d
                    })
                    invested_capital += cost_twd
                    xirr_cashflows.append({'date': d, 'amount': -cost_twd})
                    
                    spy_p = self.market.get_price('SPY', d)
                    if spy_p > 0:
                        benchmark_units += (cost_twd / fx) / spy_p
                        benchmark_invested += cost_twd

                elif txn_type == 'SELL':
                    # --- 核心優化點：強化 FIFO 引擎 (三) ---
                    # 1. 檢查是否有庫存可供賣出，避免程式崩溃
                    if sym not in fifo_queues or not fifo_queues[sym]:
                        print(f"警告: {sym} 在 {current_date} 嘗試賣出但無買入紀錄，跳過此筆。")
                        continue

                    proceeds_twd = ((qty * price) - comm - tax) * fx
                    
                    remaining = qty
                    cost_sold_twd = 0.0
                    cost_sold_usd = 0.0
                    
                    while remaining > 1e-6 and fifo_queues[sym]:
                        batch = fifo_queues[sym][0]
                        take = min(remaining, batch['qty'])
                        frac = take / batch['qty']
                        
                        cost_sold_usd += batch['cost_total_usd'] * frac
                        cost_sold_twd += batch['cost_total_twd'] * frac
                        
                        batch['qty'] -= take
                        batch['cost_total_usd'] -= batch['cost_total_usd'] * frac
                        batch['cost_total_twd'] -= batch['cost_total_twd'] * frac
                        
                        remaining -= take
                        
                        # 2. 處理浮點數殘值，若批次剩餘股數極小則彈出
                        if batch['qty'] < 1e-6: 
                            fifo_queues[sym].popleft()
                    
                    # 更新持倉數據
                    holdings[sym]['qty'] -= (qty - remaining) # 實際扣除成功的部分
                    holdings[sym]['cost_basis_usd'] -= cost_sold_usd
                    holdings[sym]['cost_basis_twd'] -= cost_sold_twd
                    invested_capital -= cost_sold_twd
                    total_realized_pnl_twd += (proceeds_twd - cost_sold_twd)
                    xirr_cashflows.append({'date': d, 'amount': proceeds_twd})

                    if benchmark_units > 0:
                        ratio = cost_sold_twd / benchmark_invested if benchmark_invested > 0 else 0
                        benchmark_units -= benchmark_units * ratio
                        benchmark_invested -= cost_sold_twd

                elif txn_type == 'DIV':
                    net_div_twd = price * fx
                    total_realized_pnl_twd += net_div_twd
                    xirr_cashflows.append({'date': d, 'amount': net_div_twd})

            # 處理自動配息
            date_str = d.strftime('%Y-%m-%d')
            for sym, h_data in holdings.items():
                if h_data['qty'] > 1e-6:
                    div_key = f"{sym}_{date_str}"
                    is_confirmed = div_key in confirmed_dividends
                    div_per_share = self.market.get_dividend(sym, d)
                    
                    if div_per_share > 0:
                        split_factor = self.market.get_transaction_multiplier(sym, d)
                        raw_qty = h_data['qty'] / split_factor
                        total_gross = raw_qty * div_per_share
                        total_net_twd = total_gross * 0.7 * fx
                        
                        dividend_history.append({
                            'symbol': sym, 'ex_date': date_str, 'shares_held': h_data['qty'],
                            'dividend_per_share_gross': div_per_share, 'total_gross': total_gross,
                            'total_net_usd': total_gross * 0.7, 'total_net_twd': total_net_twd,
                            'fx_rate': fx, 'status': 'confirmed' if is_confirmed else 'pending'
                        })
                        
                        if not is_confirmed:
                            total_realized_pnl_twd += total_net_twd
                            xirr_cashflows.append({'date': d, 'amount': total_net_twd})

            # 每日估值
            total_mkt_val = 0.0
            current_holdings_cost = 0.0
            for sym, h in holdings.items():
                if h['qty'] > 1e-6:
                    price = self.market.get_price(sym, d)
                    total_mkt_val += h['qty'] * price * fx
                    current_holdings_cost += h['cost_basis_twd']
            
            unrealized_pnl = total_mkt_val - current_holdings_cost
            total_pnl = unrealized_pnl + total_realized_pnl_twd
            current_total_equity = invested_capital + total_pnl
            
            # --- 優化點：績效精準度優化 (二) - 已保留 ---
            prev_invested = history_data[-1]['invested'] if history_data else 0.0
            prev_pnl = history_data[-1]['net_profit'] if history_data else 0.0
            daily_net_inflow = invested_capital - prev_invested
            adjusted_start_equity = prev_total_equity + daily_net_inflow
            
            daily_return = 0.0
            if adjusted_start_equity > 1.0:
                daily_return = (total_pnl - prev_pnl) / adjusted_start_equity
            elif invested_capital > 1.0 and prev_total_equity < 1.0:
                daily_return = total_pnl / invested_capital
            
            cumulative_twr_factor *= (1 + daily_return)
            
            bench_twr = 0.0
            spy_p = self.market.get_price('SPY', d)
            if spy_p > 0 and benchmark_invested > 1.0:
                bench_val = benchmark_units * spy_p * fx
                bench_twr = ((bench_val - benchmark_invested) / benchmark_invested) * 100

            prev_total_equity = current_total_equity
            
            history_data.append({
                "date": date_str,
                "total_value": round(total_mkt_val, 0),
                "invested": round(invested_capital, 0),
                "net_profit": round(total_pnl, 0),
                "twr": round((cumulative_twr_factor - 1) * 100, 2),
                "benchmark_twr": round(bench_twr, 2),
                "fx_rate": round(fx, 4)
            })

        # 產生最終報表
        final_holdings = []
        current_holdings_cost_sum = 0.0
        current_date = datetime.now()
        
        for sym, h in holdings.items():
            if h['qty'] > 1e-4:
                stock_data = self.market.market_data.get(sym, pd.DataFrame())
                curr_p = 0.0
                prev_p = 0.0
                daily_change_usd = 0.0
                daily_pl_twd = 0.0
                
                if not stock_data.empty:
                    curr_p = float(stock_data.iloc[-1]['Close_Adjusted'])
                    if len(stock_data) >= 2:
                        prev_p = float(stock_data.iloc[-2]['Close_Adjusted'])
                        daily_change_usd = curr_p - prev_p
                        
                        try:
                            prev_fx = self.market.fx_rates.asof(stock_data.index[-2])
                            if pd.isna(prev_fx): prev_fx = current_fx
                        except:
                            prev_fx = current_fx
                        
                        beginning_market_value_twd = h['qty'] * prev_p * prev_fx
                        ending_market_value_twd = h['qty'] * curr_p * current_fx
                        daily_pl_twd = ending_market_value_twd - beginning_market_value_twd
                
                mkt_val = h['qty'] * curr_p * current_fx
                cost = h['cost_basis_twd']
                pnl = mkt_val - cost
                pnl_pct = (pnl / cost * 100) if cost > 0 else 0
                avg_cost_usd = h['cost_basis_usd'] / h['qty'] if h['qty'] > 0 else 0
                current_holdings_cost_sum += cost
                
                final_holdings.append(HoldingPosition(
                    symbol=sym, tag=h['tag'], currency="USD",
                    qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0),
                    pnl_twd=round(pnl, 0),
                    pnl_percent=round(pnl_pct, 2),
                    current_price_origin=round(curr_p, 2),
                    avg_cost_usd=round(avg_cost_usd, 2),
                    prev_close_price=round(prev_p, 2),
                    daily_change_usd=round(daily_change_usd, 2),
                    daily_change_percent=0.0,
                    daily_pl_twd=round(daily_pl_twd, 0)
                ))
        
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        # XIRR 計算
        xirr_val = 0.0
        if xirr_cashflows:
            curr_val_sum = sum(h.market_value_twd for h in final_holdings)
            xirr_cashflows_calc = xirr_cashflows.copy()
            xirr_cashflows_calc.append({'date': current_date, 'amount': curr_val_sum})
            try:
                xirr_res = xirr([x['date'] for x in xirr_cashflows_calc], [x['amount'] for x in xirr_cashflows_calc])
                xirr_val = round(xirr_res * 100, 2)
            except: 
                pass

        summary = PortfolioSummary(
            total_value=round(sum(h.market_value_twd for h in final_holdings), 0),
            invested_capital=round(current_holdings_cost_sum, 0),
            total_pnl=round((sum(h.market_value_twd for h in final_holdings) - current_holdings_cost_sum) + total_realized_pnl_twd, 0),
            twr=history_data[-1]['twr'] if history_data else 0,
            xirr=xirr_val,
            realized_pnl=round(total_realized_pnl_twd, 0),
            benchmark_twr=history_data[-1]['benchmark_twr'] if history_data else 0
        )
        
        return PortfolioGroupData(
            summary=summary,
            holdings=final_holdings,
            history=history_data,
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d['status']=='pending']
        )
