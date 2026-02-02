import pandas as pd
import numpy as np
import logging
import pytz
from collections import deque, defaultdict
from datetime import datetime, timedelta
from pyxirr import xirr
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, DividendRecord, PortfolioGroupData
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE, BENCHMARK_TAX_RATE_US, BENCHMARK_TAX_RATE_TW, Config
from .transaction_analyzer import TransactionAnalyzer, PositionSnapshot
from .market_stage_detector import get_market_detector
from .currency_detector import CurrencyDetector
from .validator import PortfolioValidator

logger = logging.getLogger(__name__)

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client, benchmark_ticker="SPY", api_client=None):
        self.df = transactions_df
        self.market = market_client
        self.benchmark_ticker = benchmark_ticker
        self.api_client = api_client
        self.detector = get_market_detector()  # [v14.0] 採用統一校時中心
        self.currency_detector = CurrencyDetector()
        self.validator = PortfolioValidator()

    def _is_taiwan_stock(self, symbol):
        return self.currency_detector.is_base_currency(symbol)

    def _get_effective_fx_rate(self, symbol, fx_rate):
        return self.currency_detector.get_fx_multiplier(symbol, fx_rate)

    def _get_benchmark_tax_rate(self):
        """Benchmark 配息預扣稅率：美股 30%，台股 0%。"""
        if self._is_taiwan_stock(self.benchmark_ticker):
            return BENCHMARK_TAX_RATE_TW
        return BENCHMARK_TAX_RATE_US

    def _get_asset_effective_price_and_fx(self, symbol, target_date, current_fx):
        """取得特定日期的估值價格與匯率乘數。"""
        is_tw = self._is_taiwan_stock(symbol)
        if is_tw:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            return price, 1.0

        # 非台幣資產處理
        price, used_ts = self.market.get_price_asof(symbol, pd.Timestamp(target_date))
        
        # 取得該日期的收盤匯率
        try:
            fx_to_use = self.market.fx_rates.asof(used_ts)
            if pd.isna(fx_to_use):
                fx_to_use = DEFAULT_FX_RATE
        except:
            fx_to_use = DEFAULT_FX_RATE

        return price, self._get_effective_fx_rate(symbol, fx_to_use)

    def run(self):
        """[v14.0] 多群組核心計算入口。"""
        logger.info(f"=== 開始多群組計算 (NAV 版, baseline: {self.benchmark_ticker}) ===")
        
        # 取得即時匯率 (T1)
        current_fx = self.market.realtime_fx_rate if self.market.realtime_fx_rate else DEFAULT_FX_RATE
        
        current_stage, stage_desc, tw_now, _ = self.detector.get_current_stage()
        benchmark_tax_rate = self._get_benchmark_tax_rate()

        if self.df.empty:
            empty_summary = PortfolioSummary(
                total_value=0, invested_capital=0, total_pnl=0, 
                twr=0, xirr=0, realized_pnl=0, benchmark_twr=0, daily_pnl_twd=0,
                market_stage=current_stage, market_stage_desc=stage_desc
            )
            return PortfolioSnapshot(
                updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
                base_currency=BASE_CURRENCY, exchange_rate=round(current_fx, 2),
                summary=empty_summary, holdings=[], history=[], pending_dividends=[],
                groups={"all": PortfolioGroupData(summary=empty_summary, holdings=[], history=[], pending_dividends=[])}
            )
            
        # 執行拆股調整
        self._back_adjust_transactions_global()

        # 彙整標籤
        all_tags = set()
        for tags_str in self.df['Tag'].dropna().unique():
            if tags_str:
                all_tags.update([t.strip() for t in tags_str.replace(';', ',').split(',') if t.strip()])
        
        groups_to_calc = ['all'] + sorted(list(all_tags))

        final_groups_data = {}
        for group_name in groups_to_calc:
            if group_name == 'all':
                group_df = self.df.copy()
            else:
                mask = self.df['Tag'].apply(lambda x: group_name in [t.strip() for t in (x or '').replace(';', ',').split(',')] if x else False)
                group_df = self.df[mask].copy()
            
            if group_df.empty: continue

            # 定義計算區間
            group_start_date = group_df['Date'].min()
            group_end_date = tw_now.replace(tzinfo=None)
            date_range = pd.date_range(start=group_start_date, end=group_end_date, freq='D').normalize()

            final_groups_data[group_name] = self._calculate_single_portfolio(
                group_df, date_range, current_fx, group_name,
                current_stage, stage_desc, benchmark_tax_rate
            )

        all_data = final_groups_data.get('all')
        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY, exchange_rate=round(current_fx, 2),
            summary=all_data.summary, holdings=all_data.holdings,
            history=all_data.history, pending_dividends=all_data.pending_dividends,
            groups=final_groups_data
        )

    def _back_adjust_transactions_global(self):
        """[Scheme A] 根據拆股因子調整原始交易量與價格。"""
        for index, row in self.df.iterrows():
            if row['Type'] not in ['BUY', 'SELL']: continue
            sym, dt = row['Symbol'], row['Date']
            split_factor = self.market.get_transaction_multiplier(sym, dt)
            if split_factor != 1.0:
                self.df.at[index, 'Qty'] = row['Qty'] * split_factor
                self.df.at[index, 'Price'] = (row['Price'] / split_factor)

    def _calculate_single_portfolio(self, df, date_range, current_fx, group_name, current_stage, stage_desc, benchmark_tax_rate):
        """計算單一組合的歷史與現況。"""
        df = df.copy()
        for col in ['Commission', 'Tax']:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0).abs()

        txn_analyzer = TransactionAnalyzer(df)
        holdings, fifo_queues = {}, {}
        invested_capital, total_realized_pnl_twd = 0.0, 0.0
        history_data, dividend_history, xirr_cashflows = [], [], []
        cumulative_twr_factor, last_market_value_twd = 1.0, 0.0

        # Benchmark 追蹤
        benchmark_cum_factor, benchmark_last_val_twd, benchmark_started = 1.0, None, False

        # --- 第一階段：歷史每日淨值計算 (TWR 基礎) ---
        if not df.empty:
            first_tx_date = df['Date'].min()
            t0_init = self.detector._get_previous_trading_day(first_tx_date.date())
            bp_init, bfx_init = self._get_asset_effective_price_and_fx(self.benchmark_ticker, t0_init, current_fx)
            if bp_init * bfx_init > 0:
                benchmark_last_val_twd = bp_init * bfx_init
                benchmark_started = True
            history_data.append({"date": t0_init.strftime('%Y-%m-%d'), "total_value": 0, "invested": 0, "twr": 0.0, "benchmark_twr": 0.0})

        for d in date_range:
            curr_date = d.date()
            fx_hist = self.market.fx_rates.asof(d) if not self.market.fx_rates.empty else DEFAULT_FX_RATE
            if pd.isna(fx_hist): fx_hist = DEFAULT_FX_RATE

            # Benchmark 每日增長
            bp, bfx = self._get_asset_effective_price_and_fx(self.benchmark_ticker, curr_date, current_fx)
            px_twd = bp * bfx
            if not benchmark_started and px_twd > 0:
                benchmark_last_val_twd = px_twd
                benchmark_started = True
            
            bm_div_twd = 0.0
            bm_dps = self.market.get_dividend(self.benchmark_ticker, d)
            if bm_dps > 0 and px_twd > 0:
                bm_div_twd = bm_dps * (1 - benchmark_tax_rate) * bfx

            if benchmark_started and benchmark_last_val_twd and benchmark_last_val_twd > 1e-9:
                benchmark_cum_factor *= (px_twd + bm_div_twd) / benchmark_last_val_twd
                benchmark_last_val_twd = px_twd

            # 處理當日交易
            daily_txns = df[df['Date'].dt.date == curr_date].copy()
            daily_net_cashflow_twd = 0.0
            if not daily_txns.empty:
                daily_txns['priority'] = daily_txns['Type'].map({'BUY': 1, 'DIV': 2, 'SELL': 3}).fillna(99)
                for _, row in daily_txns.sort_values('priority').iterrows():
                    sym = row['Symbol']
                    if sym not in holdings:
                        holdings[sym] = {'qty': 0.0, 'cost_basis_twd': 0.0, 'cost_basis_usd': 0.0, 'tag': row['Tag']}
                        fifo_queues[sym] = deque()
                    
                    eff_fx = self._get_effective_fx_rate(sym, fx_hist)
                    if row['Type'] == 'BUY':
                        cost_usd = (row['Qty'] * row['Price']) + row['Commission'] + row['Tax']
                        cost_twd = cost_usd * eff_fx
                        holdings[sym]['qty'] += row['Qty']
                        holdings[sym]['cost_basis_twd'] += cost_twd
                        holdings[sym]['cost_basis_usd'] += cost_usd
                        fifo_queues[sym].append({'qty': row['Qty'], 'cost_total_twd': cost_twd, 'cost_total_usd': cost_usd})
                        invested_capital += cost_twd
                        daily_net_cashflow_twd += cost_twd
                        xirr_cashflows.append({'date': d, 'amount': -cost_twd})
                    elif row['Type'] == 'SELL':
                        if sym in fifo_queues:
                            proceeds_twd = ((row['Qty'] * row['Price']) - row['Commission'] - row['Tax']) * eff_fx
                            rem, c_sold_twd, c_sold_usd = row['Qty'], 0.0, 0.0
                            while rem > 1e-6 and fifo_queues[sym]:
                                b = fifo_queues[sym][0]
                                take = min(rem, b['qty'])
                                frac = take / b['qty']
                                c_sold_twd += b['cost_total_twd'] * frac
                                c_sold_usd += b['cost_total_usd'] * frac
                                b['qty'] -= take
                                b['cost_total_twd'] -= b['cost_total_twd'] * frac
                                b['cost_total_usd'] -= b['cost_total_usd'] * frac
                                rem -= take
                                if b['qty'] < 1e-6: fifo_queues[sym].popleft()
                            holdings[sym]['qty'] -= (row['Qty'] - rem)
                            holdings[sym]['cost_basis_twd'] -= c_sold_twd
                            holdings[sym]['cost_basis_usd'] -= c_sold_usd
                            invested_capital -= c_sold_twd
                            total_realized_pnl_twd += (proceeds_twd - c_sold_twd)
                            daily_net_cashflow_twd -= proceeds_twd
                            xirr_cashflows.append({'date': d, 'amount': proceeds_twd})

            # 計算當日總市值與 TWR 因子
            curr_mv_twd = 0.0
            for sym, h in holdings.items():
                if h['qty'] > 1e-6:
                    p, eff_fx = self._get_asset_effective_price_and_fx(sym, curr_date, current_fx)
                    curr_mv_twd += h['qty'] * p * eff_fx
            
            if last_market_value_twd > 1e-9:
                cumulative_twr_factor *= (curr_mv_twd - daily_net_cashflow_twd) / last_market_value_twd
            elif curr_mv_twd > 1e-9 and daily_net_cashflow_twd > 1e-9:
                cumulative_twr_factor *= curr_mv_twd / daily_net_cashflow_twd
            
            last_market_value_twd = curr_mv_twd
            u_pnl = curr_mv_twd - sum(h['cost_basis_twd'] for h in holdings.values() if h['qty'] > 1e-6)
            history_data.append({
                "date": d.strftime('%Y-%m-%d'), "total_value": round(curr_mv_twd, 0),
                "invested": round(invested_capital, 0), "twr": round((cumulative_twr_factor - 1) * 100, 2),
                "benchmark_twr": round((benchmark_cum_factor - 1) * 100, 2)
            })

        # --- 第二階段：[v14.0] 精確當日損益 (NAV 價值變動) ---
        has_tw = any(self._is_taiwan_stock(s) for s in holdings.keys())
        v_dates = self.detector.get_valuation_dates(is_taiwan_stock=has_tw)
        t0, t1 = v_dates['t0'], v_dates['t1']
        
        # 鎖定基準日匯率 (FX0)
        fx0 = self.market.fx_rates.asof(t0) if not self.market.fx_rates.empty else DEFAULT_FX_RATE
        if pd.isna(fx0): fx0 = DEFAULT_FX_RATE

        daily_pnl_nav_twd, daily_pnl_tw, daily_pnl_us = 0.0, 0.0, 0.0
        final_holdings, current_cost_sum = [], 0.0
        
        # 標的物迴圈
        candidate_syms = set([k for k, v in holdings.items() if v['qty'] > 1e-4])
        for sym in candidate_syms:
            h = holdings[sym]
            is_tw = self._is_taiwan_stock(sym)
            p1, _ = self.market.get_price_asof(sym, pd.Timestamp(t1))
            p0 = self.market.get_price(sym, pd.Timestamp(t0))
            
            eff_fx1 = 1.0 if is_tw else current_fx
            eff_fx0 = 1.0 if is_tw else self._get_effective_fx_rate(sym, fx0)
            
            # 取得當日買賣資訊
            pos_snap = txn_analyzer.analyze_today_position(sym, t1)
            # 損益基準價：新買入用成本，舊持倉用前收
            calc_p0 = txn_analyzer.get_base_price_for_pnl(pos_snap, p0)
            
            # 🚀 NAV 損益公式：Q * (P1*FX1 - P0*FX0)
            u_pnl_today = h['qty'] * (p1 * eff_fx1 - calc_p0 * eff_fx0)
            r_pnl_today = pos_snap.realized_pnl * eff_fx1 # 暫時性，待更新 txn_analyzer
            
            total_today = u_pnl_today + r_pnl_today
            daily_pnl_nav_twd += total_today
            if is_tw: daily_pnl_tw += total_today
            else: daily_pnl_us += total_today

            # 持倉物件
            mv_twd = h['qty'] * p1 * eff_fx1
            current_cost_sum += h['cost_basis_twd']
            final_holdings.append(HoldingPosition(
                symbol=sym, tag=h['tag'], currency=self.currency_detector.detect(sym), qty=h['qty'],
                market_value_twd=round(mv_twd, 0), pnl_twd=round(mv_twd - h['cost_basis_twd'], 0),
                pnl_percent=round((mv_twd - h['cost_basis_twd']) / h['cost_basis_twd'] * 100, 2) if h['cost_basis_twd'] > 0 else 0,
                current_price_origin=round(p1, 2), avg_cost_usd=round(h['cost_basis_usd'] / h['qty'], 2) if h['qty'] > 0 else 0,
                prev_close_price=round(p0, 2), daily_change_usd=round(p1 - p0, 2),
                daily_change_percent=round((p1 - p0) / p0 * 100, 2) if p0 > 0 else 0,
                daily_pl_twd=round(total_today, 0), prev_fx_rate=eff_fx0, curr_fx_rate=eff_fx1
            ))

        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        # XIRR 計算
        xirr_val = 0.0
        if xirr_cashflows:
            cfs = xirr_cashflows + [{'date': datetime.now(), 'amount': last_market_value_twd}]
            try: xirr_val = round(xirr([c['date'] for c in cfs], [c['amount'] for c in cfs]) * 100, 2)
            except: pass

        summary = PortfolioSummary(
            total_value=round(last_market_value_twd, 0),
            invested_capital=round(invested_capital, 0),
            total_pnl=round(last_market_value_twd - invested_capital + total_realized_pnl_twd, 0),
            twr=history_data[-1]['twr'] if history_data else 0,
            xirr=xirr_val,
            realized_pnl=round(total_realized_pnl_twd, 0),
            benchmark_twr=history_data[-1]['benchmark_twr'] if history_data else 0,
            daily_pnl_twd=round(daily_pnl_nav_twd, 0),
            daily_pnl_breakdown={"tw_pnl_twd": round(daily_pnl_tw, 0), "us_pnl_twd": round(daily_pnl_us, 0)},
            market_stage=current_stage, market_stage_desc=stage_desc,
            daily_pnl_asof_date=t1.strftime('%Y-%m-%d'), daily_pnl_prev_date=t0.strftime('%Y-%m-%d'),
            daily_pnl_prev_fx=fx0, daily_pnl_curr_fx=current_fx
        )
        
        return PortfolioGroupData(summary=summary, holdings=final_holdings, history=history_data, pending_dividends=[])
