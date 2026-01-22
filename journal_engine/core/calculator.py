import pandas as pd
import numpy as np
import logging
from collections import deque
from datetime import datetime, timedelta
from pyxirr import xirr
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, DividendRecord, PortfolioGroupData
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE

# 取得 logger 實例
logger = logging.getLogger(__name__)

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client, benchmark_ticker="SPY"):
        """
        初始化計算器
        :param transactions_df: 交易紀錄 DataFrame
        :param market_client: 市場數據客戶端
        :param benchmark_ticker: 基準標的代碼 (例如 'SPY', 'QQQ', '0050.TW')
        """
        self.df = transactions_df
        self.market = market_client
        self.benchmark_ticker = benchmark_ticker

    def _is_taiwan_stock(self, symbol):
        """判斷是否為台股(不需匯率轉換)"""
        return symbol.endswith('.TW') or symbol.endswith('.TWO')

    def _get_effective_fx_rate(self, symbol, fx_rate):
        """根據標的取得有效匯率(台股回傳1.0,美股等其他標的回傳實際匯率)"""
        return 1.0 if self._is_taiwan_stock(symbol) else fx_rate

    def run(self):
        """執行多群組投資組合計算主流程"""
        logger.info(f"=== 開始執行多群組投資組合計算 (基準: {self.benchmark_ticker}) ===")
        
        current_fx = DEFAULT_FX_RATE
        if not self.market.fx_rates.empty:
            current_fx = float(self.market.fx_rates.iloc[-1])

        if self.df.empty:
            logger.warning("無交易紀錄,產生空快照以重置數據。")
            empty_summary = PortfolioSummary(
                total_value=0, invested_capital=0, total_pnl=0, 
                twr=0, xirr=0, realized_pnl=0, benchmark_twr=0, daily_pnl_twd=0
            )
            return PortfolioSnapshot(
                updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
                base_currency=BASE_CURRENCY,
                exchange_rate=round(current_fx, 2),
                summary=empty_summary,
                holdings=[],
                history=[],
                pending_dividends=[],
                groups={"all": PortfolioGroupData(summary=empty_summary, holdings=[], history=[], pending_dividends=[])}
            )
            
        self._back_adjust_transactions_global()
        
        all_tags = set()
        for tags_str in self.df['Tag'].dropna().unique():
            if not tags_str: 
                continue
            split_tags = [t.strip() for t in tags_str.replace(';', ',').split(',') if t.strip()]
            all_tags.update(split_tags)
        
        groups_to_calc = ['all'] + sorted(list(all_tags))
        logger.info(f"識別到的群組: {groups_to_calc}")

        final_groups_data = {}
        
        for group_name in groups_to_calc:
            logger.info(f"正在計算群組: {group_name}")
            
            if group_name == 'all':
                group_df = self.df.copy()
            else:
                mask = self.df['Tag'].apply(
                    lambda x: group_name in [t.strip() for t in (x or '').replace(';', ',').split(',')]
                )
                group_df = self.df[mask].copy()
            
            if group_df.empty:
                logger.warning(f"群組 {group_name} 無交易紀錄,跳過")
                continue

            group_start_date = group_df['Date'].min()
            group_end_date = datetime.now()
            group_date_range = pd.date_range(start=group_start_date, end=group_end_date, freq='D').normalize()
            
            logger.info(f"[群組:{group_name}] 日期範圍: {group_start_date.strftime('%Y-%m-%d')} ~ {group_end_date.strftime('%Y-%m-%d')}")

            group_result = self._calculate_single_portfolio(group_df, group_date_range, current_fx, group_name)
            final_groups_data[group_name] = group_result

        all_data = final_groups_data.get('all')
        if not all_data:
            logger.error("無法產出 'all' 群組的總體數據")
            return None
        
        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY,
            exchange_rate=round(current_fx, 2),
            summary=all_data.summary,
            holdings=all_data.holdings,
            history=all_data.history,
            pending_dividends=all_data.pending_dividends,
            groups=final_groups_data
        )

    def _back_adjust_transactions_global(self):
        """全域復權處理"""
        logger.info("正在進行全域交易數據復權處理...")
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

    def _get_previous_trading_day(self, date):
        """獲取前一個交易日(排除周末)"""
        prev_date = date - timedelta(days=1)
        while prev_date.weekday() >= 5:
            prev_date -= timedelta(days=1)
        return prev_date

    def _calculate_single_portfolio(self, df, date_range, current_fx, group_name="unknown"):
        """單一群組的核心計算邏輯"""
        holdings = {}
        fifo_queues = {}
        invested_capital = 0.0
        total_realized_pnl_twd = 0.0
        history_data = []
        confirmed_dividends = set()
        dividend_history = []
        xirr_cashflows = []
        
        cumulative_twr_factor = 1.0
        last_market_value_twd = 0.0
        first_benchmark_val_twd = None

        div_txs = df[df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            confirmed_dividends.add(key)

        if not df.empty:
            first_tx_date = df['Date'].min()
            prev_trading_day = self._get_previous_trading_day(first_tx_date)
            prev_date_str = prev_trading_day.strftime('%Y-%m-%d')
            
            try:
                prev_fx = self.market.fx_rates.asof(prev_trading_day)
                if pd.isna(prev_fx): prev_fx = DEFAULT_FX_RATE
            except: 
                prev_fx = DEFAULT_FX_RATE
            
            prev_benchmark_p = self.market.get_price(self.benchmark_ticker, prev_trading_day)
            effective_prev_fx = self._get_effective_fx_rate(self.benchmark_ticker, prev_fx)
            prev_benchmark_val_twd = prev_benchmark_p * effective_prev_fx
            
            if first_benchmark_val_twd is None and prev_benchmark_val_twd > 0:
                first_benchmark_val_twd = prev_benchmark_val_twd
            
            history_data.append({
                "date": prev_date_str, 
                "total_value": 0,
                "invested": 0, 
                "net_profit": 0,
                "twr": 0.0, 
                "benchmark_twr": 0.0,
                "fx_rate": round(prev_fx, 4)
            })
            
            logger.info(f"[群組:{group_name}] 已在 {prev_date_str} 補上虛擬 0 資產記錄(第一筆交易: {first_tx_date.strftime('%Y-%m-%d')})。")

        last_fx = current_fx
        
        for d in date_range:
            current_date = d.date()
            
            # ✅ 關鍵修正：每天都記錄開盤前持倉快照（用於計算當日損益）
            today_open_holdings = {sym: h['qty'] for sym, h in holdings.items()}
            
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: 
                fx = DEFAULT_FX_RATE
            
            benchmark_p = self.market.get_price(self.benchmark_ticker, d)
            effective_benchmark_fx = self._get_effective_fx_rate(self.benchmark_ticker, fx)
            curr_benchmark_val_twd = benchmark_p * effective_benchmark_fx

            if first_benchmark_val_twd is None and curr_benchmark_val_twd > 0:
                first_benchmark_val_twd = curr_benchmark_val_twd

            daily_txns = df[df['Date'].dt.date == current_date].copy()
            
            if not daily_txns.empty:
                priority_map = {'BUY': 1, 'DIV': 2, 'SELL': 3}
                daily_txns['priority'] = daily_txns['Type'].map(priority_map).fillna(99)
                daily_txns = daily_txns.sort_values(by='priority', kind='stable')
            
            daily_net_cashflow_twd = 0.0
            
            for _, row in daily_txns.iterrows():
                sym = row['Symbol']
                if sym not in holdings:
                    holdings[sym] = {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': row['Tag']}
                    fifo_queues[sym] = deque()

                if row['Type'] == 'BUY':
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    cost_usd = (row['Qty'] * row['Price']) + row['Commission'] + row['Tax']
                    cost_twd = cost_usd * effective_fx
                    holdings[sym]['qty'] += row['Qty']
                    holdings[sym]['cost_basis_usd'] += cost_usd
                    holdings[sym]['cost_basis_twd'] += cost_twd
                    fifo_queues[sym].append({
                        'qty': row['Qty'], 'price': row['Price'], 'cost_total_usd': cost_usd, 
                        'cost_total_twd': cost_twd, 'date': d
                    })
                    invested_capital += cost_twd
                    xirr_cashflows.append({'date': d, 'amount': -cost_twd})
                    daily_net_cashflow_twd += cost_twd

                elif row['Type'] == 'SELL':
                    if not fifo_queues.get(sym) or not fifo_queues[sym]: continue
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    proceeds_twd = ((row['Qty'] * row['Price']) - row['Commission'] - row['Tax']) * effective_fx
                    remaining = row['Qty']
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
                        if batch['qty'] < 1e-6: fifo_queues[sym].popleft()
                    
                    holdings[sym]['qty'] -= (row['Qty'] - remaining)
                    holdings[sym]['cost_basis_usd'] -= cost_sold_usd
                    holdings[sym]['cost_basis_twd'] -= cost_sold_twd
                    invested_capital -= cost_sold_twd
                    total_realized_pnl_twd += (proceeds_twd - cost_sold_twd)
                    xirr_cashflows.append({'date': d, 'amount': proceeds_twd})
                    daily_net_cashflow_twd -= proceeds_twd

                elif row['Type'] == 'DIV':
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    div_twd = row['Price'] * effective_fx
                    total_realized_pnl_twd += div_twd
                    xirr_cashflows.append({'date': d, 'amount': div_twd})
                    daily_net_cashflow_twd -= div_twd

            date_str = d.strftime('%Y-%m-%d')
            for sym, h_data in holdings.items():
                div_per_share = self.market.get_dividend(sym, d)
                if div_per_share > 0 and h_data['qty'] > 1e-6:
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    div_key = f"{sym}_{date_str}"
                    is_confirmed = div_key in confirmed_dividends
                    split_factor = self.market.get_transaction_multiplier(sym, d)
                    
                    shares_at_ex = h_data['qty'] / split_factor
                    total_gross = shares_at_ex * div_per_share
                    total_net_usd = total_gross * 0.7 
                    total_net_twd = total_net_usd * effective_fx

                    dividend_history.append({
                        'symbol': sym, 'ex_date': date_str, 'shares_held': h_data['qty'],
                        'dividend_per_share_gross': div_per_share, 
                        'total_gross': round(total_gross, 2),
                        'total_net_usd': round(total_net_usd, 2),
                        'total_net_twd': round(total_net_twd, 0),
                        'fx_rate': fx, 'status': 'confirmed' if is_confirmed else 'pending'
                    })
                    
                    if not is_confirmed:
                        total_realized_pnl_twd += total_net_twd
                        xirr_cashflows.append({'date': d, 'amount': total_net_twd})
                        daily_net_cashflow_twd -= total_net_twd

            current_market_value_twd = sum(
                h['qty'] * self.market.get_price(s, d) * self._get_effective_fx_rate(s, fx)
                for s, h in holdings.items() if h['qty'] > 1e-6
            )
            
            period_hpr_factor = 1.0
            
            if last_market_value_twd > 1e-9:
                period_hpr_factor = (current_market_value_twd - daily_net_cashflow_twd) / last_market_value_twd
            elif current_market_value_twd > 1e-9 and daily_net_cashflow_twd > 1e-9:
                period_hpr_factor = current_market_value_twd / daily_net_cashflow_twd
            elif current_market_value_twd < 1e-9 and last_market_value_twd < 1e-9:
                period_hpr_factor = 1.0
            
            if not np.isfinite(period_hpr_factor):
                period_hpr_factor = 1.0
            
            cumulative_twr_factor *= period_hpr_factor
            last_market_value_twd = current_market_value_twd
            
            total_pnl = (current_market_value_twd - sum(h['cost_basis_twd'] for h in holdings.values() if h['qty'] > 1e-6)) + total_realized_pnl_twd
            
            benchmark_twr = (curr_benchmark_val_twd / first_benchmark_val_twd - 1) * 100 if first_benchmark_val_twd else 0.0

            # ===== ✅ 計算當日損益（使用開盤前快照 + 今日交易）=====
            daily_pnl_for_this_day = 0.0
            
            # 取得所有相關標的（開盤前持有 + 今日交易）
            all_symbols_today = set(today_open_holdings.keys()) | set(daily_txns['Symbol'].unique())
            
            for sym in all_symbols_today:
                stock_data = self.market.market_data.get(sym, pd.DataFrame())
                if stock_data.empty or len(stock_data) < 2:
                    continue
                
                curr_p = float(stock_data.loc[:d].iloc[-1]['Close_Adjusted']) if len(stock_data.loc[:d]) > 0 else 0.0
                prev_p = float(stock_data.loc[:d].iloc[-2]['Close_Adjusted']) if len(stock_data.loc[:d]) >= 2 else 0.0
                
                if curr_p == 0.0 or prev_p == 0.0:
                    continue
                
                effective_fx = self._get_effective_fx_rate(sym, fx)
                
                # 1. 開盤前持倉的價差損益
                open_qty = today_open_holdings.get(sym, 0.0)
                price_change_pnl = (curr_p - prev_p) * open_qty * effective_fx
                
                # 2. 今日交易的損益
                today_trade_pnl = 0.0
                for _, row in daily_txns[daily_txns['Symbol'] == sym].iterrows():
                    row_fx = self._get_effective_fx_rate(sym, fx)
                    
                    if row['Type'] == 'BUY':
                        buy_qty = row['Qty']
                        buy_price = row['Price']
                        today_trade_pnl += (curr_p - buy_price) * buy_qty * row_fx
                
                daily_pnl_for_this_day += (price_change_pnl + today_trade_pnl)

            history_data.append({
                "date": date_str, "total_value": round(current_market_value_twd, 0),
                "invested": round(invested_capital, 0), "net_profit": round(total_pnl, 0),
                "twr": round((cumulative_twr_factor - 1) * 100, 2), 
                "benchmark_twr": round(benchmark_twr, 2),
                "fx_rate": round(fx, 4),
                "daily_pnl_twd": round(daily_pnl_for_this_day, 0)  # ✅ 新增：每日的當日損益
            })
            
            last_fx = fx

        # --- 產生最終報表（使用符合台灣投資者視角的當日損益）---
        final_holdings = []
        current_holdings_cost_sum = 0.0
        
        # ✅ 計算符合台灣投資者視角的「當日損益」
        # 台股：今天的損益 | 美股：昨天的損益（昨晚美東時間）
        display_daily_pnl = 0.0
        
        for sym, h in holdings.items():
            if h['qty'] > 1e-4:
                stock_data = self.market.market_data.get(sym, pd.DataFrame())
                curr_p, prev_p = 0.0, 0.0
                if not stock_data.empty:
                    curr_p = float(stock_data.iloc[-1]['Close_Adjusted'])
                    if len(stock_data) >= 2: prev_p = float(stock_data.iloc[-2]['Close_Adjusted'])

                effective_fx = self._get_effective_fx_rate(sym, current_fx)
                mkt_val = h['qty'] * curr_p * effective_fx
                cost = h['cost_basis_twd']
                current_holdings_cost_sum += cost
                
                daily_change_pct = round((curr_p - prev_p) / prev_p * 100, 2) if prev_p > 0 else 0.0
                currency = "TWD" if self._is_taiwan_stock(sym) else "USD"
                
                # 計算個股當日損益
                stock_daily_pnl = 0.0
                if not stock_data.empty and len(stock_data) >= 2:
                    stock_daily_pnl = (curr_p - prev_p) * h['qty'] * effective_fx
                    display_daily_pnl += stock_daily_pnl
                
                final_holdings.append(HoldingPosition(
                    symbol=sym, tag=h['tag'], currency=currency, qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0), pnl_twd=round(mkt_val - cost, 0),
                    pnl_percent=round((mkt_val - cost) / cost * 100, 2) if cost > 0 else 0,
                    current_price_origin=round(curr_p, 2), avg_cost_usd=round(h['cost_basis_usd'] / h['qty'], 2) if h['qty'] > 0 else 0,
                    prev_close_price=round(prev_p, 2), daily_change_usd=round(curr_p - prev_p, 2),
                    daily_change_percent=daily_change_pct,
                    daily_pl_twd=round(stock_daily_pnl, 0)
                ))
        
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        # ✅ 加上已清倉標的的當日損益（從歷史記錄查找）
        # 找出今天和昨天的歷史記錄
        today_str = datetime.now().date().strftime('%Y-%m-%d')
        yesterday_str = (datetime.now().date() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        today_history = next((h for h in history_data if h['date'] == today_str), None)
        yesterday_history = next((h for h in history_data if h['date'] == yesterday_str), None)
        
        # 美股用昨天，台股用今天
        if today_history and 'daily_pnl_twd' in today_history:
            # 這裡的邏輯：history 裡已經包含所有標的（含已清倉）
            # 但 display_daily_pnl 目前只有「現有持倉」
            # 所以直接用 history 的值（包含已清倉標的）
            display_daily_pnl = today_history['daily_pnl_twd']
        
        logger.info(f"[群組:{group_name}] 當日損益（台灣投資者視角）: {display_daily_pnl}")
        
        # XIRR 計算
        xirr_val = 0.0
        if xirr_cashflows:
            curr_val_sum = sum(h.market_value_twd for h in final_holdings)
            xirr_cashflows_calc = xirr_cashflows.copy()
            xirr_cashflows_calc.append({'date': datetime.now(), 'amount': curr_val_sum})
            try:
                xirr_res = xirr([x['date'] for x in xirr_cashflows_calc], [x['amount'] for x in xirr_cashflows_calc])
                xirr_val = round(xirr_res * 100, 2)
            except: pass

        summary = PortfolioSummary(
            total_value=round(sum(h.market_value_twd for h in final_holdings), 0),
            invested_capital=round(current_holdings_cost_sum, 0),
            total_pnl=round(history_data[-1]['net_profit'], 0) if history_data else 0,
            twr=history_data[-1]['twr'] if history_data else 0,
            xirr=xirr_val,
            realized_pnl=round(total_realized_pnl_twd, 0),
            benchmark_twr=history_data[-1]['benchmark_twr'] if history_data else 0,
            daily_pnl_twd=round(display_daily_pnl, 0)
        )
        
        return PortfolioGroupData(
            summary=summary, holdings=final_holdings, history=history_data,
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d['status']=='pending']
        )
