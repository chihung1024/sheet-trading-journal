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
        
        self.holdings = {} 
        self.fifo_queues = {} 
        
        self.invested_capital = 0.0      
        self.total_realized_pnl_twd = 0.0 
        self.history_data = []
        
        self.confirmed_dividends = set()
        self._pre_scan_dividends()
        
        self.benchmark_units = 0.0
        self.benchmark_invested = 0.0

    def _pre_scan_dividends(self):
        """
        預先掃描使用者手動輸入的配息紀錄 (Type='DIV')
        這些紀錄通常是使用者想要精確控制金額時輸入的
        """
        div_txs = self.df[self.df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            # 建立去重鍵值: Symbol_Date
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            self.confirmed_dividends.add(key)

    def run(self):
        print("=== 開始執行投資組合計算 (含自動配息與扣稅) ===")
        
        # 1. 預先處理交易：全復權 (Split-Adjusted)
        self._back_adjust_transactions()
        
        start_date = self.df['Date'].min()
        end_date = datetime.now()
        date_range = pd.date_range(start=start_date, end=end_date, freq='D').normalize()
        
        for d in date_range:
            current_date = d.date()
            
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: fx = DEFAULT_FX_RATE
            
            # 2. 處理當日交易
            daily_txns = self.df[self.df['Date'].dt.date == current_date]
            for _, row in daily_txns.iterrows():
                self._process_transaction(row, fx, d)
            
            # 3. 處理自動配息 (Implicit Dividends)
            self._process_implicit_dividends(d, fx)
                
            # 4. 每日資產估值
            self._daily_valuation(d, fx)
            
        return self._generate_final_output(fx)

    def _back_adjust_transactions(self):
        """
        將所有交易紀錄依據 Split Factor 調整為「當前等價股數」。
        這確保了持倉數量與 MarketDataClient 提供的 Adj Close 價格是對齊的。
        """
        print("正在進行交易數據復權處理...")
        for index, row in self.df.iterrows():
            sym = row['Symbol']
            date = row['Date']
            
            factor = self.market.get_transaction_multiplier(sym, date)
            
            if factor != 1.0:
                old_qty = row['Qty']
                old_price = row['Price']
                
                # 股數變多，價格變低，總成本不變
                self.df.at[index, 'Qty'] = old_qty * factor
                self.df.at[index, 'Price'] = old_price / factor

    def _process_implicit_dividends(self, date_ts, fx):
        """
        處理隱式股息 (yfinance 記錄但用戶未手動輸入的)
        - 邏輯：在除息日 (Ex-Date) 當天承認收入，以抵銷股價下跌的影響
        - 稅務：自動預扣 30% 美股股息稅
        """
        date_str = date_ts.strftime('%Y-%m-%d')
        
        for sym, h_data in self.holdings.items():
            qty = h_data['qty'] # 這是已經復權後的股數 (例如 1000 股)
            
            if qty > 0:
                # 檢查是否已由使用者手動輸入 (避免重複)
                if f"{sym}_{date_str}" in self.confirmed_dividends:
                    continue
                
                # 從 MarketDataClient 獲取每股配息
                # 假設 yfinance 的 Dividends 配合 Adj Close 也是調整後的
                div_per_share_gross = self.market.get_dividend(sym, date_ts)
                
                if div_per_share_gross > 0:
                    # 計算總配息 (稅前 USD) = 持股數 * 每股配息
                    total_div_gross_usd = qty * div_per_share_gross
                    
                    # 自動扣除 30% 稅 (Net USD)
                    total_div_net_usd = total_div_gross_usd * 0.7
                    
                    # 轉換為台幣
                    total_div_net_twd = total_div_net_usd * fx
                    
                    # 加入已實現損益
                    self.total_realized_pnl_twd += total_div_net_twd
                    
                    # print(f"  [自動配息] {date_str} {sym}: 持有{qty:.0f}股 * ${div_per_share_gross:.3f} * 70% = ${total_div_net_usd:.2f}")

    def _process_transaction(self, row, fx, date_ts):
        sym = row['Symbol']; qty = row['Qty']; price = row['Price']
        comm = row['Commission']; tax = row['Tax']; txn_type = row['Type']; tag = row['Tag']
        
        if sym not in self.holdings:
            self.holdings[sym] = {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': tag}
            self.fifo_queues[sym] = deque()
        if tag: self.holdings[sym]['tag'] = tag

        if txn_type == 'BUY':
            cost_usd = (qty * price) + comm + tax
            cost_twd = cost_usd * fx
            self.holdings[sym]['qty'] += qty
            self.holdings[sym]['cost_basis_usd'] += cost_usd
            self.holdings[sym]['cost_basis_twd'] += cost_twd
            self.fifo_queues[sym].append({'qty': qty, 'price': price, 'cost_total_usd': cost_usd, 'cost_total_twd': cost_twd, 'date': date_ts})
            self.invested_capital += cost_twd
            self._trade_benchmark(date_ts, cost_twd, fx, is_buy=True)

        elif txn_type == 'SELL':
            proceeds_twd = ((qty * price) - comm - tax) * fx
            self.holdings[sym]['qty'] -= qty
            remaining = qty; cost_sold_twd = 0.0; cost_sold_usd = 0.0
            
            while remaining > 0 and self.fifo_queues[sym]:
                batch = self.fifo_queues[sym][0]
                take = min(remaining, batch['qty'])
                frac = take / batch['qty']
                
                cost_sold_usd += batch['cost_total_usd'] * frac
                cost_sold_twd += batch['cost_total_twd'] * frac
                
                batch['qty'] -= take
                batch['cost_total_usd'] -= batch['cost_total_usd'] * frac
                batch['cost_total_twd'] -= batch['cost_total_twd'] * frac
                remaining -= take
                
                if batch['qty'] < 1e-9: self.fifo_queues[sym].popleft()
            
            self.holdings[sym]['cost_basis_usd'] -= cost_sold_usd
            self.holdings[sym]['cost_basis_twd'] -= cost_sold_twd
            self.invested_capital -= cost_sold_twd
            self.total_realized_pnl_twd += (proceeds_twd - cost_sold_twd)
            self._trade_benchmark(date_ts, proceeds_twd, fx, is_buy=False, realized_cost_twd=cost_sold_twd)

        elif txn_type == 'DIV':
            # 手動輸入的配息 (通常 Price 欄位代表已扣稅後的總金額 USD)
            net_div_usd = price 
            net_div_twd = net_div_usd * fx
            self.total_realized_pnl_twd += net_div_twd
            
            # [重要] 記錄此筆配息已手動處理，避免自動邏輯重複計算
            date_str = date_ts.strftime('%Y-%m-%d')
            self.confirmed_dividends.add(f"{sym}_{date_str}")

    def _daily_valuation(self, date_ts, fx):
        total_mkt_val = 0.0
        current_holdings_cost = 0.0
        
        for sym, h in self.holdings.items():
            if h['qty'] > 0.0001:
                # 使用 MarketDataClient 提供的 Adj Close
                price = self.market.get_price(sym, date_ts)
                
                total_mkt_val += h['qty'] * price * fx
                current_holdings_cost += h['cost_basis_twd']
        
        unrealized_pnl = total_mkt_val - current_holdings_cost
        total_pnl = unrealized_pnl + self.total_realized_pnl_twd
        
        twr = 0.0
        if current_holdings_cost > 0:
            twr = (total_pnl / current_holdings_cost) * 100
            
        bench_val = 0.0
        bench_twr = 0.0
        spy_p = self.market.get_price('SPY', date_ts)
        
        if spy_p > 0:
            bench_val = self.benchmark_units * spy_p * fx
            if self.benchmark_invested > 0:
                bench_twr = ((bench_val - self.benchmark_invested) / self.benchmark_invested) * 100

        self.history_data.append({
            "date": date_ts.strftime("%Y-%m-%d"),
            "total_value": round(total_mkt_val, 0),
            "invested": round(self.invested_capital, 0),
            "net_profit": round(total_pnl, 0),
            "twr": round(twr, 2),
            "benchmark_twr": round(bench_twr, 2)
        })

    def _trade_benchmark(self, date_ts, amount_twd, fx, is_buy=True, realized_cost_twd=0.0):
        spy_p = self.market.get_price('SPY', date_ts)
        if spy_p <= 0: return
        if is_buy:
            self.benchmark_units += (amount_twd / fx) / spy_p
            self.benchmark_invested += amount_twd
        else:
            if self.benchmark_units > 0:
                ratio = realized_cost_twd / self.benchmark_invested if self.benchmark_invested > 0 else 0
                self.benchmark_units -= self.benchmark_units * ratio
                self.benchmark_invested -= realized_cost_twd

    def _generate_final_output(self, current_fx):
        print("整理最終報表...")
        final_holdings = []
        current_holdings_cost_sum = 0.0
        
        for sym, h in self.holdings.items():
            if h['qty'] > 0.001:
                curr_p = self.market.get_price(sym, datetime.now())
                mkt_val = h['qty'] * curr_p * current_fx
                
                cost = h['cost_basis_twd']
                pnl = mkt_val - cost
                pnl_pct = (pnl/cost*100) if cost>0 else 0
                
                # 平均成本顯示為復權後的每股成本
                avg_cost_usd = h['cost_basis_usd'] / h['qty'] if h['qty']>0 else 0
                
                current_holdings_cost_sum += cost
                
                final_holdings.append(HoldingPosition(
                    symbol=sym, tag=h['tag'], currency="USD",
                    qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0),
                    pnl_twd=round(pnl, 0),
                    pnl_percent=round(pnl_pct, 2),
                    current_price_origin=round(curr_p, 2),
                    avg_cost_usd=round(avg_cost_usd, 2)
                ))
        
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        curr_total_val = sum(x.market_value_twd for x in final_holdings)
        total_pnl = (curr_total_val - current_holdings_cost_sum) + self.total_realized_pnl_twd
        
        summary = PortfolioSummary(
            total_value=round(curr_total_val, 0),
            invested_capital=round(current_holdings_cost_sum, 0),
            total_pnl=round(total_pnl, 0),
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
