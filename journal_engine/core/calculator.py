import pandas as pd
import numpy as np
from collections import deque
from datetime import datetime
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client):
        self.df = transactions_df
        self.market = market_client
        
        # 系統狀態
        self.holdings = {} 
        self.fifo_queues = {} 
        
        # 績效指標
        self.invested_capital = 0.0      
        self.total_realized_pnl_twd = 0.0 
        self.history_data = []
        
        # Benchmark 狀態
        self.benchmark_units = 0.0
        self.benchmark_invested = 0.0
        
        # [新增] 記錄使用者已確認的股息 (Symbol_Date)，避免重複計算
        self.confirmed_dividends = set()
        self._pre_scan_dividends()

    def _pre_scan_dividends(self):
        """預掃描所有使用者手動輸入的股息紀錄"""
        div_txs = self.df[self.df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            self.confirmed_dividends.add(key)

    def run(self):
        print("=== 開始執行投資組合計算 (v2.0 增強版) ===")
        
        start_date = self.df['Date'].min()
        end_date = datetime.now()
        date_range = pd.date_range(start=start_date, end=end_date, freq='D').normalize()
        
        print("開始逐日回測計算...")
        
        for d in date_range:
            current_date = d.date()
            
            # 1. 取得當日匯率
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: fx = DEFAULT_FX_RATE
            
            # 2. 處理拆股 (Splits) - 優先權最高
            self._process_splits(d, current_date)
            
            # 3. 處理使用者交易 (Buy/Sell/Confirmed Div)
            daily_txns = self.df[self.df['Date'].dt.date == current_date]
            for _, row in daily_txns.iterrows():
                self._process_transaction(row, fx, d)
            
            # 4. [新增] 處理自動配息 (Implicit Dividends)
            # 參考 portfolio-journal 邏輯：如果當天市場有配息，且使用者沒紀錄，則自動計算
            self._process_implicit_dividends(d, fx)
                
            # 5. 每日結算與快照
            self._daily_valuation(d, fx)
            
        return self._generate_final_output(fx)

    def _process_splits(self, date_ts, date_obj):
        """處理拆股事件，調整持倉數量與成本"""
        for sym, h_data in self.holdings.items():
            if h_data['qty'] > 0:
                split_ratio = self.market.get_split_ratio(sym, date_ts)
                
                if split_ratio != 1.0:
                    # h_data['qty'] *= split_ratio  <-- 修正：這裡只是一個暫存，真正要改的是 queue
                    # 但為了計算方便，我們這裡也同步更新暫存
                    old_qty = h_data['qty']
                    h_data['qty'] *= split_ratio
                    
                    print(f"[{date_obj}] {sym} 拆股 {split_ratio}倍 (持倉: {old_qty:.2f} -> {h_data['qty']:.2f})")
                    
                    # 關鍵：調整 FIFO 佇列中的每一筆成本與數量
                    if sym in self.fifo_queues:
                        for batch in self.fifo_queues[sym]:
                            batch['qty'] *= split_ratio
                            batch['price'] /= split_ratio 
                            # cost_total_usd/twd 不變，因為總成本沒變，只是股數變多

    def _process_implicit_dividends(self, date_ts, fx):
        """自動計算市場配息"""
        date_str = date_ts.strftime('%Y-%m-%d')
        
        for sym, h_data in self.holdings.items():
            qty = h_data['qty']
            if qty > 0:
                # 檢查是否已由使用者手動輸入 (避免重複)
                key = f"{sym}_{date_str}"
                if key in self.confirmed_dividends:
                    continue
                
                # 查詢市場數據是否有配息
                div_per_share = self.market.get_dividend(sym, date_ts)
                if div_per_share > 0:
                    total_div_usd = qty * div_per_share
                    # 預扣 30% 稅 (美股預設)
                    net_div_usd = total_div_usd * 0.7 
                    net_div_twd = net_div_usd * fx
                    
                    print(f"[{date_str}] {sym} 自動配息: {div_per_share}/股, 持有{qty}股, 淨領 ${net_div_usd:.2f}")
                    
                    self.total_realized_pnl_twd += net_div_twd
                    # 同步增加現金流到投資組合 (視為已實現獲利)

    def _process_transaction(self, row, fx, date_ts):
        sym = row['Symbol']
        qty = row['Qty']
        price = row['Price']
        comm = row['Commission']
        tax = row['Tax']
        txn_type = row['Type']
        tag = row['Tag']
        
        if sym not in self.holdings:
            self.holdings[sym] = {
                'qty': 0.0, 
                'cost_basis_usd': 0.0, 
                'cost_basis_twd': 0.0, 
                'tag': tag
            }
            self.fifo_queues[sym] = deque()
        
        if tag: self.holdings[sym]['tag'] = tag

        if txn_type == 'BUY':
            cost_usd = (qty * price) + comm + tax
            cost_twd = cost_usd * fx
            
            self.holdings[sym]['qty'] += qty
            self.holdings[sym]['cost_basis_usd'] += cost_usd
            self.holdings[sym]['cost_basis_twd'] += cost_twd
            
            self.fifo_queues[sym].append({
                'qty': qty, 
                'price': price, 
                'cost_total_usd': cost_usd, 
                'cost_total_twd': cost_twd,
                'date': date_ts
            })
            
            self.invested_capital += cost_twd
            self._trade_benchmark(date_ts, cost_twd, fx, is_buy=True)

        elif txn_type == 'SELL':
            proceeds_usd = (qty * price) - comm - tax
            proceeds_twd = proceeds_usd * fx
            
            self.holdings[sym]['qty'] -= qty
            
            remaining_qty_to_sell = qty
            cost_of_sold_usd = 0.0
            cost_of_sold_twd = 0.0
            
            while remaining_qty_to_sell > 0 and self.fifo_queues[sym]:
                batch = self.fifo_queues[sym][0]
                
                if batch['qty'] > remaining_qty_to_sell:
                    fraction = remaining_qty_to_sell / batch['qty']
                    batch_cost_usd_part = batch['cost_total_usd'] * fraction
                    batch_cost_twd_part = batch['cost_total_twd'] * fraction
                    
                    cost_of_sold_usd += batch_cost_usd_part
                    cost_of_sold_twd += batch_cost_twd_part
                    
                    batch['qty'] -= remaining_qty_to_sell
                    batch['cost_total_usd'] -= batch_cost_usd_part
                    batch['cost_total_twd'] -= batch_cost_twd_part
                    remaining_qty_to_sell = 0
                else:
                    cost_of_sold_usd += batch['cost_total_usd']
                    cost_of_sold_twd += batch['cost_total_twd']
                    remaining_qty_to_sell -= batch['qty']
                    self.fifo_queues[sym].popleft()
            
            self.holdings[sym]['cost_basis_usd'] -= cost_of_sold_usd
            self.holdings[sym]['cost_basis_twd'] -= cost_of_sold_twd
            
            realized_pnl_twd = proceeds_twd - cost_of_sold_twd
            self.total_realized_pnl_twd += realized_pnl_twd
            self.invested_capital -= cost_of_sold_twd
            
            self._trade_benchmark(date_ts, proceeds_twd, fx, is_buy=False, realized_cost_twd=cost_of_sold_twd)

        elif txn_type == 'DIV':
            net_div_usd = price - tax
            net_div_twd = net_div_usd * fx
            self.total_realized_pnl_twd += net_div_twd

    def _trade_benchmark(self, date_ts, amount_twd, fx, is_buy=True, realized_cost_twd=0.0):
        spy_price = self.market.get_price('SPY', date_ts)
        if spy_price <= 0: return

        if is_buy:
            b_qty = (amount_twd / fx) / spy_price
            self.benchmark_units += b_qty
            self.benchmark_invested += amount_twd
        else:
            if self.benchmark_units > 0:
                val_usd_sold = amount_twd / fx
                b_qty_sold = val_usd_sold / spy_price
                self.benchmark_units -= b_qty_sold
                self.benchmark_invested -= realized_cost_twd

    def _daily_valuation(self, date_ts, fx):
        total_market_value_twd = 0.0
        current_cost_basis_twd = 0.0
        
        for sym, h_data in self.holdings.items():
            qty = h_data['qty']
            current_cost_basis_twd += h_data['cost_basis_twd']
            
            if qty > 0.0001:
                curr_price = self.market.get_price(sym, date_ts)
                val_twd = qty * curr_price * fx
                total_market_value_twd += val_twd
        
        unrealized_pnl = total_market_value_twd - current_cost_basis_twd
        total_profit = unrealized_pnl + self.total_realized_pnl_twd
        
        twr_pct = 0.0
        if current_cost_basis_twd > 0:
            twr_pct = (total_profit / current_cost_basis_twd) * 100
        elif total_market_value_twd == 0 and self.total_realized_pnl_twd != 0 and self.invested_capital > 0:
             twr_pct = (self.total_realized_pnl_twd / self.invested_capital) * 100

        bench_val_twd = 0.0
        bench_twr = 0.0
        spy_p = self.market.get_price('SPY', date_ts)
        if spy_p > 0:
            bench_val_twd = self.benchmark_units * spy_p * fx
            
        if self.benchmark_invested > 0:
            bench_profit = bench_val_twd - self.benchmark_invested
            bench_twr = (bench_profit / self.benchmark_invested) * 100
            
        self.history_data.append({
            "date": date_ts.strftime("%Y-%m-%d"),
            "total_value": round(total_market_value_twd, 0),
            "invested": round(self.invested_capital, 0),
            "twr": round(twr_pct, 2),
            "benchmark_twr": round(bench_twr, 2)
        })

    def _generate_final_output(self, current_fx):
        print("回測完成，正在整理最終數據...")
        
        final_holdings = []
        
        for sym, h_data in self.holdings.items():
            qty = h_data['qty']
            # 過濾掉極小數值的殘渣 (浮點數誤差)
            if qty > 0.001:
                curr_p = self.market.get_price(sym, datetime.now())
                mkt_val_twd = qty * curr_p * current_fx
                
                cost_twd = h_data['cost_basis_twd']
                cost_usd = h_data['cost_basis_usd']
                
                avg_cost_usd = cost_usd / qty if qty > 0 else 0
                
                pnl_twd = mkt_val_twd - cost_twd
                pnl_pct = (pnl_twd / cost_twd * 100) if cost_twd > 0 else 0
                
                final_holdings.append(HoldingPosition(
                    symbol=sym,
                    tag=h_data['tag'],
                    currency="USD",
                    qty=round(qty, 2),
                    market_value_twd=round(mkt_val_twd, 0),
                    pnl_twd=round(pnl_twd, 0),
                    pnl_percent=round(pnl_pct, 2),
                    current_price_origin=round(curr_p, 2),
                    avg_cost_usd=round(avg_cost_usd, 2)
                ))
        
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        curr_total_val = sum(h.market_value_twd for h in final_holdings)
        curr_invested = sum(self.holdings[h.symbol]['cost_basis_twd'] for h in final_holdings)
        curr_unrealized = curr_total_val - curr_invested
        
        summary = PortfolioSummary(
            total_value=round(curr_total_val, 0),
            invested_capital=round(curr_invested, 0),
            total_pnl=round(curr_unrealized + self.total_realized_pnl_twd, 0),
            twr=self.history_data[-1]['twr'] if self.history_data else 0,
            realized_pnl=round(self.total_realized_pnl_twd, 0),
            benchmark_twr=self.history_data[-1]['benchmark_twr'] if self.history_data else 0
        )

        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY,
            exchange_rate=round(current_fx, 2),
            summary=summary,
            holdings=final_holdings,
            history=self.history_data
        )
