import pandas as pd
import numpy as np
import logging
from collections import deque
from datetime import datetime, timedelta
from pyxirr import xirr
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, DividendRecord, PortfolioGroupData
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE
from .transaction_analyzer import TransactionAnalyzer, PositionSnapshot
from .daily_pnl_helper import DailyPnLHelper
from .currency_detector import CurrencyDetector  # [v2.48] 自动货币识别
from .validator import PortfolioValidator  # [v2.48] 自动验证

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
        self.pnl_helper = DailyPnLHelper()
        self.currency_detector = CurrencyDetector()
        self.validator = PortfolioValidator()

    def _is_taiwan_stock(self, symbol):
        """[v2.48] 判斷是否為台股"""
        return self.currency_detector.is_base_currency(symbol)

    def _get_effective_fx_rate(self, symbol, fx_rate):
        """[v2.48] 根據標的取得有效匯率"""
        return self.currency_detector.get_fx_multiplier(symbol, fx_rate)
    
    def _get_asset_effective_price_and_fx(self, symbol, target_date, current_fx, is_history=False):
        """
        [v2.50 FIX] 取得資產有效價格與匯率
        - 歷史循環 (is_history=True): 使用 target_date 當日收盤價，確保 TWR 計算準確。
        - 即時顯示 (is_history=False): 美股使用 T-1 日價格，符合市場最新狀態。
        """
        is_tw = self._is_taiwan_stock(symbol)
        price_date = target_date
        fx_to_use = current_fx
        
        if not is_tw:
            if is_history:
                # 歷史計算必須使用當日收盤，避免與當日交易成本產生巨大錯位
                price_date = target_date
            else:
                # 僅在最終顯示(Today)使用 T-1 邏輯
                price_date = target_date - timedelta(days=1)
        
        price = self.market.get_price(symbol, pd.Timestamp(price_date))
        effective_fx = self._get_effective_fx_rate(symbol, fx_to_use)
        return price, effective_fx

    def run(self):
        """執行多群組投資組合計算主流程 (v2.48 Automated)"""
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
        current_stage, stage_desc = self.pnl_helper.get_market_stage()

        all_tags = set()
        for tags_str in self.df['Tag'].dropna().unique():
            if not tags_str: continue
            all_tags.update([t.strip() for t in tags_str.replace(';', ',').split(',') if t.strip()])
        
        groups_to_calc = ['all'] + sorted(list(all_tags))
        final_groups_data = {}
        
        for group_name in groups_to_calc:
            if group_name == 'all':
                group_df = self.df.copy()
            else:
                mask = self.df['Tag'].apply(lambda x: group_name in [t.strip() for t in (x or '').replace(';', ',').split(',')])
                group_df = self.df[mask].copy()
            
            if group_df.empty: continue
            group_start_date = group_df['Date'].min()
            group_date_range = pd.date_range(start=group_start_date, end=datetime.now(), freq='D').normalize()
            final_groups_data[group_name] = self._calculate_single_portfolio(group_df, group_date_range, current_fx, group_name)

        all_data = final_groups_data.get('all')
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
        """全域交易數據復權處理"""
        for index, row in self.df.iterrows():
            sym, date = row['Symbol'], row['Date']
            if row['Type'] not in ['BUY', 'SELL']: continue
            split_factor = self.market.get_transaction_multiplier(sym, date)
            div_adj_factor = 1.0 if self._is_taiwan_stock(sym) else self.market.get_dividend_adjustment_factor(sym, date)
            
            if split_factor != 1.0 or div_adj_factor != 1.0:
                self.df.at[index, 'Qty'] = row['Qty'] * split_factor
                self.df.at[index, 'Price'] = (row['Price'] / split_factor) * div_adj_factor

    def _get_previous_trading_day(self, date):
        prev_date = date - timedelta(days=1)
        while prev_date.weekday() >= 5: prev_date -= timedelta(days=1)
        return prev_date

    def _calculate_single_portfolio(self, df, date_range, current_fx, group_name="unknown"):
        """單一群組的核心計算邏輯 (v2.50 穩定性增強版)"""
        txn_analyzer = TransactionAnalyzer(df)
        holdings, fifo_queues = {}, {}
        invested_capital = 0.0
        total_realized_pnl_twd = 0.0
        history_data, confirmed_dividends, dividend_history, xirr_cashflows = [], set(), [], []
        cumulative_twr_factor, last_market_value_twd, first_benchmark_val_twd = 1.0, 0.0, None

        for _, row in df[df['Type'] == 'DIV'].iterrows():
            confirmed_dividends.add(f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}")

        # 初始虛擬點對齊
        if not df.empty:
            prev_day = self._get_previous_trading_day(df['Date'].min())
            try:
                prev_fx = self.market.fx_rates.asof(prev_day.replace(hour=23, minute=59))
                if pd.isna(prev_fx): prev_fx = DEFAULT_FX_RATE
            except: prev_fx = DEFAULT_FX_RATE
            
            p = self.market.get_price(self.benchmark_ticker, prev_day)
            first_benchmark_val_twd = p * self._get_effective_fx_rate(self.benchmark_ticker, prev_fx)
            history_data.append({
                "date": prev_day.strftime('%Y-%m-%d'), "total_value": 0, "invested": 0, 
                "net_profit": 0, "realized_pnl": 0, "unrealized_pnl": 0, "twr": 0.0, 
                "benchmark_twr": 0.0, "fx_rate": round(prev_fx, 4)
            })

        for d in date_range:
            curr_date = d.date()
            try:
                fx = current_fx if curr_date == datetime.now().date() else self.market.fx_rates.asof(d.replace(hour=23, minute=59))
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: fx = DEFAULT_FX_RATE
            
            # 基準計算
            benchmark_p = self.market.get_price(self.benchmark_ticker, d)
            curr_benchmark_twd = benchmark_p * self._get_effective_fx_rate(self.benchmark_ticker, fx)
            if first_benchmark_val_twd is None: first_benchmark_val_twd = curr_benchmark_twd

            # 當日資金進出初始化
            daily_inflow_twd = 0.0
            daily_outflow_twd = 0.0
            daily_txns = df[df['Date'].dt.date == curr_date].sort_values(by='Type', ascending=True)
            
            for _, row in daily_txns.iterrows():
                sym = row['Symbol']
                if sym not in holdings:
                    holdings[sym] = {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': row['Tag']}
                    fifo_queues[sym] = deque()

                eff_fx = self._get_effective_fx_rate(sym, fx)
                if row['Type'] == 'BUY':
                    cost_usd = (row['Qty'] * row['Price']) + row['Commission'] + row['Tax']
                    cost_twd = cost_usd * eff_fx
                    holdings[sym]['qty'] += row['Qty']
                    holdings[sym]['cost_basis_usd'] += cost_usd
                    holdings[sym]['cost_basis_twd'] += cost_twd
                    fifo_queues[sym].append({'qty': row['Qty'], 'cost_total_usd': cost_usd, 'cost_total_twd': cost_twd})
                    invested_capital += cost_twd
                    daily_inflow_twd += cost_twd
                    xirr_cashflows.append({'date': d, 'amount': -cost_twd})
                elif row['Type'] == 'SELL':
                    proceeds_twd = ((row['Qty'] * row['Price']) - row['Commission'] - row['Tax']) * eff_fx
                    remaining = row['Qty']
                    c_usd, c_twd = 0.0, 0.0
                    while remaining > 1e-6 and fifo_queues[sym]:
                        b = fifo_queues[sym][0]
                        take = min(remaining, b['qty'])
                        frac = take / b['qty']
                        c_usd += b['cost_total_usd'] * frac
                        c_twd += b['cost_total_twd'] * frac
                        b['qty'] -= take
                        b['cost_total_usd'] -= b['cost_total_usd'] * frac
                        b['cost_total_twd'] -= b['cost_total_twd'] * frac
                        remaining -= take
                        if b['qty'] < 1e-6: fifo_queues[sym].popleft()
                    holdings[sym]['qty'] -= row['Qty']
                    holdings[sym]['cost_basis_usd'] -= c_usd
                    holdings[sym]['cost_basis_twd'] -= c_twd
                    invested_capital -= c_twd
                    total_realized_pnl_twd += (proceeds_twd - c_twd)
                    daily_outflow_twd += proceeds_twd
                    xirr_cashflows.append({'date': d, 'amount': proceeds_twd})
                elif row['Type'] == 'DIV':
                    div_val = row['Price'] * eff_fx
                    total_realized_pnl_twd += div_val
                    daily_outflow_twd += div_val
                    xirr_cashflows.append({'date': d, 'amount': div_val})

            # 配息處理
            date_str = d.strftime('%Y-%m-%d')
            for sym, h in holdings.items():
                div_ps = self.market.get_dividend(sym, d)
                if div_ps > 0 and h['qty'] > 1e-6:
                    eff_fx = self._get_effective_fx_rate(sym, fx)
                    split = self.market.get_transaction_multiplier(sym, d)
                    total_net_twd = (h['qty'] / split) * div_ps * 0.7 * eff_fx
                    dividend_history.append({'symbol': sym, 'ex_date': date_str, 'total_net_twd': round(total_net_twd, 0), 'status': 'pending'})
                    if f"{sym}_{date_str}" not in confirmed_dividends:
                        total_realized_pnl_twd += total_net_twd
                        daily_outflow_twd += total_net_twd
                        xirr_cashflows.append({'date': d, 'amount': total_net_twd})

            # [v2.50] TWR 關鍵計算邏輯：穩定公式
            curr_market_val = 0.0
            for sym, h in holdings.items():
                if h['qty'] > 1e-6:
                    p, eff_fx = self._get_asset_effective_price_and_fx(sym, d, fx, is_history=True)
                    curr_market_val += h['qty'] * p * eff_fx
            
            # 使用 Robust TWR 公式：(End + Out) / (Start + In)
            denominator = last_market_value_twd + daily_inflow_twd
            if denominator > 1e-6:
                hpr = (curr_market_val + daily_outflow_twd) / denominator
                cumulative_twr_factor *= max(0, hpr) # 確保不出現負值
            
            last_market_value_twd = curr_market_val
            unrealized = curr_market_val - sum(h['cost_basis_twd'] for h in holdings.values() if h['qty'] > 1e-6)
            bench_twr = (curr_benchmark_twd / first_benchmark_val_twd - 1) * 100 if first_benchmark_val_twd else 0.0
            
            history_data.append({
                "date": date_str, "total_value": round(curr_market_val, 0), "invested": round(invested_capital, 0),
                "net_profit": round(unrealized + total_realized_pnl_twd, 0), "realized_pnl": round(total_realized_pnl_twd, 0),
                "unrealized_pnl": round(unrealized, 0), "twr": round((cumulative_twr_factor - 1) * 100, 2),
                "benchmark_twr": round(bench_twr, 2), "fx_rate": round(fx, 4)
            })

        # 最終 Snapshot 產生
        final_holdings = []
        for sym, h in holdings.items():
            if h['qty'] < 1e-4: continue
            is_tw = self._is_taiwan_stock(sym)
            eff_date = self.pnl_helper.get_effective_display_date(is_tw)
            p, eff_fx = self._get_asset_effective_price_and_fx(sym, datetime.now(), current_fx, is_history=False)
            mkt_val = h['qty'] * p * eff_fx
            cost = h['cost_basis_twd']
            final_holdings.append(HoldingPosition(
                symbol=sym, tag=h['tag'], currency=self.currency_detector.detect(sym), qty=round(h['qty'], 2),
                market_value_twd=round(mkt_val, 0), pnl_twd=round(mkt_val - cost, 0),
                pnl_percent=round((mkt_val - cost) / cost * 100, 2) if cost > 0 else 0,
                current_price_origin=round(p, 2), avg_cost_usd=round(h['cost_basis_usd'] / h['qty'], 2),
                daily_pl_twd=0 # 簡化
            ))
        
        summary = PortfolioSummary(
            total_value=round(sum(h.market_value_twd for h in final_holdings), 0),
            invested_capital=round(sum(h['cost_basis_twd'] for h in holdings.values() if h['qty'] > 1e-6), 0),
            total_pnl=round(sum(h.pnl_twd for h in final_holdings) + total_realized_pnl_twd, 0),
            twr=history_data[-1]['twr'], xirr=0, realized_pnl=round(total_realized_pnl_twd, 0),
            benchmark_twr=history_data[-1]['benchmark_twr'], daily_pnl_twd=0
        )
        return PortfolioGroupData(summary=summary, holdings=final_holdings, history=history_data, 
                                  pending_dividends=[DividendRecord(**d) for d in dividend_history])
