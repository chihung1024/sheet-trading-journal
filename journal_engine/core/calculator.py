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
        執行矩陣式投資組合計算主流程
        會針對 'all' 以及每個識別到的 Tag 分別進行獨立計算
        """
        print("=== 開始執行矩陣式投資組合計算 ===")
        
        # 1. 全域復權處理 (只需做一次，提升效率)
        # 這會直接修改 self.df 中的 Qty 與 Price 以反映拆股與除息
        self._back_adjust_transactions_global()
        
        # 2. 準備日期範圍與環境參數
        if self.df.empty:
            start_date = datetime.now()
        else:
            start_date = self.df['Date'].min()
            
        end_date = datetime.now()
        date_range = pd.date_range(start=start_date, end=end_date, freq='D').normalize()
        
        # 取得最新匯率供最後市值計算使用
        current_fx = DEFAULT_FX_RATE
        if not self.market.fx_rates.empty:
            current_fx = float(self.market.fx_rates.iloc[-1])

        # 3. 識別所有策略群組 (Tags)
        # 邏輯：掃描所有交易紀錄，依據逗號或分號分割，找出所有唯一的 Tag
        unique_tags = set()
        for tags_str in self.df['Tag'].dropna().unique():
            if not tags_str: continue
            # 支援逗號與分號分割，並去除空白
            split_tags = [t.strip() for t in tags_str.replace(';', ',').split(',') if t.strip()]
            unique_tags.update(split_tags)
        
        # 定義目標群組列表：總是包含 'all'，其餘按字母排序
        target_groups = ['all'] + sorted(list(unique_tags))
        print(f"識別到的策略群組: {target_groups}")

        # 4. 矩陣式運算 (針對每個群組獨立計算)
        groups_data = {}
        
        for group in target_groups:
            print(f"--- 計算群組視圖: {group} ---")
            
            # 篩選該群組的交易紀錄
            if group == 'all':
                # 'all' 群組包含所有交易
                group_df = self.df.copy()
            else:
                # 篩選 Tag 欄位包含該群組名的紀錄
                # 使用字串處理確保精確匹配 (例如 "AI" 不會匹配到 "PAIN")
                def has_tag(tag_str, target):
                    if not tag_str: return False
                    tags = [t.strip() for t in tag_str.replace(';', ',').split(',')]
                    return target in tags

                mask = self.df['Tag'].apply(lambda x: has_tag(x, group))
                group_df = self.df[mask].copy()
            
            if group_df.empty and group != 'all':
                continue

            # 呼叫核心計算邏輯，回傳該群組的完整數據
            groups_data[group] = self._calculate_single_view(group_df, date_range, current_fx, group_name=group)

        # 5. 整合結果並回傳
        # 為了向下相容，頂層欄位直接使用 'all' 的數據
        # 若完全無交易，給予預設空值
        if 'all' in groups_data:
            all_view = groups_data['all']
        else:
            # 建立空的預設資料
            empty_summary = PortfolioSummary(
                total_value=0, invested_capital=0, total_pnl=0, 
                twr=0, xirr=0, realized_pnl=0, benchmark_twr=0
            )
            all_view = PortfolioGroupData(summary=empty_summary, holdings=[], history=[])
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
            # 新增群組資料字典
            groups=groups_data
        )

    def _back_adjust_transactions_global(self):
        """全域復權處理：針對所有交易進行拆股與除息調整"""
        print("正在進行全域交易數據復權處理...")
        for index, row in self.df.iterrows():
            sym = row['Symbol']
            date_val = row['Date']
            if row['Type'] not in ['BUY', 'SELL']: continue
            
            # 從 MarketData Client 獲取乘數因子
            split_factor = self.market.get_transaction_multiplier(sym, date_val)
            div_adj_factor = self.market.get_dividend_adjustment_factor(sym, date_val)
            
            if split_factor != 1.0 or div_adj_factor != 1.0:
                old_qty = row['Qty']
                old_price = row['Price']
                
                # 調整邏輯：股數增加，價格降低
                new_qty = old_qty * split_factor
                # 價格需同時考慮拆股與除息調整
                new_price = (old_price / split_factor) * div_adj_factor
                
                self.df.at[index, 'Qty'] = new_qty
                self.df.at[index, 'Price'] = new_price

    def _calculate_single_view(self, df, date_range, current_fx, group_name):
        """
        針對單一群組的交易子集進行完整計算
        包含 FIFO 成本認定、已實現損益、TWR/XIRR 計算、每日淨值曲線等
        """
        # --- 初始化狀態變數 ---
        holdings = {} # {symbol: {'qty': float, 'cost_basis_usd': float, 'cost_basis_twd': float}}
        fifo_queues = {} # {symbol: deque([{'qty', 'price', 'cost_total_usd', 'cost_total_twd', 'date'}])}
        
        invested_capital = 0.0      # 目前投入本金 (TWD)
        total_realized_pnl_twd = 0.0 # 累積已實現損益 (TWD)
        
        history_data = []           # 每日歷史紀錄
        dividend_history = []       # 配息紀錄
        confirmed_dividends = set() # 用於去重自動配息
        xirr_cashflows = []         # XIRR 現金流 [(date, amount)]
        
        # Benchmark 相關
        benchmark_units = 0.0
        benchmark_invested = 0.0
        
        # TWR 相關
        cumulative_twr_factor = 1.0
        prev_total_equity = 0.0

        # --- 預掃描已記錄的配息 (防止重複計算自動配息) ---
        div_txs = df[df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            confirmed_dividends.add(key)

        # --- 每日迭代計算 ---
        for d in date_range:
            current_date = d.date()
            
            # 取得當日匯率 (若無數據則沿用預設)
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: 
                fx = DEFAULT_FX_RATE
            
            # 篩選當日交易
            daily_txns = df[df['Date'].dt.date == current_date]
            
            # 1. 處理當日交易
            for _, row in daily_txns.iterrows():
                sym = row['Symbol']
                qty = row['Qty']
                price = row['Price']
                comm = row['Commission']
                tax = row['Tax']
                txn_type = row['Type']

                if sym not in holdings:
                    holdings[sym] = {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0}
                    fifo_queues[sym] = deque()
                
                if txn_type == 'BUY':
                    cost_usd = (qty * price) + comm + tax
                    cost_twd = cost_usd * fx
                    
                    holdings[sym]['qty'] += qty
                    holdings[sym]['cost_basis_usd'] += cost_usd
                    holdings[sym]['cost_basis_twd'] += cost_twd
                    
                    # 加入 FIFO 佇列
                    fifo_queues[sym].append({
                        'qty': qty, 
                        'price': price, 
                        'cost_total_usd': cost_usd, 
                        'cost_total_twd': cost_twd, 
                        'date': d
                    })
                    
                    invested_capital += cost_twd
                    xirr_cashflows.append({'date': d, 'amount': -cost_twd}) # 現金流出
                    
                    # Benchmark 買入 (SPY)
                    spy_p = self.market.get_price('SPY', d)
                    if spy_p > 0:
                        benchmark_units += (cost_twd / fx) / spy_p
                        benchmark_invested += cost_twd

                elif txn_type == 'SELL':
                    proceeds_twd = ((qty * price) - comm - tax) * fx
                    
                    # FIFO 扣抵邏輯
                    remaining = qty
                    cost_sold_twd = 0.0
                    cost_sold_usd = 0.0
                    
                    while remaining > 0 and fifo_queues[sym]:
                        batch = fifo_queues[sym][0]
                        take = min(remaining, batch['qty'])
                        
                        # 按比例計算成本
                        frac = take / batch['qty']
                        cost_sold_usd += batch['cost_total_usd'] * frac
                        cost_sold_twd += batch['cost_total_twd'] * frac
                        
                        # 更新佇列
                        batch['qty'] -= take
                        batch['cost_total_usd'] -= batch['cost_total_usd'] * frac
                        batch['cost_total_twd'] -= batch['cost_total_twd'] * frac
                        remaining -= take
                        
                        if batch['qty'] < 1e-9: # 浮點數容錯
                            fifo_queues[sym].popleft()
                    
                    # 若庫存不足 (賣空或資料錯誤)，剩餘部分的成本視為 0
                    if remaining > 0:
                        print(f"Warning: [Group {group_name}] Oversold {sym} by {remaining:.4f}")

                    # 更新持倉狀態
                    holdings[sym]['qty'] -= qty
                    holdings[sym]['cost_basis_usd'] -= cost_sold_usd
                    holdings[sym]['cost_basis_twd'] -= cost_sold_twd
                    
                    invested_capital -= cost_sold_twd
                    total_realized_pnl_twd += (proceeds_twd - cost_sold_twd)
                    xirr_cashflows.append({'date': d, 'amount': proceeds_twd}) # 現金流入

                    # Benchmark 賣出
                    if benchmark_units > 0 and benchmark_invested > 0:
                        ratio = cost_sold_twd / benchmark_invested
                        benchmark_units -= benchmark_units * ratio
                        benchmark_invested -= cost_sold_twd

                elif txn_type == 'DIV':
                    net_div_twd = price * fx # DIV 類型中 Price 欄位代表總金額
                    total_realized_pnl_twd += net_div_twd
                    xirr_cashflows.append({'date': d, 'amount': net_div_twd})

            # 2. 處理自動配息 (Auto Dividends)
            date_str = d.strftime('%Y-%m-%d')
            for sym, h_data in holdings.items():
                if h_data['qty'] > 0.0001:
                    # 檢查該日是否有配息
                    div_per_share = self.market.get_dividend(sym, d)
                    
                    if div_per_share > 0:
                        div_key = f"{sym}_{date_str}"
                        is_confirmed = div_key in confirmed_dividends
                        
                        # 計算配息金額
                        # 注意：需考慮當下的拆股狀態，還原原始股數來計算
                        split_factor = self.market.get_transaction_multiplier(sym, d)
                        raw_qty = h_data['qty'] / split_factor
                        
                        total_gross = raw_qty * div_per_share
                        total_net_usd = total_gross * 0.7 # 預扣 30% 稅
                        total_net_twd = total_net_usd * fx
                        
                        # 記錄配息
                        dividend_history.append({
                            'symbol': sym, 
                            'ex_date': date_str, 
                            'shares_held': h_data['qty'],
                            'dividend_per_share_gross': div_per_share, 
                            'total_gross': total_gross,
                            'total_net_usd': total_net_usd, 
                            'total_net_twd': total_net_twd,
                            'fx_rate': fx, 
                            'status': 'confirmed' if is_confirmed else 'pending'
                        })
                        
                        # 若非手動輸入的配息，則計入 PnL 與現金流
                        if not is_confirmed:
                            total_realized_pnl_twd += total_net_twd
                            xirr_cashflows.append({'date': d, 'amount': total_net_twd})

            # 3. 每日資產估值 (Mark to Market)
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
            
            # 4. TWR (Time-Weighted Return) 計算
            # 每日報酬率 = (期末淨值 - 期初淨值 - 淨現金流) / (期初淨值 + 淨現金流)
            # 這裡簡化計算：(當日總盈虧 - 昨日總盈虧) / (昨日總權益 + 本日淨投入)
            
            prev_pnl = history_data[-1]['net_profit'] if history_data else 0.0
            daily_net_inflow = invested_capital - (history_data[-1]['invested'] if history_data else 0.0)
            
            adjusted_start_equity = prev_total_equity + daily_net_inflow
            
            daily_return = 0.0
            if adjusted_start_equity > 0:
                daily_return = (total_pnl - prev_pnl) / adjusted_start_equity
            elif invested_capital > 0 and prev_total_equity == 0:
                # 第一天或重新投入
                daily_return = total_pnl / invested_capital
            
            cumulative_twr_factor *= (1 + daily_return)
            
            # 5. Benchmark TWR 計算
            bench_twr = 0.0
            spy_p = self.market.get_price('SPY', d)
            if spy_p > 0 and benchmark_invested > 0:
                bench_val = benchmark_units * spy_p * fx
                bench_twr = ((bench_val - benchmark_invested) / benchmark_invested) * 100

            prev_total_equity = current_total_equity
            
            # 儲存歷史數據
            history_data.append({
                "date": date_str,
                "total_value": round(total_mkt_val, 0),
                "invested": round(invested_capital, 0),
                "net_profit": round(total_pnl, 0),
                "twr": round((cumulative_twr_factor - 1) * 100, 2),
                "benchmark_twr": round(bench_twr, 2),
                "fx_rate": round(fx, 4)
            })

        # --- 迴圈結束，產生最終報表 ---
        final_holdings = []
        current_holdings_cost_sum = 0.0
        
        for sym, h in holdings.items():
            if h['qty'] > 0.001:
                # 獲取最新行情
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
                        
                        # 簡易估算當日損益
                        mkt_val_now = h['qty'] * curr_p * current_fx
                        mkt_val_prev = h['qty'] * prev_p * current_fx
                        daily_pl_twd = mkt_val_now - mkt_val_prev
                
                mkt_val = h['qty'] * curr_p * current_fx
                cost = h['cost_basis_twd']
                pnl = mkt_val - cost
                pnl_pct = (pnl / cost * 100) if cost > 0 else 0
                avg_cost_usd = h['cost_basis_usd'] / h['qty'] if h['qty'] > 0 else 0
                
                current_holdings_cost_sum += cost
                
                final_holdings.append(HoldingPosition(
                    symbol=sym, 
                    tag=group_name, # 標記此持倉是基於哪個群組視角計算的
                    currency="USD",
                    qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0),
                    pnl_twd=round(pnl, 0),
                    pnl_percent=round(pnl_pct, 2),
                    current_price_origin=round(curr_p, 2),
                    avg_cost_usd=round(avg_cost_usd, 2),
                    prev_close_price=round(prev_p, 2),
                    daily_change_usd=round(daily_change_usd, 2),
                    daily_change_percent=0.0, # 可視需要補充計算
                    daily_pl_twd=round(daily_pl_twd, 0)
                ))
        
        # 持倉排序 (按市值高低)
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        # XIRR 最終計算
        xirr_val = 0.0
        if xirr_cashflows:
            curr_val_sum = sum(h.market_value_twd for h in final_holdings)
            # 加入期末現值作為最後一筆現金流
            xirr_cashflows_calc = xirr_cashflows.copy()
            xirr_cashflows_calc.append({'date': datetime.now(), 'amount': curr_val_sum})
            try:
                xirr_res = xirr(
                    [x['date'] for x in xirr_cashflows_calc], 
                    [x['amount'] for x in xirr_cashflows_calc]
                )
                if xirr_res is not None:
                    xirr_val = round(xirr_res * 100, 2)
            except: 
                pass

        # 彙總摘要
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
