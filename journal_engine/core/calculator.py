import pandas as pd
import numpy as np
from collections import deque
from datetime import datetime
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, ClosedPosition, ClosedLot
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client):
        self.df = transactions_df
        self.market = market_client
        
        # === 狀態儲存 ===
        self.holdings = {}  # 當前持倉狀態
        
        # FIFO 佇列: 對應舊專案的 inventory 概念
        # 結構: { 'AAPL': deque([ {qty, price, cost_total_twd, date, original_date} ]) }
        self.fifo_queues = {}
        
        # 平倉數據儲存
        self.closed_positions_data = {} # { 'AAPL': { 'lots': [], 'total_pnl': 0, ... } }
        
        self.invested_capital = 0.0
        self.total_realized_pnl_twd = 0.0
        
        # 報表歷史
        self.history_data = []
        self.benchmark_units = 0.0
        self.benchmark_invested = 0.0
        
        # TWR 計算用
        self.cumulative_twr_factor = 1.0
        self.prev_total_equity = 0.0

    def run(self):
        print(">>> [系統] 啟動 FIFO 計算引擎 (移植階段 2)...")
        
        # 1. 復權處理 (維持不變)
        self._back_adjust_transactions()
        
        # 2. 建立時間軸
        start_date = self.df['Date'].min()
        end_date = datetime.now()
        date_range = pd.date_range(start=start_date, end=end_date, freq='D').normalize()
        
        # 3. 逐日回測
        for d in date_range:
            current_date = d.date()
            
            # 獲取匯率
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: fx = DEFAULT_FX_RATE
            
            # 處理當日交易
            daily_txns = self.df[self.df['Date'].dt.date == current_date]
            for _, row in daily_txns.iterrows():
                self._process_transaction(row, fx, d)
            
            # 每日估值
            self._daily_valuation(d, fx)
        
        return self._generate_final_output(fx)

    def _back_adjust_transactions(self):
        """復權邏輯：處理拆股與配息導致的價格/股數變化"""
        for index, row in self.df.iterrows():
            sym = row['Symbol']
            if row['Type'] not in ['BUY', 'SELL']: continue
            
            # 從 MarketDataClient 獲取因子
            split_factor = self.market.get_transaction_multiplier(sym, row['Date'])
            div_adj_factor = self.market.get_dividend_adjustment_factor(sym, row['Date'])
            
            if split_factor != 1.0 or div_adj_factor != 1.0:
                old_qty = row['Qty']
                old_price = row['Price']
                # 調整：股數變多，價格變低
                self.df.at[index, 'Qty'] = old_qty * split_factor
                self.df.at[index, 'Price'] = (old_price / split_factor) * div_adj_factor

    def _process_transaction(self, row, fx, date_ts):
        sym = row['Symbol']
        qty = row['Qty']
        price = row['Price']
        comm = row['Commission']
        tax = row['Tax']
        txn_type = row['Type']
        tag = row['Tag']
        
        # 初始化該標的的資料結構
        if sym not in self.holdings:
            self.holdings[sym] = {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': tag}
            self.fifo_queues[sym] = deque()
            self.closed_positions_data[sym] = {'lots': [], 'total_pnl': 0.0}
        
        if tag: self.holdings[sym]['tag'] = tag

        if txn_type == 'BUY':
            cost_usd = (qty * price) + comm + tax
            cost_twd = cost_usd * fx
            
            self.holdings[sym]['qty'] += qty
            self.holdings[sym]['cost_basis_usd'] += cost_usd
            self.holdings[sym]['cost_basis_twd'] += cost_twd
            self.invested_capital += cost_twd
            
            # === FIFO 入列 ===
            self.fifo_queues[sym].append({
                'qty': qty, 
                'price': price, 
                'cost_total_twd': cost_twd,
                'date': date_ts, # 這是復權後的買入日期
                'original_date': date_ts # 原始日期
            })
            self._trade_benchmark(date_ts, cost_twd, fx, is_buy=True)

        elif txn_type == 'SELL':
            # 賣出總收入 (扣除費用)
            proceeds_twd = ((qty * price) - comm - tax) * fx
            self.holdings[sym]['qty'] -= qty
            
            remaining_sell_qty = qty
            accumulated_cost_twd = 0.0
            
            # === FIFO 出列與平倉計算 (移植核心) ===
            while remaining_sell_qty > 0.000001 and self.fifo_queues[sym]:
                batch = self.fifo_queues[sym][0] # 取得最早的一筆買入
                
                # 決定這批要扣掉多少股
                matched_qty = min(remaining_sell_qty, batch['qty'])
                
                # 計算這批股票佔該次買入的成本比例
                frac = matched_qty / batch['qty']
                batch_cost_twd = batch['cost_total_twd'] * frac
                
                accumulated_cost_twd += batch_cost_twd
                
                # 記錄平倉詳細數據 (Lot)
                buy_date = batch['original_date']
                sell_date = date_ts
                holding_days = (sell_date - buy_date).days
                
                # 該批次的收入 (按比例分配總收入)
                lot_proceeds = proceeds_twd * (matched_qty / qty)
                lot_pnl = lot_proceeds - batch_cost_twd
                
                # 存入 Closed Lots
                self.closed_positions_data[sym]['lots'].append({
                    'open_date': buy_date.strftime('%Y-%m-%d'),
                    'close_date': sell_date.strftime('%Y-%m-%d'),
                    'qty': matched_qty,
                    'entry_price': batch_cost_twd / matched_qty, # 平均成本
                    'exit_price': lot_proceeds / matched_qty,   # 平均售價
                    'cost_basis': batch_cost_twd,
                    'proceeds': lot_proceeds,
                    'realized_pnl': lot_pnl,
                    'holding_days': holding_days,
                    'return_rate': (lot_pnl / batch_cost_twd * 100) if batch_cost_twd != 0 else 0
                })
                self.closed_positions_data[sym]['total_pnl'] += lot_pnl

                # 更新 FIFO 狀態
                batch['qty'] -= matched_qty
                batch['cost_total_twd'] -= batch_cost_twd
                remaining_sell_qty -= matched_qty
                
                # 如果這批賣光了，從佇列移除
                if batch['qty'] < 0.000001:
                    self.fifo_queues[sym].popleft()
            
            # 更新總帳
            # 注意：這裡簡單扣除比例成本，保持總帳平衡
            self.holdings[sym]['cost_basis_twd'] -= accumulated_cost_twd
            self.holdings[sym]['cost_basis_usd'] -= (accumulated_cost_twd / fx) 
            self.invested_capital -= accumulated_cost_twd
            self.total_realized_pnl_twd += (proceeds_twd - accumulated_cost_twd)
            
            self._trade_benchmark(date_ts, proceeds_twd, fx, is_buy=False, realized_cost_twd=accumulated_cost_twd)

        elif txn_type == 'DIV':
            # 簡易配息處理 (下一階段會升級)
            net_div_twd = price * fx
            self.total_realized_pnl_twd += net_div_twd

    def _daily_valuation(self, date_ts, fx):
        # 計算當日市值
        total_mkt_val = 0.0
        for sym, h in self.holdings.items():
            if h['qty'] > 0.0001:
                price = self.market.get_price(sym, date_ts)
                total_mkt_val += h['qty'] * price * fx
        
        # 總權益 = 已實現損益 + 未實現損益 + 剩餘本金
        # 或更簡單：總權益 = 持倉市值 + 已實現損益 (假設已實現損益都在帳戶現金中) + (本金 - 在市本金)
        # 這裡採用: 總權益 = 投入本金 + 總損益
        unrealized = total_mkt_val - sum(h['cost_basis_twd'] for h in self.holdings.values())
        total_pnl = unrealized + self.total_realized_pnl_twd
        current_equity = self.invested_capital + total_pnl
        
        # TWR 計算 (Modified Dietz 簡易版，下一階段升級)
        daily_cashflow = 0.0
        if self.history_data:
            prev_invested = self.history_data[-1]['invested']
            daily_cashflow = self.invested_capital - prev_invested
        
        mv_begin = self.prev_total_equity
        period_return = 0.0
        
        if mv_begin > 1:
            period_return = (current_equity - daily_cashflow) / mv_begin - 1
            
        self.cumulative_twr_factor *= (1 + period_return)
        
        # 存檔
        self.history_data.append({
            "date": date_ts.strftime("%Y-%m-%d"),
            "total_value": round(total_mkt_val, 0),
            "invested": round(self.invested_capital, 0),
            "net_profit": round(total_pnl, 0),
            "twr": round((self.cumulative_twr_factor - 1) * 100, 2),
            "benchmark_twr": 0 # 暫時簡化
        })
        self.prev_total_equity = current_equity

    def _trade_benchmark(self, date_ts, amount_twd, fx, is_buy=True, realized_cost_twd=0.0):
        # 簡單的 SPY 基準對照
        spy_p = self.market.get_price('SPY', date_ts)
        if spy_p <= 0: return
        
        if is_buy:
            self.benchmark_units += (amount_twd / fx) / spy_p
            self.benchmark_invested += amount_twd
        else:
            if self.benchmark_invested > 0:
                ratio = realized_cost_twd / self.benchmark_invested
                self.benchmark_units -= self.benchmark_units * ratio
                self.benchmark_invested -= realized_cost_twd

    def _generate_final_output(self, current_fx):
        # 持倉列表
        final_holdings = []
        for sym, h in self.holdings.items():
            if h['qty'] > 0.001:
                curr_p = self.market.get_price(sym, datetime.now())
                mkt_val = h['qty'] * curr_p * current_fx
                cost = h['cost_basis_twd']
                pnl = mkt_val - cost
                pnl_pct = (pnl / cost * 100) if cost > 0 else 0
                
                final_holdings.append(HoldingPosition(
                    symbol=sym, tag=h['tag'], currency="USD",
                    qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0),
                    pnl_twd=round(pnl, 0),
                    pnl_percent=round(pnl_pct, 2),
                    current_price_origin=round(curr_p, 2),
                    avg_cost_usd=round(h['cost_basis_usd']/h['qty'], 2)
                ))
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        # === [移植輸出] 平倉列表 ===
        final_closed = []
        for sym, data in self.closed_positions_data.items():
            if not data['lots']: continue
            
            # 轉換為 Pydantic Model
            lots_models = [ClosedLot(**l) for l in sorted(data['lots'], key=lambda x: x['close_date'], reverse=True)]
            
            wins = len([l for l in data['lots'] if l['realized_pnl'] > 0])
            total = len(data['lots'])
            
            final_closed.append(ClosedPosition(
                symbol=sym,
                total_realized_pnl=round(data['total_pnl'], 0),
                win_rate=round((wins/total*100), 1) if total > 0 else 0,
                avg_holding_days=round(sum(l['holding_days'] for l in data['lots'])/total, 1) if total > 0 else 0,
                total_trades_count=total,
                lots=lots_models
            ))
        
        # 摘要
        summary = PortfolioSummary(
            total_value=round(sum(h.market_value_twd for h in final_holdings), 0),
            invested_capital=round(sum(h['cost_basis_twd'] for h in self.holdings.values()), 0),
            total_pnl=round(self.history_data[-1]['net_profit'], 0) if self.history_data else 0,
            twr=self.history_data[-1]['twr'] if self.history_data else 0,
            realized_pnl=round(self.total_realized_pnl_twd, 0),
            benchmark_twr=0
        )

        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY,
            exchange_rate=round(current_fx, 2),
            summary=summary,
            holdings=final_holdings,
            history=self.history_data,
            closed_positions=final_closed # 輸出新數據
        )
