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
        self.benchmark_ticker = benchmark_ticker # 儲存自訂基準

    def run(self):
        """執行多群組投資組合計算主流程"""
        logger.info(f"=== 開始執行多群組投資組合計算 (基準: {self.benchmark_ticker}) ===")
        
        # 取得最新匯率
        current_fx = DEFAULT_FX_RATE
        if not self.market.fx_rates.empty:
            current_fx = float(self.market.fx_rates.iloc[-1])

        # [修復 BUG]：處理完全無交易紀錄的邊際情況，回傳空快照而非 None
        if self.df.empty:
            logger.warning("無交易紀錄，產生空快照以重置數據。")
            empty_summary = PortfolioSummary(
                total_value=0, invested_capital=0, total_pnl=0, 
                twr=0, xirr=0, realized_pnl=0, benchmark_twr=0
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
            
        # 1. 全域復權處理 (只做一次)
        self._back_adjust_transactions_global()
        
        # ✅ 2. 準備日期範圍（從基準日開始）
        first_trade_date = self.df['Date'].min()
        baseline_date = first_trade_date - timedelta(days=1)  # ✅ 基準日為第一筆交易前一天
        end_date = datetime.now()
        date_range = pd.date_range(start=baseline_date, end=end_date, freq='D').normalize()
        
        logger.info(f"第一筆交易日期: {first_trade_date.strftime('%Y-%m-%d')}")
        logger.info(f"TWR 基準日期: {baseline_date.strftime('%Y-%m-%d')} (設為 0%)")
        
        # 3. 識別所有群組
        all_tags = set()
        for tags_str in self.df['Tag'].dropna().unique():
            if not tags_str: 
                continue
            split_tags = [t.strip() for t in tags_str.replace(';', ',').split(',') if t.strip()]
            all_tags.update(split_tags)
        
        groups_to_calc = ['all'] + sorted(list(all_tags))
        logger.info(f"識別到的群組: {groups_to_calc}")

        # 4. 迴圈計算每個群組
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
                logger.warning(f"群組 {group_name} 無交易紀錄，跳過")
                continue

            # 執行單一群組計算 (傳入動態匯率和基準日期)
            group_result = self._calculate_single_portfolio(group_df, date_range, current_fx, baseline_date)
            final_groups_data[group_name] = group_result

        # 5. 組合最終結果
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

    def _calculate_single_portfolio(self, df, date_range, current_fx, baseline_date):
        """單一群組的核心計算邏輯 (✅ 修復 TWR 基準點)"""
        
        holdings = {}
        fifo_queues = {}
        invested_capital = 0.0
        total_realized_pnl_twd = 0.0
        history_data = []
        confirmed_dividends = set()
        dividend_history = []
        xirr_cashflows = []
        cumulative_twr_factor = 1.0
        prev_total_equity = 0.0
        
        # Benchmark 計算所需 (使用自訂標的)
        baseline_benchmark_price = None  # ✅ 基準日的 benchmark 價格

        # 用於存儲每個標的最新的活躍當日損益
        last_active_daily_pnls = {}

        # 預掃描確認配息
        div_txs = df[df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            confirmed_dividends.add(key)

        # ✅ 逐日計算（從基準日開始）
        for d in date_range:
            current_date = d.date()
            
            # ✅ 處理基準日（第一筆交易的前一天）
            if current_date == baseline_date:
                # 獲取基準日的 benchmark 價格
                baseline_benchmark_price = self.market.get_price(self.benchmark_ticker, d)
                if baseline_benchmark_price <= 0:
                    baseline_benchmark_price = None
                    logger.warning(f"⚠️  無法獲取基準日 {baseline_date} 的 {self.benchmark_ticker} 價格，Benchmark 將顯示 0")
                else:
                    logger.info(f"✅ 基準日 {baseline_date}: {self.benchmark_ticker} = ${baseline_benchmark_price:.2f}")
                
                # 添加基準點數據（TWR = 0%）
                history_data.append({
                    "date": current_date.strftime('%Y-%m-%d'),
                    "total_value": 0,
                    "invested": 0,
                    "net_profit": 0,
                    "twr": 0.0,  # ✅ 基準點為 0%
                    "benchmark_twr": 0.0,  # ✅ Benchmark 基準點為 0%
                    "fx_rate": round(DEFAULT_FX_RATE, 4)
                })
                continue
            
            # 取得匯率
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: 
                fx = DEFAULT_FX_RATE
            
            # 取得昨日匯率與當日交易
            prev_date = d - timedelta(days=1)
            try:
                prev_fx = self.market.fx_rates.asof(prev_date)
                if pd.isna(prev_fx): prev_fx = fx
            except: prev_fx = fx

            daily_txns = df[df['Date'].dt.date == current_date].copy()
            
            # 紀錄今日交易前的持倉狀態
            start_of_day_state = {}
            for sym, h in holdings.items():
                if h['qty'] > 1e-6:
                    start_of_day_state[sym] = {
                        'qty': h['qty'], 
                        'prev_price': self.market.get_price(sym, prev_date)
                    }

            # 處理當日交易
            daily_cashflows = {}
            
            if not daily_txns.empty:
                priority_map = {'BUY': 1, 'DIV': 2, 'SELL': 3}
                daily_txns['priority'] = daily_txns['Type'].map(priority_map).fillna(99)
                daily_txns = daily_txns.sort_values(by='priority', kind='stable')
            
            for _, row in daily_txns.iterrows():
                sym = row['Symbol']
                if sym not in holdings:
                    holdings[sym] = {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': row['Tag']}
                    fifo_queues[sym] = deque()
                
                if sym not in daily_cashflows:
                    daily_cashflows[sym] = {'buy_cost': 0.0, 'sell_proceeds': 0.0, 'div_received': 0.0}

                if row['Type'] == 'BUY':
                    cost_usd = (row['Qty'] * row['Price']) + row['Commission'] + row['Tax']
                    cost_twd = cost_usd * fx
                    holdings[sym]['qty'] += row['Qty']
                    holdings[sym]['cost_basis_usd'] += cost_usd
                    holdings[sym]['cost_basis_twd'] += cost_twd
                    fifo_queues[sym].append({
                        'qty': row['Qty'], 'price': row['Price'], 'cost_total_usd': cost_usd, 
                        'cost_total_twd': cost_twd, 'date': d
                    })
                    invested_capital += cost_twd
                    xirr_cashflows.append({'date': d, 'amount': -cost_twd})
                    daily_cashflows[sym]['buy_cost'] += cost_twd

                elif row['Type'] == 'SELL':
                    if not fifo_queues.get(sym) or not fifo_queues[sym]: continue
                    proceeds_twd = ((row['Qty'] * row['Price']) - row['Commission'] - row['Tax']) * fx
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
                    daily_cashflows[sym]['sell_proceeds'] += proceeds_twd

                elif row['Type'] == 'DIV':
                    div_twd = row['Price'] * fx
                    total_realized_pnl_twd += div_twd
                    xirr_cashflows.append({'date': d, 'amount': div_twd})
                    daily_cashflows[sym]['div_received'] += div_twd

            # 處理自動配息與標的損益
            date_str = d.strftime('%Y-%m-%d')
            for sym, h_data in holdings.items():
                div_per_share = self.market.get_dividend(sym, d)
                if div_per_share > 0 and h_data['qty'] > 1e-6:
                    div_key = f"{sym}_{date_str}"
                    is_confirmed = div_key in confirmed_dividends
                    split_factor = self.market.get_transaction_multiplier(sym, d)
                    
                    shares_at_ex = h_data['qty'] / split_factor
                    total_gross = shares_at_ex * div_per_share
                    total_net_usd = total_gross * 0.7 
                    total_net_twd = total_net_usd * fx

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
                        if sym not in daily_cashflows: daily_cashflows[sym] = {'buy_cost': 0, 'sell_proceeds': 0, 'div_received': 0}
                        daily_cashflows[sym]['div_received'] += total_net_twd

                # 計算該標的今日的損益貢獻
                curr_p = self.market.get_price(sym, d)
                prev_info = start_of_day_state.get(sym, {'qty': 0.0, 'prev_price': curr_p})
                cf = daily_cashflows.get(sym, {'buy_cost': 0, 'sell_proceeds': 0, 'div_received': 0})
                
                end_val = h_data['qty'] * curr_p * fx
                start_val = prev_info['qty'] * prev_info['prev_price'] * prev_fx
                daily_pnl = (end_val + cf['sell_proceeds'] + cf['div_received']) - (start_val + cf['buy_cost'])
                
                if abs(daily_pnl) > 1e-2 or not daily_txns[daily_txns['Symbol'] == sym].empty:
                    last_active_daily_pnls[sym] = daily_pnl

            # 每日組合估值與 TWR
            total_mkt_val = sum(h['qty'] * self.market.get_price(s, d) * fx for s, h in holdings.items() if h['qty'] > 1e-6)
            total_pnl = (total_mkt_val - sum(h['cost_basis_twd'] for h in holdings.values() if h['qty'] > 1e-6)) + total_realized_pnl_twd
            current_total_equity = invested_capital + total_pnl
            
            # ✅ TWR 計算（修復版）
            prev_invested = history_data[-1]['invested'] if history_data else 0.0
            prev_pnl = history_data[-1]['net_profit'] if history_data else 0.0
            adj_equity = prev_total_equity + (invested_capital - prev_invested)
            
            # 避免除以零
            if adj_equity > 1.0:
                daily_return = (total_pnl - prev_pnl) / adj_equity
            else:
                daily_return = 0.0
                
            cumulative_twr_factor *= (1 + daily_return)
            prev_total_equity = current_total_equity
            
            # ✅ 計算自訂標的的 Benchmark TWR（相對於基準日）
            benchmark_twr = 0.0
            if baseline_benchmark_price and baseline_benchmark_price > 0:
                benchmark_p = self.market.get_price(self.benchmark_ticker, d)
                if benchmark_p > 0:
                    benchmark_twr = ((benchmark_p / baseline_benchmark_price) - 1) * 100

            history_data.append({
                "date": date_str, "total_value": round(total_mkt_val, 0),
                "invested": round(invested_capital, 0), "net_profit": round(total_pnl, 0),
                "twr": round((cumulative_twr_factor - 1) * 100, 2), 
                "benchmark_twr": round(benchmark_twr, 2),  # ✅ 相對基準日的回報
                "fx_rate": round(fx, 4)
            })

        # --- 產生最終報表 ---
        final_holdings = []
        current_holdings_cost_sum = 0.0
        for sym, h in holdings.items():
            if h['qty'] > 1e-4:
                stock_data = self.market.market_data.get(sym, pd.DataFrame())
                curr_p, prev_p = 0.0, 0.0
                if not stock_data.empty:
                    curr_p = float(stock_data.iloc[-1]['Close_Adjusted'])
                    if len(stock_data) >= 2: prev_p = float(stock_data.iloc[-2]['Close_Adjusted'])

                mkt_val = h['qty'] * curr_p * current_fx
                cost = h['cost_basis_twd']
                current_holdings_cost_sum += cost
                
                final_holdings.append(HoldingPosition(
                    symbol=sym, tag=h['tag'], currency="USD", qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0), pnl_twd=round(mkt_val - cost, 0),
                    pnl_percent=round((mkt_val - cost) / cost * 100, 2) if cost > 0 else 0,
                    current_price_origin=round(curr_p, 2), avg_cost_usd=round(h['cost_basis_usd'] / h['qty'], 2),
                    prev_close_price=round(prev_p, 2), daily_change_usd=round(curr_p - prev_p, 2),
                    daily_pl_twd=round(last_active_daily_pnls.get(sym, 0.0), 0)
                ))
        
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
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
            total_pnl=round(history_data[-1]['net_profit'], 0),
            twr=history_data[-1]['twr'], xirr=xirr_val,
            realized_pnl=round(total_realized_pnl_twd, 0),
            benchmark_twr=history_data[-1]['benchmark_twr']  # ✅ 基準回報最終值
        )
        
        logger.info(f"✅ 計算完成 - TWR: {summary.twr}%, Benchmark: {summary.benchmark_twr}%, 歷史數據點: {len(history_data)}")
        
        return PortfolioGroupData(
            summary=summary, holdings=final_holdings, history=history_data,
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d['status']=='pending']
        )