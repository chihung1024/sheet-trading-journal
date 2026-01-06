import pandas as pd
import numpy as np
from collections import deque
from datetime import datetime
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client):
        """
        初始化投資組合計算器
        
        參數:
            transactions_df: 交易記錄 DataFrame
            market_client: MarketDataClient 實例
        """
        self.df = transactions_df
        self.market = market_client
        
        # 當前持倉狀態
        self.holdings = {}  # {symbol: {qty, cost_basis_usd, cost_basis_twd, tag}}
        
        # FIFO 隊列（用於計算賣出時的成本基礎）
        self.fifo_queues = {}  # {symbol: deque([{qty, price, cost_total_usd, cost_total_twd, date}])}
        
        # 投資統計
        self.invested_capital = 0.0      # 當前投入資金（買入-賣出）
        self.total_realized_pnl_twd = 0.0  # 累計已實現損益（包含賣出盈虧+配息）
        
        # 歷史數據
        self.history_data = []  # 每日資產淨值記錄
        
        # 配息去重
        self.confirmed_dividends = set()  # 記錄已手動輸入的配息
        self._pre_scan_dividends()
        
        # 基準對比（SPY）
        self.benchmark_units = 0.0        # SPY 持有單位
        self.benchmark_invested = 0.0     # SPY 投入資金

        # 新增 TWR 計算專用變數
        self.cumulative_twr_factor = 1.0  # 用於累乘 TWR
        self.prev_total_equity = 0.0      # 記錄前一日總權益

    def _pre_scan_dividends(self):
        """
        預先掃描使用者手動輸入的配息記錄
        """
        div_txs = self.df[self.df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            self.confirmed_dividends.add(key)

    def run(self):
        """
        執行投資組合計算主流程
        """
        print("=== 開始執行投資組合計算 (會計模式: 原始價格+配息現金) ===")
        
        # ==================== 步驟 1: 復權處理 ====================
        self._back_adjust_transactions()
        
        # ==================== 步驟 2: 建立日期範圍 ====================
        start_date = self.df['Date'].min()
        end_date = datetime.now()
        date_range = pd.date_range(start=start_date, end=end_date, freq='D').normalize()
        
        # ==================== 步驟 3: 逐日計算 ====================
        for d in date_range:
            current_date = d.date()
            
            # 取得當日匯率
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx):
                    fx = DEFAULT_FX_RATE
            except:
                fx = DEFAULT_FX_RATE
            
            # 處理當日交易
            daily_txns = self.df[self.df['Date'].dt.date == current_date]
            for _, row in daily_txns.iterrows():
                self._process_transaction(row, fx, d)
            
            # 處理自動配息
            self._process_implicit_dividends(d, fx)
            
            # 每日資產估值
            self._daily_valuation(d, fx)
        
        # ==================== 步驟 4: 產生最終報表 ====================
        return self._generate_final_output(fx)

    def _back_adjust_transactions(self):
        """
        復權處理：調整交易記錄以匹配 Adj Close 價格體系
        """
        print("正在進行交易數據復權處理...")
        
        for index, row in self.df.iterrows():
            sym = row['Symbol']
            date = row['Date']
            tx_type = row['Type']
            
            if tx_type not in ['BUY', 'SELL']:
                continue
            
            # 取得拆股因子
            split_factor = self.market.get_transaction_multiplier(sym, date)
            
            # 取得配息調整因子
            div_adj_factor = self.market.get_dividend_adjustment_factor(sym, date)
            
            if split_factor != 1.0 or div_adj_factor != 1.0:
                old_qty = row['Qty']
                old_price = row['Price']
                
                # 調整股數
                new_qty = old_qty * split_factor
                
                # 調整價格
                new_price = (old_price / split_factor) * div_adj_factor
                
                self.df.at[index, 'Qty'] = new_qty
                self.df.at[index, 'Price'] = new_price
                
                print(f"  [復權] {sym} {date.date()}: {old_qty}股@${old_price:.2f} → {new_qty:.2f}股@${new_price:.2f}")

    def _process_implicit_dividends(self, date_ts, fx):
        """
        處理隱式配息
        """
        date_str = date_ts.strftime('%Y-%m-%d')
        
        for sym, h_data in self.holdings.items():
            qty = h_data['qty']
            
            if qty > 0:
                if f"{sym}_{date_str}" in self.confirmed_dividends:
                    continue
                
                div_per_share_gross = self.market.get_dividend(sym, date_ts)
                
                if div_per_share_gross > 0:
                    # 計算拆股還原
                    split_factor = self.market.get_transaction_multiplier(sym, date_ts)
                    raw_qty = qty / split_factor
                    total_gross = raw_qty * div_per_share_gross
                    
                    # 稅後配息 (30% 稅)
                    total_div_net_usd = total_gross * 0.7
                    total_div_net_twd = total_div_net_usd * fx
                    
                    # 累加到已實現損益 (補償股價下跌)
                    self.total_realized_pnl_twd += total_div_net_twd
                    
                    # 記錄歷史
                    if not hasattr(self, 'dividend_history'):
                        self.dividend_history = []
                    
                    self.dividend_history.append({
                        'date': date_str,
                        'symbol': sym,
                        'shares': qty,
                        'div_per_share': div_per_share_gross,
                        'total_gross': total_gross,
                        'total_net': total_div_net_usd,
                        'total_net_twd': total_div_net_twd
                    })

    def _process_transaction(self, row, fx, date_ts):
        """
        處理單筆交易
        """
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
        
        if tag:
            self.holdings[sym]['tag'] = tag

        if txn_type == 'BUY':
            cost_usd = (qty * price) + comm + tax
            cost_twd = cost_usd * fx
            self.holdings[sym]['qty'] += qty
            self.holdings[sym]['cost_basis_usd'] += cost_usd
            self.holdings[sym]['cost_basis_twd'] += cost_twd
            self.fifo_queues[sym].append({
                'qty': qty, 'price': price, 'cost_total_usd': cost_usd, 
                'cost_total_twd': cost_twd, 'date': date_ts
            })
            self.invested_capital += cost_twd
            self._trade_benchmark(date_ts, cost_twd, fx, is_buy=True)

        elif txn_type == 'SELL':
            proceeds_twd = ((qty * price) - comm - tax) * fx
            self.holdings[sym]['qty'] -= qty
            remaining = qty
            cost_sold_twd = 0.0
            cost_sold_usd = 0.0
            
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
                if batch['qty'] < 1e-9:
                    self.fifo_queues[sym].popleft()
            
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

    def _daily_valuation(self, date_ts, fx):
        total_mkt_val = 0.0
        current_holdings_cost = 0.0
        
        # 1. 計算當日市值 (使用 Raw Price，除息日會跌)
        for sym, h in self.holdings.items():
            if h['qty'] > 0.0001:
                price = self.market.get_price(sym, date_ts)
                total_mkt_val += h['qty'] * price * fx
                current_holdings_cost += h['cost_basis_twd']
        
        # 2. 計算總權益
        unrealized_pnl = total_mkt_val - current_holdings_cost
        total_pnl = unrealized_pnl + self.total_realized_pnl_twd
        current_total_equity = self.invested_capital + total_pnl
        
        # 3. 計算當日 TWR (修正版：Modified Dietz 簡易版，解決小基數問題)
        daily_return = 0.0
        
        # 取得昨天的數據
        prev_invested = self.history_data[-1]['invested'] if self.history_data else 0.0
        prev_pnl = self.history_data[-1]['net_profit'] if self.history_data else 0.0
        
        # 計算當日淨資金流入 (New Money)
        daily_net_inflow = self.invested_capital - prev_invested
        
        # 計算調整後的起始權益 (分母)
        # 昨天的權益 + 今天的資金流入
        # 這能防止 "昨天資產極小 ($0.05) 但今天大額入金 ($87,500)" 導致回報率爆炸
        adjusted_start_equity = self.prev_total_equity + daily_net_inflow
        
        if adjusted_start_equity > 0:
            # 分子：當日損益變動 (Today PnL - Yesterday PnL)
            daily_pnl_change = total_pnl - prev_pnl
            daily_return = daily_pnl_change / adjusted_start_equity
            
        # 特殊情況：第一天 (昨天權益為0，且今天剛投入)
        elif self.invested_capital > 0 and self.prev_total_equity == 0:
             daily_return = total_pnl / self.invested_capital
             
        # [安全閥] 防止極端異常值 (選用，避免髒數據破壞圖表)
        if abs(daily_return) > 1.0: # 如果單日漲跌超過 100%
             # print(f"Warning: Abnormal daily return {daily_return} on {date_ts}")
             pass 

        # 4. 累乘 TWR
        self.cumulative_twr_factor *= (1 + daily_return)
        twr_percentage = (self.cumulative_twr_factor - 1) * 100
        
        # 5. Benchmark TWR
        bench_val = 0.0
        bench_twr = 0.0
        spy_p = self.market.get_price('SPY', date_ts)
        if spy_p > 0:
            bench_val = self.benchmark_units * spy_p * fx
            if self.benchmark_invested > 0:
                bench_twr = ((bench_val - self.benchmark_invested) / self.benchmark_invested) * 100

        # 6. 更新狀態
        self.prev_total_equity = current_total_equity
        
        self.history_data.append({
            "date": date_ts.strftime("%Y-%m-%d"),
            "total_value": round(total_mkt_val, 0),
            "invested": round(self.invested_capital, 0),
            "net_profit": round(total_pnl, 0),
            "twr": round(twr_percentage, 2),
            "benchmark_twr": round(bench_twr, 2)
        })


    def _trade_benchmark(self, date_ts, amount_twd, fx, is_buy=True, realized_cost_twd=0.0):
        spy_p = self.market.get_price('SPY', date_ts)
        if spy_p <= 0:
            return
        
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
