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
        div_txs = self.df[self.df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            self.confirmed_dividends.add(key)

    def run(self):
        print("=== 開始執行投資組合計算 (會計模式: 顯式配息加回) ===")
        
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
            
            daily_txns = self.df[self.df['Date'].dt.date == current_date]
            for _, row in daily_txns.iterrows():
                self._process_transaction(row, fx, d)
            
            self._process_implicit_dividends(d, fx)
            self._daily_valuation(d, fx)
            
        return self._generate_final_output(fx)

    def _back_adjust_transactions(self):
        """
        僅針對「拆股」進行復權。
        不對「配息」做價格調整，確保顯示的成本與券商一致。
        """
        print("正在進行交易數據復權處理...")
        for index, row in self.df.iterrows():
            sym = row['Symbol']
            date = row['Date']
            
            # 僅取得拆股因子
            factor = self.market.get_transaction_multiplier(sym, date)
            
            if factor != 1.0:
                old_qty = row['Qty']
                old_price = row['Price']
                
                # 股數增加，單價降低，總成本不變
                self.df.at[index, 'Qty'] = old_qty * factor
                self.df.at[index, 'Price'] = old_price / factor

    def _process_implicit_dividends(self, date_ts, fx):
        """
        處理隱式配息：
        在除息日當天，計算應收現金股利，並加入已實現損益。
        這會抵銷當天因為除息造成的市值下跌，但會留下稅務虧損的缺口。
        """
        date_str = date_ts.strftime('%Y-%m-%d')
        
        for sym, h_data in self.holdings.items():
            qty = h_data['qty'] # 當前股數 (已拆股復權)
            
            if qty > 0:
                if f"{sym}_{date_str}" in self.confirmed_dividends:
                    continue
                
                # 取得原始每股配息
                raw_div = self.market.get_dividend(sym, date_ts)
                
                if raw_div > 0:
                    # 取得當天的拆股因子
                    factor = self.market.get_transaction_multiplier(sym, date_ts)
                    
                    # 還原成當前股數對應的每股配息
                    # 公式：(復權後股數) * (原始配息 / 因子) = 原始總配息金額
                    adj_div = raw_div / factor
                    
                    # 計算總金額
                    total_div_gross = qty * adj_div
                    total_div_net_usd = total_div_gross * 0.7 # 扣稅 30%
                    total_div_net_twd = total_div_net_usd * fx
                    
                    # [關鍵] 累加到已實現損益
                    # 這筆錢會補償市值的下跌，剩餘的差額(稅)就是當天的資產減損
                    self.total_realized_pnl_twd += total_div_net_twd
                    
                    # 記錄歷史 (可選)
                    if not hasattr(self, 'dividend_history'):
                        self.dividend_history = []
                    self.dividend_history.append({
                        'date': date_str,
                        'symbol': sym,
                        'net_amount': total_div_net_usd
                    })

    def _daily_valuation(self, date_ts, fx):
        total_mkt_val = 0.0
        current_holdings_cost = 0.0
        
        for sym, h in self.holdings.items():
            if h['qty'] > 0.0001:
                # 使用 Raw Price (Split Adjusted)
                # 除息日當天，這個價格會下跌 (例如 100 -> 90)
                price = self.market.get_price(sym, date_ts)
                
                total_mkt_val += h['qty'] * price * fx
                current_holdings_cost += h['cost_basis_twd']
        
        unrealized_pnl = total_mkt_val - current_holdings_cost
        
        # 總損益 = 市值損益(跌了10k) + 手上累積的現金(配息加了7k)
        # 結果 = -3k (這就是你要的稅務虧損呈現)
        total_pnl = unrealized_pnl + self.total_realized_pnl_twd
        
        twr = 0.0
        if current_holdings_cost > 0:
            twr = (total_pnl / current_holdings_cost) * 100
            
        # Benchmark
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
            net_div_usd = price 
            net_div_twd = net_div_usd * fx
            self.total_realized_pnl_twd += net_div_twd
            date_str = date_ts.strftime('%Y-%m-%d')
            self.confirmed_dividends.add(f"{sym}_{date_str}")

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
