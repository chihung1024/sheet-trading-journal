import pandas as pd
import numpy as np
import logging
from datetime import datetime, timedelta
from pyxirr import xirr
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, DividendRecord, PortfolioGroupData
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE

# 引入 v2.40 新增的核心模組
from .transaction_analyzer import TransactionAnalyzer, PositionSnapshot
from .daily_pnl_helper import DailyPnLHelper

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
            
        # v2.40: 在分析前先進行全域復權處理，確保 TransactionAnalyzer 拿到的是正確數據
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
        """單一群組的核心計算邏輯 (v2.40 TransactionAnalyzer 版)"""
        
        # 初始化 v2.40 核心組件
        txn_analyzer = TransactionAnalyzer(df)
        pnl_helper = DailyPnLHelper()
        current_stage, stage_desc = pnl_helper.get_market_stage()
        
        # 初始化變數
        history_data = []
        confirmed_dividends = set()
        dividend_history = []
        xirr_cashflows = []
        
        # 累積變數
        cumulative_twr_factor = 1.0
        last_market_value_twd = 0.0
        first_benchmark_val_twd = None
        
        # 記錄所有已確認的配息
        div_txs = df[df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            confirmed_dividends.add(key)

        # === 1. 處理歷史第一筆之前的狀態 (虛擬期初) ===
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
            logger.info(f"[群組:{group_name}] 已在 {prev_date_str} 補上虛擬 0 資產記錄。")

        # === 2. 歷史回測迴圈 (History Replay) ===
        # 注意：為了效能，這裡我們不對每一天呼叫 analyze_today_position (太慢)
        # 而是使用一個簡化的增量邏輯來生成歷史曲線，
        # 但在"最後一天(今日)"，我們會使用 TransactionAnalyzer 做精確計算。
        
        # 重新初始化用於歷史迴圈的變數
        sim_holdings = {} # {sym: {qty, cost_basis_twd}}
        sim_invested_capital = 0.0
        sim_realized_pnl = 0.0
        
        last_fx = current_fx
        
        for d in date_range:
            current_date = d.date()
            date_str = d.strftime('%Y-%m-%d')
            
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: 
                fx = DEFAULT_FX_RATE
            
            # 基準計算
            benchmark_p = self.market.get_price(self.benchmark_ticker, d)
            effective_benchmark_fx = self._get_effective_fx_rate(self.benchmark_ticker, fx)
            curr_benchmark_val_twd = benchmark_p * effective_benchmark_fx

            if first_benchmark_val_twd is None and curr_benchmark_val_twd > 0:
                first_benchmark_val_twd = curr_benchmark_val_twd

            # 當日交易處理 (為了生成歷史現金流)
            daily_txns = df[df['Date'].dt.date == current_date].copy()
            
            # 使用 TransactionAnalyzer 分析當日交易帶來的已實現損益
            # 如果當日有交易，我們才呼叫 analyzer 以節省效能
            daily_net_cashflow_twd = 0.0
            
            if not daily_txns.empty:
                # 這裡我們利用 Analyzer 準確算出"當日"的已實現損益和持倉變化
                # 但為了避免重複計算，我們只取我們需要的數值
                
                # 簡單維護 sim_holdings 和 cashflows 用於 TWR/XIRR
                for _, row in daily_txns.iterrows():
                    sym = row['Symbol']
                    eff_fx = self._get_effective_fx_rate(sym, fx)
                    total_amt = abs(row['Qty'] * row['Price'])
                    fees = row['Commission'] + row['Tax']
                    
                    if row['Type'] == 'BUY':
                        flow = -(total_amt + fees) * eff_fx
                        xirr_cashflows.append({'date': d, 'amount': flow})
                        daily_net_cashflow_twd -= flow # cashflow = inflow - outflow
                        
                        # 更新模擬持倉 (簡化版，僅用於歷史市值計算)
                        if sym not in sim_holdings: sim_holdings[sym] = {'qty': 0.0, 'cost': 0.0}
                        sim_holdings[sym]['qty'] += row['Qty']
                        sim_holdings[sym]['cost'] += (total_amt + fees) * eff_fx
                        sim_invested_capital += (total_amt + fees) * eff_fx

                    elif row['Type'] == 'SELL':
                        proceeds = (total_amt - fees) * eff_fx
                        xirr_cashflows.append({'date': d, 'amount': proceeds})
                        daily_net_cashflow_twd += proceeds # cashflow is positive
                        
                        # 更新模擬持倉
                        if sym in sim_holdings:
                            # 依比例扣除成本
                            if sim_holdings[sym]['qty'] > 0:
                                ratio = row['Qty'] / sim_holdings[sym]['qty']
                                cost_sold = sim_holdings[sym]['cost'] * ratio
                                sim_holdings[sym]['qty'] -= row['Qty']
                                sim_holdings[sym]['cost'] -= cost_sold
                                sim_invested_capital -= cost_sold
                                # 累加歷史已實現 (估算)
                                sim_realized_pnl += (proceeds - cost_sold)

                    elif row['Type'] == 'DIV':
                        div_amt = row['Price'] * eff_fx
                        xirr_cashflows.append({'date': d, 'amount': div_amt})
                        daily_net_cashflow_twd += div_amt
                        sim_realized_pnl += div_amt

            # 處理配息記錄 (Dividend History)
            for sym, h_data in sim_holdings.items():
                if h_data['qty'] < 1e-6: continue
                
                div_per_share = self.market.get_dividend(sym, d)
                if div_per_share > 0:
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    div_key = f"{sym}_{date_str}"
                    is_confirmed = div_key in confirmed_dividends
                    
                    # 估算分割與總額
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
                    
                    # 若為 Pending 配息，也視為當日現金流流入，以便計算 TWR
                    if not is_confirmed:
                        sim_realized_pnl += total_net_twd
                        xirr_cashflows.append({'date': d, 'amount': total_net_twd})
                        daily_net_cashflow_twd += total_net_twd

            # 計算當日市值
            current_market_value_twd = sum(
                h['qty'] * self.market.get_price(s, d) * self._get_effective_fx_rate(s, fx)
                for s, h in sim_holdings.items() if h['qty'] > 1e-6
            )
            
            # TWR 計算
            period_hpr_factor = 1.0
            # HPR = (期末市值 - 淨現金流) / 期初市值
            # 這裡的 cashflow 定義: 入金為正，出金為負 (從 TWR 公式角度)
            # 但上面的 daily_net_cashflow_twd 是 (賣出+配息 - 買入)
            # 所以對 TWR 而言: End - (Inflow - Outflow) = End - NetFlow
            # 這裡邏輯需非常小心：
            # 如果我們定義 NetFlow = 賣出拿回的錢 - 買入花掉的錢
            # 那麼 (End - NetFlow) 其實就是 (End + Buy - Sell)
            
            if last_market_value_twd > 1e-9:
                period_hpr_factor = (current_market_value_twd - daily_net_cashflow_twd) / last_market_value_twd
            elif current_market_value_twd > 1e-9 and daily_net_cashflow_twd < -1e-9: 
                # 期初無市值，但有淨買入 (cashflow 為負)
                # 這種情況通常視為 HPR 起始點，不計入此期
                period_hpr_factor = 1.0
            
            if not np.isfinite(period_hpr_factor):
                period_hpr_factor = 1.0
            
            cumulative_twr_factor *= period_hpr_factor
            last_market_value_twd = current_market_value_twd
            
            # 總損益 = (市值 - 投入成本) + 已實現
            # 注意：這裡的 sim_invested_capital 是剩餘持倉的成本
            total_pnl = (current_market_value_twd - sim_invested_capital) + sim_realized_pnl
            
            benchmark_twr = (curr_benchmark_val_twd / first_benchmark_val_twd - 1) * 100 if first_benchmark_val_twd else 0.0

            history_data.append({
                "date": date_str, "total_value": round(current_market_value_twd, 0),
                "invested": round(sim_invested_capital, 0), "net_profit": round(total_pnl, 0),
                "twr": round((cumulative_twr_factor - 1) * 100, 2), 
                "benchmark_twr": round(benchmark_twr, 2),
                "fx_rate": round(fx, 4)
            })
            
            last_fx = fx

        # === 3. 產生最終報表 (今日狀態 - 使用 TransactionAnalyzer) ===
        final_holdings = []
        current_holdings_cost_sum = 0.0
        total_realized_pnl_today = 0.0 # 用於 Summary
        daily_pnl_us_total = 0.0
        daily_pnl_tw_total = 0.0
        
        # 取得所有有交易過的 symbol
        all_symbols = set(df['Symbol'].unique())
        today_date = datetime.now(pnl_helper.tz_tw).date()
        
        for sym in all_symbols:
            # 取得該標的最新標籤
            last_tag = df[df['Symbol'] == sym].sort_values('Date').iloc[-1]['Tag']
            if not last_tag: last_tag = "Stock"

            # [核心修正 A] 使用分析器取得今日精確狀態
            # 這包含了當日已實現損益、當日買賣量、以及精確的剩餘數量
            effective_fx = self._get_effective_fx_rate(sym, current_fx)
            pos = txn_analyzer.analyze_today_position(sym, today_date, effective_fx)
            
            # 如果該標的已出清且今日無交易，則跳過
            if pos.qty < 1e-6 and pos.today_buy_qty < 1e-6 and pos.today_sell_qty < 1e-6:
                continue
                
            # 累加今日已實現損益 (Fixed PnL)
            total_realized_pnl_today += pos.realized_pnl
            
            stock_data = self.market.market_data.get(sym, pd.DataFrame())
            
            # [核心修正 B] 計算未實現損益 (Floating PnL)
            target_mode, _ = pnl_helper.get_price_strategy(current_stage, self._is_taiwan_stock(sym))
            
            curr_p = 0.0
            prev_p = 0.0 # 這裡的 prev_p 代表「今日損益計算的基準價」
            stock_unrealized_pnl = 0.0
            daily_change = 0.0
            
            if not stock_data.empty:
                curr_p = float(stock_data.iloc[-1]['Close_Adjusted'])
                # 處理新股上市可能無昨收的情況
                yest_close = float(stock_data.iloc[-2]['Close_Adjusted']) if len(stock_data) >= 2 else curr_p

                if target_mode == 'YESTERDAY':
                    # 凌晨時段看台股：使用歷史回溯
                    yesterday = today_date - timedelta(days=1)
                    stock_unrealized_pnl, curr_p, prev_p = pnl_helper.get_historical_pnl(
                        stock_data, yesterday, pos.qty, effective_fx
                    )
                else:
                    # 一般時段：使用加權基準價
                    # 這是解決「加碼」與「新倉」問題的關鍵
                    base_p = txn_analyzer.get_base_price_for_pnl(pos, yest_close)
                    
                    if pos.qty > 0:
                        stock_unrealized_pnl = (curr_p - base_p) * pos.qty * effective_fx
                    else:
                        stock_unrealized_pnl = 0.0 # 已出清，無未實現損益
                        
                    prev_p = base_p 
                    daily_change = curr_p - prev_p

            # 分類累加未實現損益
            if self._is_taiwan_stock(sym):
                daily_pnl_tw_total += stock_unrealized_pnl
            else:
                daily_pnl_us_total += stock_unrealized_pnl

            # 計算市值與成本 (僅針對持倉部分)
            mkt_val = pos.qty * curr_p * effective_fx
            cost_twd = pos.total_cost * effective_fx
            current_holdings_cost_sum += cost_twd
            
            currency = "TWD" if self._is_taiwan_stock(sym) else "USD"
            
            final_holdings.append(HoldingPosition(
                symbol=sym,
                tag=last_tag,
                currency=currency,
                qty=round(pos.qty, 2), # 使用分析後的精確數量
                market_value_twd=round(mkt_val, 0),
                pnl_twd=round(mkt_val - cost_twd, 0),
                pnl_percent=round((mkt_val - cost_twd) / cost_twd * 100, 2) if cost_twd > 0 else 0.0,
                
                # 關鍵數據
                daily_pl_twd=round(stock_unrealized_pnl, 0), # 僅含未實現
                realized_pnl_today=round(pos.realized_pnl, 0), # 當日已實現
                
                current_price_origin=round(curr_p, 2),
                prev_close_price=round(prev_p, 2), # 這裡顯示的是「加權基準價」
                avg_cost_usd=round(pos.avg_cost, 2),
                daily_change_usd=round(daily_change, 2),
                daily_change_percent=round(daily_change/prev_p*100, 2) if prev_p > 0 else 0.0,
                
                # 用於前端顯示活動
                today_buy_qty=pos.today_buy_qty,
                today_sell_qty=pos.today_sell_qty,
                is_new_position=pos.is_new_today
            ))
        
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        # 總當日損益 = 所有持股的未實現 + 當日已實現
        display_daily_pnl = daily_pnl_us_total + daily_pnl_tw_total + total_realized_pnl_today
        
        logger.info(f"[群組:{group_name}] 當日損益總計: {display_daily_pnl} (未實現: {daily_pnl_us_total+daily_pnl_tw_total}, 已實現: {total_realized_pnl_today})")
        
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
            realized_pnl=round(sim_realized_pnl + total_realized_pnl_today, 0), # 歷史累積 + 今日新增
            benchmark_twr=history_data[-1]['benchmark_twr'] if history_data else 0,
            
            # v2.40 新增欄位
            daily_pnl_twd=round(display_daily_pnl, 0),
            realized_pnl_today=round(total_realized_pnl_today, 0),
            daily_pnl_us=round(daily_pnl_us_total, 0),
            daily_pnl_tw=round(daily_pnl_tw_total, 0),
            market_stage=stage_desc,
            updated_at_tw=datetime.now(pnl_helper.tz_tw).strftime("%H:%M")
        )
        
        return PortfolioGroupData(
            summary=summary, holdings=final_holdings, history=history_data,
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d['status']=='pending']
        )
