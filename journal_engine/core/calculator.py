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
        
        # 狀態變數
        # holdings 結構擴充: 加入 'cost_basis_twd' (歷史台幣總成本)
        self.holdings = {} # {symbol: {'qty': 0, 'cost_basis_usd': 0, 'cost_basis_twd': 0, 'tag': ''}}
        
        # FIFO 佇列擴充: 每一批次都要紀錄 usd 與 twd 的成本
        self.fifo_queues = {} 
        
        self.invested_capital = 0.0      # 累積淨投入本金 (TWD)
        self.total_realized_pnl_twd = 0.0 # 累積已實現損益 (TWD)
        self.history_data = []
        
        # Benchmark
        self.benchmark_units = 0.0
        self.benchmark_invested = 0.0

    def run(self):
        print("=== 開始執行投資組合計算 (嚴格台幣本位) ===")
        
        start_date = self.df['Date'].min()
        end_date = datetime.now()
        # [修正] 正規化日期範圍，確保時間為 00:00:00
        date_range = pd.date_range(start=start_date, end=end_date, freq='D').normalize()
        
        print("開始逐日回測計算...")
        
        for d in date_range:
            current_date = d.date()
            
            # 1. 取得當日匯率
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: fx = DEFAULT_FX_RATE
            
            # 2. 處理拆股 (Stock Splits)
            self._process_splits(d, current_date)
            
            # 3. 處理當日交易
            daily_txns = self.df[self.df['Date'].dt.date == current_date]
            for _, row in daily_txns.iterrows():
                self._process_transaction(row, fx, d)
                
            # 4. 每日結算與紀錄
            self._daily_valuation(d, fx)
            
        return self._generate_final_output(fx)

    def _process_splits(self, date_ts, date_obj):
        for sym, h_data in self.holdings.items():
            if h_data['qty'] > 0:
                # 這裡 date_ts 已經是 normalized timestamp
                split_ratio = self.market.get_split_ratio(sym, date_ts)
                
                if split_ratio != 1.0:
                    print(f"[{date_obj}] ⚡ 偵測到 {sym} 拆股，比例: {split_ratio}")
                    print(f"    - 拆股前: {h_data['qty']} 股")
                    
                    # 1. 調整總持倉股數
                    h_data['qty'] *= split_ratio
                    # 注意：總成本 (USD/TWD) 不變，所以 cost_basis 不用動，但單位成本會自然下降
                    
                    print(f"    - 拆股後: {h_data['qty']} 股")
                    
                    # 2. 調整 FIFO 佇列
                    if sym in self.fifo_queues:
                        for batch in self.fifo_queues[sym]:
                            # old_price = batch['price']
                            batch['qty'] *= split_ratio
                            batch['price'] /= split_ratio
                            # batch['cost_total_usd'] 不變
                            # batch['cost_total_twd'] 不變

    def _process_transaction(self, row, fx, date_ts):
        sym = row['Symbol']
        qty = row['Qty']
        price = row['Price']
        comm = row['Commission'] # 原幣手續費
        tax = row['Tax']         # 原幣稅
        txn_type = row['Type']
        tag = row['Tag']
        
        # 初始化
        if sym not in self.holdings:
            self.holdings[sym] = {
                'qty': 0.0, 
                'cost_basis_usd': 0.0, 
                'cost_basis_twd': 0.0, # 新增：嚴格追蹤台幣成本
                'tag': tag
            }
            self.fifo_queues[sym] = deque()
        
        if tag: self.holdings[sym]['tag'] = tag

        # --- BUY ---
        if txn_type == 'BUY':
            # 原幣成本
            cost_usd = (qty * price) + comm + tax
            # 台幣成本 (當下匯率)
            cost_twd = cost_usd * fx
            
            # 更新持倉
            self.holdings[sym]['qty'] += qty
            self.holdings[sym]['cost_basis_usd'] += cost_usd
            self.holdings[sym]['cost_basis_twd'] += cost_twd
            
            # 加入 FIFO 佇列 (紀錄雙重成本)
            self.fifo_queues[sym].append({
                'qty': qty, 
                'price': price, 
                'cost_total_usd': cost_usd, 
                'cost_total_twd': cost_twd, # 關鍵：鎖定歷史匯率
                'date': date_ts
            })
            
            # 增加總投入本金
            self.invested_capital += cost_twd
            
            # Benchmark Buy SPY (模擬台幣投入)
            self._trade_benchmark(date_ts, cost_twd, fx, is_buy=True)

        # --- SELL ---
        elif txn_type == 'SELL':
            # 原幣淨入
            proceeds_usd = (qty * price) - comm - tax
            # 台幣淨入 (當下匯率)
            proceeds_twd = proceeds_usd * fx
            
            self.holdings[sym]['qty'] -= qty
            
            # FIFO Logic
            remaining_qty_to_sell = qty
            cost_of_sold_usd = 0.0
            cost_of_sold_twd = 0.0 # 關鍵：我們要算出的歷史台幣成本
            
            while remaining_qty_to_sell > 0 and self.fifo_queues[sym]:
                batch = self.fifo_queues[sym][0]
                
                if batch['qty'] > remaining_qty_to_sell:
                    # 部分賣出
                    fraction = remaining_qty_to_sell / batch['qty']
                    
                    batch_cost_usd_part = batch['cost_total_usd'] * fraction
                    batch_cost_twd_part = batch['cost_total_twd'] * fraction # 依比例扣除歷史台幣成本
                    
                    cost_of_sold_usd += batch_cost_usd_part
                    cost_of_sold_twd += batch_cost_twd_part
                    
                    # 更新該批次剩餘狀態
                    batch['qty'] -= remaining_qty_to_sell
                    batch['cost_total_usd'] -= batch_cost_usd_part
                    batch['cost_total_twd'] -= batch_cost_twd_part
                    remaining_qty_to_sell = 0
                else:
                    # 整批賣出
                    cost_of_sold_usd += batch['cost_total_usd']
                    cost_of_sold_twd += batch['cost_total_twd']
                    
                    remaining_qty_to_sell -= batch['qty']
                    self.fifo_queues[sym].popleft()
            
            # 更新持倉總成本
            self.holdings[sym]['cost_basis_usd'] -= cost_of_sold_usd
            self.holdings[sym]['cost_basis_twd'] -= cost_of_sold_twd
            
            # 計算已實現損益 (台幣本位)
            # 獲利 = 台幣淨入 - 歷史台幣成本
            realized_pnl_twd = proceeds_twd - cost_of_sold_twd
            
            self.total_realized_pnl_twd += realized_pnl_twd
            
            # 賣出視為本金撤出 (減少投入資本，依據的是當初投入的台幣)
            self.invested_capital -= cost_of_sold_twd
            
            # Benchmark Sell SPY
            self._trade_benchmark(date_ts, proceeds_twd, fx, is_buy=False, realized_cost_twd=cost_of_sold_twd)

        # --- DIV ---
        elif txn_type == 'DIV':
            net_div_usd = price - tax
            net_div_twd = net_div_usd * fx
            self.total_realized_pnl_twd += net_div_twd

    def _trade_benchmark(self, date_ts, amount_twd, fx, is_buy=True, realized_cost_twd=0.0):
        # 這裡的 amount_twd 已經是台幣
        # 我們將其換回當下的 USD 買入 SPY，以模擬同步操作
        spy_price = self.market.get_price('SPY', date_ts)
        if spy_price <= 0: return

        if is_buy:
            # 用 amount_twd 等值的錢買入 SPY
            # amount_usd = amount_twd / fx
            # qty = amount_usd / spy_price 
            # 簡化： amount_twd / fx / spy_price
            b_qty = (amount_twd / fx) / spy_price
            self.benchmark_units += b_qty
            self.benchmark_invested += amount_twd
        else:
            # 賣出時，amount_twd 是拿回的錢 (Proceeds)
            if self.benchmark_units > 0:
                # 假設賣出比例與本金撤出比例相同 (近似)
                # 這裡較複雜，簡單做法：依現價賣出對應價值的 SPY
                val_usd_sold = amount_twd / fx
                b_qty_sold = val_usd_sold / spy_price
                
                self.benchmark_units -= b_qty_sold
                self.benchmark_invested -= realized_cost_twd

    def _daily_valuation(self, date_ts, fx):
        total_market_value_twd = 0.0
        current_cost_basis_twd = 0.0
        
        for sym, h_data in self.holdings.items():
            qty = h_data['qty']
            
            # 這裡我們使用 "歷史台幣成本" 來計算未實現損益
            # 這樣 ROI 才會包含 "匯率損益"
            current_cost_basis_twd += h_data['cost_basis_twd']
            
            if qty > 0.0001:
                curr_price = self.market.get_price(sym, date_ts)
                val_twd = qty * curr_price * fx
                total_market_value_twd += val_twd
        
        unrealized_pnl = total_market_value_twd - current_cost_basis_twd
        total_profit = unrealized_pnl + self.total_realized_pnl_twd
        
        # TWR Calculation
        twr_pct = 0.0
        if current_cost_basis_twd > 0:
            twr_pct = (total_profit / current_cost_basis_twd) * 100
        elif total_market_value_twd == 0 and self.total_realized_pnl_twd != 0 and self.invested_capital > 0:
             twr_pct = (self.total_realized_pnl_twd / self.invested_capital) * 100

        # Benchmark TWR
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
            if qty > 0.001:
                curr_p = self.market.get_price(sym, datetime.now())
                
                mkt_val_twd = qty * curr_p * current_fx
                
                # 這裡使用 "歷史台幣成本"
                cost_twd = h_data['cost_basis_twd']
                
                pnl_twd = mkt_val_twd - cost_twd
                pnl_pct = (pnl_twd / cost_twd * 100) if cost_twd > 0 else 0
                
                final_holdings.append(HoldingPosition(
                    symbol=sym,
                    tag=h_data['tag'],
                    currency="USD",
                    qty=round(qty, 2),
                    market_value_twd=round(mkt_val_twd, 0),
                    # 注意：這裡的 pnl_twd 現在包含了 (股價漲跌 + 匯率漲跌)
                    pnl_twd=round(pnl_twd, 0),
                    pnl_percent=round(pnl_pct, 2),
                    current_price_origin=round(curr_p, 2)
                ))
        
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        curr_total_val = sum(h.market_value_twd for h in final_holdings)
        # 總成本使用歷史累積成本
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
