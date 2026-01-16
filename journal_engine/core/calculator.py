import pandas as pd
import numpy as np
from collections import deque
from datetime import datetime
from pyxirr import xirr
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, DividendRecord, PortfolioGroupData
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client):
        self.df = transactions_df
        self.market = market_client

    def run(self):
        """
        執行矩陣式投資組合計算主流程 (包含 XIRR 與 自動配息)
        """
        print("=== 開始執行多維度投資組合計算 ===")
        
        # 1. 全域復權處理 (只需做一次)
        self._back_adjust_transactions_global()
        
        # 2. 準備日期範圍
        if self.df.empty:
            start_date = datetime.now()
        else:
            start_date = self.df['Date'].min()
        
        # 計算到今天
        end_date = datetime.now()
        date_range = pd.date_range(start=start_date, end=end_date, freq='D').normalize()
        
        # 取得最新匯率
        current_fx = DEFAULT_FX_RATE
        if not self.market.fx_rates.empty:
            current_fx = float(self.market.fx_rates.iloc[-1])

        # 3. 識別所有群組
        unique_tags = set()
        for tags_str in self.df['Tag'].dropna().unique():
            if not tags_str: continue
            split_tags = [t.strip() for t in tags_str.replace(';', ',').split(',') if t.strip()]
            unique_tags.update(split_tags)
        
        target_groups = ['all'] + sorted(list(unique_tags))
        print(f"識別到的策略群組: {target_groups}")

        # 4. 迴圈計算每個群組
        groups_data = {}
        
        for group in target_groups:
            print(f"\n--- 計算群組視圖: {group} ---")
            
            # 篩選
            if group == 'all':
                group_df = self.df.copy()
            else:
                # 精確匹配標籤
                def has_tag(tag_str, target):
                    if not tag_str: return False
                    tags = [t.strip() for t in tag_str.replace(';', ',').split(',')]
                    return target in tags
                mask = self.df['Tag'].apply(lambda x: has_tag(x, group))
                group_df = self.df[mask].copy()
            
            if group_df.empty and group != 'all':
                continue

            # 執行單一群組計算 (核心邏輯)
            groups_data[group] = self._calculate_single_view(group_df, date_range, current_fx, group_name=group)

        # 5. 整合結果 (all 為主視圖)
        if 'all' in groups_data:
            all_view = groups_data['all']
        else:
            # 防呆：全空狀態
            empty_sum = PortfolioSummary(total_value=0, invested_capital=0, total_pnl=0, twr=0, xirr=0, realized_pnl=0, benchmark_twr=0)
            all_view = PortfolioGroupData(summary=empty_sum, holdings=[], history=[])
            groups_data['all'] = all_view

        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY,
            exchange_rate=round(current_fx, 2),
            # 頂層欄位 (Backward Compatibility)
            summary=all_view.summary,
            holdings=all_view.holdings,
            history=all_view.history,
            pending_dividends=all_view.pending_dividends,
            # 新增群組欄位
            groups=groups_data
        )

    def _back_adjust_transactions_global(self):
        """全域復權處理"""
        print("正在進行交易數據復權處理...")
        for index, row in self.df.iterrows():
            sym = row['Symbol']
            date = row['Date']
            if row['Type'] not in ['BUY', 'SELL']: continue
            
            split_factor = self.market.get_transaction_multiplier(sym, date)
            div_adj_factor = self.market.get_dividend_adjustment_factor(sym, date)
            
            if split_factor != 1.0 or div_adj_factor != 1.0:
                old_qty = row['Qty']
                old_price = row['Price']
                new_qty = old_qty * split_factor
                new_price = (old_price / split_factor) * div_adj_factor
                self.df.at[index, 'Qty'] = new_qty
                self.df.at[index, 'Price'] = new_price

    def _calculate_single_view(self, df, date_range, current_fx, group_name):
        """單一群組的核心計算邏輯 (融合 XIRR 與 Modified Dietz)"""
        # 初始化
        holdings = {} 
        fifo_queues = {}
        invested_capital = 0.0
        total_realized_pnl_twd = 0.0
        history_data = []
        
        # 配息相關
        dividend_history = []
        confirmed_dividends = set()
        
        # XIRR 相關
        xirr_cashflows = []
        
        # TWR 相關
        cumulative_twr_factor = 1.0
        prev_total_equity = 0.0
        
        # Benchmark
        benchmark_units = 0.0
        benchmark_invested = 0.0

        # 預掃描手動配息
        div_txs = df[df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            confirmed_dividends.add(key)

        # --- 逐日計算 ---
        for d in date_range:
            current_date = d.date()
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: fx = DEFAULT_FX_RATE
            
            # 處理交易
            daily_txns = df[df['Date'].dt.date == current_date]
            
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
                
                if tag: holdings[sym]['tag'] = tag # Update latest tag

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
                    
                    # Benchmark
                    spy_p = self.market.get_price('SPY', d)
                    if spy_p > 0:
                        benchmark_units += (cost_twd / fx) / spy_p
                        benchmark_invested += cost_twd

                elif txn_type == 'SELL':
                    proceeds_twd = ((qty * price) - comm - tax) * fx
                    holdings[sym]['qty'] -= qty
                    
                    # FIFO
                    remaining = qty
                    cost_sold_twd = 0.0
                    cost_sold_usd = 0.0
                    while remaining > 0 and fifo_queues[sym]:
                        batch = fifo_queues[sym][0]
                        take = min(remaining, batch['qty'])
                        frac = take / batch['qty']
                        cost_sold_usd += batch['cost_total_usd'] * frac
                        cost_sold_twd += batch['cost_total_twd'] * frac
                        batch['qty'] -= take
                        batch['cost_total_usd'] -= batch['cost_total_usd'] * frac
                        batch['cost_total_twd'] -= batch['cost_total_twd'] * frac
                        remaining -= take
                        if batch['qty'] < 1e-9: fifo_queues[sym].popleft()
                    
                    holdings[sym]['cost_basis_usd'] -= cost_sold_usd
                    holdings[sym]['cost_basis_twd'] -= cost_sold_twd
                    invested_capital -= cost_sold_twd
                    total_realized_pnl_twd += (proceeds_twd - cost_sold_twd)
                    xirr_cashflows.append({'date': d, 'amount': proceeds_twd})

                    # Benchmark
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
                if h_data['qty'] > 0.0001:
                    div_key = f"{sym}_{date_str}"
                    is_confirmed = div_key in confirmed_dividends
                    div_per_share = self.market.get_dividend(sym, d)
                    
                    if div_per_share > 0:
                        split_factor = self.market.get_transaction_multiplier(sym, d)
                        raw_qty = h_data['qty'] / split_factor
                        total_gross = raw_qty * div_per_share
                        total_net_usd = total_gross * 0.7
                        total_net_twd = total_net_usd * fx
                        
                        dividend_history.append({
                            'symbol': sym, 'ex_date': date_str, 'shares_held': h_data['qty'],
                            'dividend_per_share_gross': div_per_share, 'total_gross': total_gross,
                            'total_net_usd': total_net_usd, 'total_net_twd': total_net_twd,
                            'fx_rate': fx, 'status': 'confirmed' if is_confirmed else 'pending'
                        })
                        
                        if not is_confirmed:
                            total_realized_pnl_twd += total_net_twd
                            xirr_cashflows.append({'date': d, 'amount': total_net_twd})

            # 每日估值
            total_mkt_val = 0.0
            current_holdings_cost = 0.0
            for sym, h in holdings.items():
                if h['qty'] > 0.0001:
                    price = self.market.get_price(sym, d)
                    total_mkt_val += h['qty'] * price * fx
                    current_holdings_cost += h['cost_basis_twd']
            
            unrealized_pnl = total_mkt_val - current_holdings_cost
            total_pnl = unrealized_pnl + total_realized_pnl_twd
            current_total_equity = invested_capital + total_pnl
            
            # TWR (Modified Dietz 簡易版)
            prev_invested = history_data[-1]['invested'] if history_data else 0.0
            prev_pnl = history_data[-1]['net_profit'] if history_data else 0.0
            daily_net_inflow = invested_capital - prev_invested
            adjusted_start_equity = prev_total_equity + daily_net_inflow
            
            daily_return = 0.0
            if adjusted_start_equity > 0:
                daily_return = (total_pnl - prev_pnl) / adjusted_start_equity
            elif invested_capital > 0 and prev_total_equity == 0:
                daily_return = total_pnl / invested_capital
            
            cumulative_twr_factor *= (1 + daily_return)
            
            # Benchmark TWR
            bench_twr = 0.0
            spy_p = self.market.get_price('SPY', d)
            if spy_p > 0 and benchmark_invested > 0:
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

        # --- 產生最終報表 (包含 Modified Dietz 當日損益) ---
        final_holdings = []
        current_holdings_cost_sum = 0.0
        
        for sym, h in holdings.items():
            if h['qty'] > 0.001:
                stock_data = self.market.market_data.get(sym, pd.DataFrame())
                curr_p = 0.0
                prev_p = 0.0
                daily_change_usd = 0.0
                daily_change_percent = 0.0
                daily_pl_twd = 0.0
                
                if not stock_data.empty:
                    curr_p = float(stock_data.iloc[-1]['Close_Adjusted'])
                    if len(stock_data) >= 2:
                        prev_p = float(stock_data.iloc[-2]['Close_Adjusted'])
                        daily_change_usd = curr_p - prev_p
                        
                        # Modified Dietz 當日損益計算
                        latest_date = stock_data.index[-1]
                        prev_date = stock_data.index[-2]
                        # 取得對應匯率 (使用 current_fx 為今日)
                        curr_fx = current_fx
                        try:
                            prev_fx = self.market.fx_rates.asof(prev_date)
                            if pd.isna(prev_fx): prev_fx = curr_fx
                        except: prev_fx = curr_fx
                        
                        # 找出今日交易以計算現金流
                        today_txs = df[
                            (df['Symbol'] == sym) & 
                            (df['Date'].dt.date == latest_date.date())
                        ]
                        daily_qty_change = 0.0
                        daily_cashflow_twd = 0.0
                        for _, tx in today_txs.iterrows():
                            if tx['Type'] == 'BUY':
                                daily_qty_change += tx['Qty']
                                c_twd = (tx['Qty'] * tx['Price'] + tx['Commission'] + tx['Tax']) * curr_fx
                                daily_cashflow_twd += c_twd
                            elif tx['Type'] == 'SELL':
                                daily_qty_change -= tx['Qty']
                                p_twd = (tx['Qty'] * tx['Price'] - tx['Commission'] - tx['Tax']) * curr_fx
                                daily_cashflow_twd -= p_twd
                        
                        qty_start = h['qty'] - daily_qty_change
                        val_start = qty_start * prev_p * prev_fx
                        val_end = h['qty'] * curr_p * curr_fx
                        daily_pl_twd = val_end - val_start - daily_cashflow_twd
                        
                        denom = val_start + daily_cashflow_twd
                        if abs(denom) > 1e-9:
                            daily_change_percent = (daily_pl_twd / denom) * 100

                mkt_val = h['qty'] * curr_p * current_fx
                cost = h['cost_basis_twd']
                pnl = mkt_val - cost
                pnl_pct = (pnl / cost * 100) if cost > 0 else 0
                avg_cost_usd = h['cost_basis_usd'] / h['qty'] if h['qty'] > 0 else 0
                current_holdings_cost_sum += cost
                
                final_holdings.append(HoldingPosition(
                    symbol=sym, tag=group_name, currency="USD",
                    qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0),
                    pnl_twd=round(pnl, 0),
                    pnl_percent=round(pnl_pct, 2),
                    current_price_origin=round(curr_p, 2),
                    avg_cost_usd=round(avg_cost_usd, 2),
                    prev_close_price=round(prev_p, 2),
                    daily_change_usd=round(daily_change_usd, 2),
                    daily_change_percent=round(daily_change_percent, 2),
                    daily_pl_twd=round(daily_pl_twd, 0)
                ))
        
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        # XIRR 計算
        xirr_val = 0.0
        if xirr_cashflows:
            curr_val_sum = sum(h.market_value_twd for h in final_holdings)
            xirr_calc = xirr_cashflows.copy()
            xirr_calc.append({'date': datetime.now(), 'amount': curr_val_sum})
            try:
                # 去除金額為0的項目
                dates = [x['date'] for x in xirr_calc if abs(x['amount']) > 0]
                amts = [x['amount'] for x in xirr_calc if abs(x['amount']) > 0]
                if dates:
                    res = xirr(dates, amts)
                    if res: xirr_val = round(res * 100, 2)
            except: pass

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
