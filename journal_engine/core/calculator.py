import pandas as pd
import numpy as np
from collections import deque
from datetime import datetime, date
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, ClosedPosition, ClosedLot
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client):
        self.df = transactions_df
        self.market = market_client
        
        # === 狀態儲存 ===
        self.holdings = {}  # 當前即時持倉
        self.start_of_day_holdings = {} # [修正 2] 每日早晨持倉快照 (用於判定除息權益)
        
        self.fifo_queues = {} 
        self.closed_positions_data = {} 
        
        self.invested_capital = 0.0
        self.total_realized_pnl_twd = 0.0
        
        # === 股息追蹤系統 ===
        self.dividend_ledger = {} 
        self.processed_dividends = set() 
        self._pre_scan_manual_dividends()
        
        self.history_data = []
        self.benchmark_units = 0.0
        self.benchmark_invested = 0.0
        
        self.cumulative_twr_factor = 1.0
        self.prev_total_equity = 0.0

    def _pre_scan_manual_dividends(self):
        div_txs = self.df[self.df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            self.processed_dividends.add(key)

    def run(self):
        print(">>> [系統] 啟動階段 3 (修正版)：基金級股息歸因引擎...")
        
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
            
            # [修正 2] 每日開始前，建立持倉快照
            # 這代表「除息前一日」的庫存狀態，用於判斷今日是否有權獲得股息
            self._snapshot_start_of_day()
            
            # A. 優先處理隱式自動股息 (基於快照)
            # 邏輯：yfinance 的 date 通常是 Ex-Date。若今日是 Ex-Date，則必須在今日開盤前持有才算數。
            self._process_implicit_dividends(d, fx)
            
            # B. 處理當日交易
            daily_txns = self.df[self.df['Date'].dt.date == current_date]
            for _, row in daily_txns.iterrows():
                self._process_transaction(row, fx, d)
            
            # C. 每日估值
            self._daily_valuation(d, fx)
        
        return self._generate_final_output(fx)

    def _snapshot_start_of_day(self):
        """建立日初持倉快照，用於正確的股息權益計算"""
        self.start_of_day_holdings = {}
        for sym, data in self.holdings.items():
            # 複製關鍵數據，避免參照到後續變動
            self.start_of_day_holdings[sym] = {
                'qty': data['qty'],
                'tag': data.get('tag', '')
            }

    def _back_adjust_transactions(self):
        for index, row in self.df.iterrows():
            sym = row['Symbol']
            if row['Type'] not in ['BUY', 'SELL']: continue
            
            split_factor = self.market.get_transaction_multiplier(sym, row['Date'])
            div_adj_factor = self.market.get_dividend_adjustment_factor(sym, row['Date'])
            
            if split_factor != 1.0 or div_adj_factor != 1.0:
                old_qty = row['Qty']
                old_price = row['Price']
                self.df.at[index, 'Qty'] = old_qty * split_factor
                self.df.at[index, 'Price'] = (old_price / split_factor) * div_adj_factor

    def _register_dividend_event(self, date_ts, sym, net_amount_twd, held_qty):
        if sym not in self.dividend_ledger:
            self.dividend_ledger[sym] = []
        
        # 這裡記錄的 held_qty 是「除息前持倉量」，這才是計算比例的分母
        self.dividend_ledger[sym].append({
            'date': date_ts,
            'amount': net_amount_twd,
            'held_qty': held_qty 
        })
        
        # [修正 3] 同步更新當前持倉的「已領股息」累計，解決報表對不上的問題
        if sym in self.holdings:
            self.holdings[sym]['accumulated_divs_twd'] = self.holdings[sym].get('accumulated_divs_twd', 0.0) + net_amount_twd

    def _process_implicit_dividends(self, date_ts, fx):
        date_str = date_ts.strftime('%Y-%m-%d')
        
        # 使用 start_of_day_holdings 迭代，確保只對「昨收」有持倉的標的配息
        for sym, h in self.start_of_day_holdings.items():
            qty = h['qty']
            if qty > 0.0001:
                if f"{sym}_{date_str}" in self.processed_dividends:
                    continue
                
                div_per_share = self.market.get_dividend(sym, date_ts)
                
                if div_per_share > 0:
                    total_gross = qty * div_per_share
                    is_tw = '.TW' in sym or '.TWO' in sym
                    tax_rate = 0.0 if is_tw else 0.30
                    net_twd = total_gross * (1 - tax_rate) * fx
                    
                    self.total_realized_pnl_twd += net_twd
                    
                    # 使用快照的 quantity 註冊事件
                    self._register_dividend_event(date_ts, sym, net_twd, qty)
                    self.processed_dividends.add(f"{sym}_{date_str}")

    def _process_transaction(self, row, fx, date_ts):
        sym = row['Symbol']
        qty = row['Qty']
        price = row['Price']
        comm = row['Commission']
        tax = row['Tax']
        txn_type = row['Type']
        tag = row['Tag']
        
        if sym not in self.holdings:
            # 初始化時增加 accumulated_divs_twd 欄位
            self.holdings[sym] = {
                'qty': 0.0, 
                'cost_basis_usd': 0.0, 
                'cost_basis_twd': 0.0, 
                'tag': tag,
                'accumulated_divs_twd': 0.0 
            }
            self.fifo_queues[sym] = deque()
            self.closed_positions_data[sym] = {'lots': [], 'total_pnl': 0.0, 'total_dividends': 0.0}
        
        if tag: self.holdings[sym]['tag'] = tag

        if txn_type == 'BUY':
            cost_usd = (qty * price) + comm + tax
            cost_twd = cost_usd * fx
            
            self.holdings[sym]['qty'] += qty
            self.holdings[sym]['cost_basis_usd'] += cost_usd
            self.holdings[sym]['cost_basis_twd'] += cost_twd
            self.invested_capital += cost_twd
            
            self.fifo_queues[sym].append({
                'qty': qty, 
                'price': price, 
                'cost_total_twd': cost_twd,
                'date': date_ts, 
                'original_date': date_ts
            })
            self._trade_benchmark(date_ts, cost_twd, fx, is_buy=True)

        elif txn_type == 'SELL':
            proceeds_twd = ((qty * price) - comm - tax) * fx
            self.holdings[sym]['qty'] -= qty
            
            remaining_sell_qty = qty
            accumulated_cost_twd = 0.0
            
            while remaining_sell_qty > 0.000001 and self.fifo_queues[sym]:
                batch = self.fifo_queues[sym][0]
                matched_qty = min(remaining_sell_qty, batch['qty'])
                
                frac = matched_qty / batch['qty']
                batch_cost_twd = batch['cost_total_twd'] * frac
                
                accumulated_cost_twd += batch_cost_twd
                
                buy_date = batch['original_date']
                sell_date = date_ts
                holding_days = (sell_date - buy_date).days
                
                lot_proceeds = proceeds_twd * (matched_qty / qty)
                lot_price_pnl = lot_proceeds - batch_cost_twd
                
                # === [修正 1] 嚴格的股息歸因判定 ===
                lot_dividends = 0.0
                if sym in self.dividend_ledger:
                    for div_event in self.dividend_ledger[sym]:
                        # 邏輯：必須在除息日之前買入 (buy_date < div_date)
                        # 且必須在除息日當天或之後賣出 (div_date <= sell_date) 才能領到
                        if buy_date < div_event['date'] <= sell_date:
                            if div_event['held_qty'] > 0:
                                ratio = matched_qty / div_event['held_qty']
                                amount = div_event['amount'] * ratio
                                lot_dividends += amount
                                
                                # [修正 3] 因為這筆股息已經「歸因」給平倉部位了
                                # 我們可以選擇從持倉累計中扣除，或者僅作為報表展示。
                                # 這裡僅做歸因計算，不影響 holdings['accumulated_divs_twd'] 的總數紀錄，
                                # 這樣 holdings 顯示的是「該幣別歷史總股息」，而 closed_pos 顯示「帶走的股息」。
                
                lot_total_pnl = lot_price_pnl + lot_dividends
                
                self.closed_positions_data[sym]['lots'].append({
                    'open_date': buy_date.strftime('%Y-%m-%d'),
                    'close_date': sell_date.strftime('%Y-%m-%d'),
                    'qty': matched_qty,
                    'entry_price': batch_cost_twd / matched_qty,
                    'exit_price': lot_proceeds / matched_qty,
                    'cost_basis': batch_cost_twd,
                    'proceeds': lot_proceeds,
                    'realized_pnl': lot_total_pnl, 
                    'holding_days': holding_days,
                    'return_rate': (lot_total_pnl / batch_cost_twd * 100) if batch_cost_twd != 0 else 0,
                    'dividends_collected': lot_dividends
                })
                
                self.closed_positions_data[sym]['total_pnl'] += lot_total_pnl
                self.closed_positions_data[sym]['total_dividends'] += lot_dividends

                batch['qty'] -= matched_qty
                batch['cost_total_twd'] -= batch_cost_twd
                remaining_sell_qty -= matched_qty
                
                if batch['qty'] < 0.000001:
                    self.fifo_queues[sym].popleft()
            
            self.holdings[sym]['cost_basis_twd'] -= accumulated_cost_twd
            self.holdings[sym]['cost_basis_usd'] -= (accumulated_cost_twd / fx) 
            self.invested_capital -= accumulated_cost_twd
            
            self.total_realized_pnl_twd += (proceeds_twd - accumulated_cost_twd)
            
            self._trade_benchmark(date_ts, proceeds_twd, fx, is_buy=False, realized_cost_twd=accumulated_cost_twd)

        elif txn_type == 'DIV':
            net_div_twd = price * fx
            self.total_realized_pnl_twd += net_div_twd
            
            # [修正 2] 手動配息也使用「日初快照」來決定持倉權重
            # 這解決了「當天先買後配」導致分母錯誤的問題
            current_qty = self.start_of_day_holdings.get(sym, {}).get('qty', 0)
            
            # 容錯：如果日初沒持倉但使用者硬要輸入 DIV (例如除息日在昨天，今天才入帳)
            # 系統會嘗試用當前持倉，但這是不精確的。
            # 這裡我們堅持原則：如果日初沒持倉，這筆股息將無法被精確歸因到 Lot，但仍會計入總損益。
            if current_qty > 0:
                self._register_dividend_event(date_ts, sym, net_div_twd, current_qty)
            else:
                # Fallback: 若日初無持倉，記錄警示或僅計入現金流
                pass 

    def _daily_valuation(self, date_ts, fx):
        total_mkt_val = 0.0
        for sym, h in self.holdings.items():
            if h['qty'] > 0.0001:
                price = self.market.get_price(sym, date_ts)
                total_mkt_val += h['qty'] * price * fx
        
        unrealized = total_mkt_val - sum(h['cost_basis_twd'] for h in self.holdings.values())
        total_pnl = unrealized + self.total_realized_pnl_twd
        current_equity = self.invested_capital + total_pnl
        
        daily_cashflow = 0.0
        if self.history_data:
            prev_invested = self.history_data[-1]['invested']
            daily_cashflow = self.invested_capital - prev_invested
        
        mv_begin = self.prev_total_equity
        period_return = 0.0
        
        if mv_begin > 1:
            period_return = (current_equity - daily_cashflow) / mv_begin - 1
            
        self.cumulative_twr_factor *= (1 + period_return)
        
        self.history_data.append({
            "date": date_ts.strftime("%Y-%m-%d"),
            "total_value": round(total_mkt_val, 0),
            "invested": round(self.invested_capital, 0),
            "net_profit": round(total_pnl, 0),
            "twr": round((self.cumulative_twr_factor - 1) * 100, 2),
            "benchmark_twr": 0
        })
        self.prev_total_equity = current_equity

    def _trade_benchmark(self, date_ts, amount_twd, fx, is_buy=True, realized_cost_twd=0.0):
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
        final_holdings = []
        for sym, h in self.holdings.items():
            if h['qty'] > 0.001:
                curr_p = self.market.get_price(sym, datetime.now())
                mkt_val = h['qty'] * curr_p * current_fx
                cost = h['cost_basis_twd']
                pnl = mkt_val - cost
                pnl_pct = (pnl / cost * 100) if cost > 0 else 0
                
                # 這裡目前沒有將 accumulated_divs_twd 輸出到 HoldingPosition 模型
                # 因為 models.py 目前還沒有定義這個欄位。
                # 但數據已經在 calculator 內準備好了，未來可以隨時擴充。
                
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
        
        final_closed = []
        for sym, data in self.closed_positions_data.items():
            if not data['lots']: continue
            
            lots_models = [ClosedLot(**l) for l in sorted(data['lots'], key=lambda x: x['close_date'], reverse=True)]
            wins = len([l for l in data['lots'] if l['realized_pnl'] > 0])
            total = len(data['lots'])
            
            final_closed.append(ClosedPosition(
                symbol=sym,
                total_realized_pnl=round(data['total_pnl'], 0),
                total_dividends=round(data['total_dividends'], 0),
                win_rate=round((wins/total*100), 1) if total > 0 else 0,
                avg_holding_days=round(sum(l['holding_days'] for l in data['lots'])/total, 1) if total > 0 else 0,
                total_trades_count=total,
                lots=lots_models
            ))
        
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
            closed_positions=final_closed
        )
