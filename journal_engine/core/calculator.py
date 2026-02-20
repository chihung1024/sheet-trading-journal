import pandas as pd
import numpy as np
import logging
import pytz
from collections import deque, defaultdict
from datetime import datetime, timedelta
from pyxirr import xirr
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, DividendRecord, PortfolioGroupData
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE, BENCHMARK_TAX_RATE_US, BENCHMARK_TAX_RATE_TW
from .transaction_analyzer import TransactionAnalyzer, PositionSnapshot
from .daily_pnl_helper import DailyPnLHelper
from .currency_detector import CurrencyDetector
from .validator import PortfolioValidator

logger = logging.getLogger(__name__)

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client, benchmark_ticker="SPY", api_client=None, oversell_policy="CLAMP"):
        self.df = transactions_df
        self.market = market_client
        self.benchmark_ticker = benchmark_ticker
        self.api_client = api_client
        self.pnl_helper = DailyPnLHelper()
        self.currency_detector = CurrencyDetector()
        self.validator = PortfolioValidator()
        self.oversell_policy = str(oversell_policy or "CLAMP").upper()
        if self.oversell_policy not in {"CLAMP", "ERROR"}:
            raise ValueError(f"Invalid oversell_policy={oversell_policy}. Use 'CLAMP' or 'ERROR'.")

    def _is_taiwan_stock(self, symbol):
        return self.currency_detector.is_base_currency(symbol)

    def _get_effective_fx_rate(self, symbol, fx_rate):
        return self.currency_detector.get_fx_multiplier(symbol, fx_rate)
    
    def _is_us_market_open(self, tw_datetime):
        tw_hour = tw_datetime.hour
        tw_weekday = tw_datetime.weekday()
        if tw_weekday >= 5: return False
        return tw_hour >= 22 or tw_hour < 5

    def _get_benchmark_tax_rate(self):
        """Benchmark 配息預扣稅率：美股 30%，台股 0%。"""
        if self._is_taiwan_stock(self.benchmark_ticker):
            return BENCHMARK_TAX_RATE_TW
        return BENCHMARK_TAX_RATE_US

    def _get_asset_effective_price_and_fx(self, symbol, target_date, current_fx):
        """取得估值價格與匯率（與先前版本相同）。"""
        is_tw = self._is_taiwan_stock(symbol)
        
        if is_tw:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            return price, 1.0

        tw_now = datetime.now(self.pnl_helper.tz_tw)
        today = tw_now.date()

        used_ts = pd.Timestamp(target_date)
        if hasattr(self.market, 'get_price_asof'):
            price, used_ts = self.market.get_price_asof(symbol, pd.Timestamp(target_date))
        else:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            used_ts = pd.Timestamp(target_date)

        fx_to_use = DEFAULT_FX_RATE
        try:
            # ✅ [v3.19] 今日資料優先使用即時匯率（含盤中與盤前）
            # 確保曲線圖與當日損益卡片使用相同匯率
            if used_ts.date() == today:
                # 優先使用即時匯率
                if hasattr(self.market, 'realtime_fx_rate') and self.market.realtime_fx_rate:
                    fx_to_use = self.market.realtime_fx_rate
                else:
                    fx_to_use = current_fx
            else:
                fx_to_use = self.market.fx_rates.asof(used_ts)
                if pd.isna(fx_to_use):
                    fx_to_use = DEFAULT_FX_RATE
        except Exception as e:
            logger.warning(f"Failed to get FX rate for {symbol} at {used_ts}: {e}")
            fx_to_use = DEFAULT_FX_RATE

        return price, self._get_effective_fx_rate(symbol, fx_to_use)

    def run(self):
        logger.info(f"=== 開始多群組計算 (baseline: {self.benchmark_ticker}) ===")
        
        current_fx = DEFAULT_FX_RATE
        if hasattr(self.market, 'realtime_fx_rate') and self.market.realtime_fx_rate:
            current_fx = self.market.realtime_fx_rate
        elif not self.market.fx_rates.empty:
            current_fx = float(self.market.fx_rates.iloc[-1])

        current_stage, stage_desc = self.pnl_helper.get_market_stage()
        benchmark_tax_rate = self._get_benchmark_tax_rate()

        if self.df.empty:
            logger.warning("無交易記錄")
            empty_summary = PortfolioSummary(
                total_value=0, invested_capital=0, total_pnl=0, 
                twr=0, xirr=0, realized_pnl=0, benchmark_twr=0, daily_pnl_twd=0,
                daily_pnl_breakdown={"tw_pnl_twd": 0.0, "us_pnl_twd": 0.0},
                market_stage=current_stage, market_stage_desc=stage_desc,
                daily_pnl_asof_date=None, daily_pnl_prev_date=None
            )
            return PortfolioSnapshot(
                updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
                base_currency=BASE_CURRENCY, exchange_rate=round(current_fx, 2),
                summary=empty_summary, holdings=[], history=[], pending_dividends=[],
                groups={"all": PortfolioGroupData(summary=empty_summary, holdings=[], history=[], pending_dividends=[])}
            )
            
        self._back_adjust_transactions_global()

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
                mask = self.df['Tag'].apply(
                    lambda x: group_name in [t.strip() for t in (x or '').replace(';', ',').split(',')]
                )
                group_df = self.df[mask].copy()
            
            if group_df.empty: continue

            group_start_date = group_df['Date'].min()
            group_end_date = datetime.now()
            group_date_range = self._get_trading_date_range(group_df, group_start_date, group_end_date)

            group_result = self._calculate_single_portfolio(
                group_df, group_date_range, current_fx, group_name,
                current_stage, stage_desc, benchmark_tax_rate
            )
            final_groups_data[group_name] = group_result

        all_data = final_groups_data.get('all')
        if not all_data:
            logger.error("無法產出 'all' 群組數據")
            return None
        
        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY, exchange_rate=round(current_fx, 2),
            summary=all_data.summary, holdings=all_data.holdings,
            history=all_data.history, pending_dividends=all_data.pending_dividends,
            groups=final_groups_data
        )

    def _get_trading_date_range(self, group_df, start_date, end_date):
        """使用持倉資產的實際交易日聯集，避免假日造成曲線平坦。"""
        symbols = [s for s in group_df['Symbol'].dropna().unique()]
        trading_dates = set()
        start_ts = pd.Timestamp(start_date).normalize()
        end_ts = pd.Timestamp(end_date).normalize()

        for sym in symbols:
            try:
                if sym not in self.market.market_data:
                    continue
                idx = self.market.market_data[sym].index
                if idx.tz is not None:
                    idx = idx.tz_localize(None)
                mask = (idx >= start_ts) & (idx <= end_ts)
                trading_dates.update(idx[mask])
            except Exception as e:
                logger.debug(f"Failed to build trading dates for {sym}: {e}")

        if not trading_dates:
            return pd.date_range(start=start_ts, end=end_ts, freq='D').normalize()

        return pd.DatetimeIndex(sorted(trading_dates)).normalize()

    def _back_adjust_transactions_global(self):
        """Scheme A: only adjust for splits (to align transactions with split-adjusted Close)."""
        for index, row in self.df.iterrows():
            if row['Type'] not in ['BUY', 'SELL']:
                continue

            sym, date = row['Symbol'], row['Date']
            split_factor = self.market.get_transaction_multiplier(sym, date)

            if split_factor != 1.0:
                self.df.at[index, 'Qty'] = row['Qty'] * split_factor
                self.df.at[index, 'Price'] = (row['Price'] / split_factor)

    def _get_previous_trading_day(self, symbol, date):
        """取得上一個有效交易日。"""
        try:
            if hasattr(self.market, 'get_price_asof') and hasattr(self.market, 'get_prev_trading_date'):
                _p, used = self.market.get_price_asof(symbol, pd.Timestamp(date))
                prev = self.market.get_prev_trading_date(symbol, used)
                return pd.to_datetime(prev).tz_localize(None).normalize()
        except Exception as e:
            logger.debug(f"Fallback to simple prev day for {symbol}: {e}")

        d = pd.Timestamp(date).date()
        prev_date = d - timedelta(days=1)
        while prev_date.weekday() >= 5:
            prev_date -= timedelta(days=1)
        return pd.Timestamp(prev_date).normalize()

    @classmethod
    def _calculate_modified_dietz_return(cls, beginning_value: float, ending_value: float, cashflows: list[float], weights: list[float] = None) -> float:
        """Calculate Modified Dietz return for a sub-period.
        r = (V1 - V0 - ΣCF) / (V0 + Σ(w_i * CF_i))
        """
        if beginning_value < 0:
            return 0.0

        if not cashflows:
            return (ending_value - beginning_value) / beginning_value if beginning_value > 1e-9 else 0.0

        if weights is None:
            # 日頻資料預設：假設所有現金流發生在期中 (weight = 0.5)
            weights = [0.5] * len(cashflows)

        weighted_cashflows = sum(w * cf for w, cf in zip(weights, cashflows))
        denominator = beginning_value + weighted_cashflows

        if abs(denominator) < 1e-9:
            return 0.0

        numerator = ending_value - beginning_value - sum(cashflows)
        r = numerator / denominator
        if not np.isfinite(r):
            return 0.0
        return r

    def _calculate_single_portfolio(self, df, date_range, current_fx, group_name="unknown", current_stage="CLOSED", stage_desc="Markets Closed", benchmark_tax_rate=0.0):
        # (1) Normalize Commission/Tax sign BEFORE any calculation
        df = df.copy()
        for col in ['Commission', 'Tax']:
            if col not in df.columns:
                df[col] = 0.0
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
            neg_cnt = int((df[col] < 0).sum())
            if neg_cnt > 0:
                logger.warning(f"[{group_name}] {col} has {neg_cnt} negative rows; normalized with abs().")
            df[col] = df[col].abs()
        
        holdings = {}
        fifo_queues = {}
        invested_capital = 0.0
        total_realized_pnl_twd = 0.0
        realized_pnl_by_symbol = defaultdict(float)
        realized_cost_by_symbol = defaultdict(float)
        history_data = []
        confirmed_dividends = set()
        dividend_history = []
        xirr_cashflows = []
        
        cumulative_twr_factor = 1.0
        last_market_value_twd = 0.0

        # Benchmark: total-return (linked / TWR-style)
        benchmark_cum_factor = 1.0
        benchmark_last_val_twd = None
        benchmark_started = False

        div_txs = df[df['Type'] == 'DIV'].copy()
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            confirmed_dividends.add(key)

        if not df.empty:
            first_tx_date = df['Date'].min()
            prev_trading_day = self._get_previous_trading_day(self.benchmark_ticker, first_tx_date)

            prev_benchmark_p, prev_benchmark_fx = self._get_asset_effective_price_and_fx(self.benchmark_ticker, prev_trading_day, current_fx)
            prev_benchmark_val_twd = prev_benchmark_p * prev_benchmark_fx

            if prev_benchmark_val_twd > 0:
                benchmark_last_val_twd = prev_benchmark_val_twd
                benchmark_started = True

            history_data.append({
                "date": prev_trading_day.strftime('%Y-%m-%d'), "total_value": 0,
                "invested": 0, "net_profit": 0, "realized_pnl": 0, "unrealized_pnl": 0,
                "twr": 0.0, "benchmark_twr": 0.0, "fx_rate": round(prev_benchmark_fx if prev_benchmark_fx else DEFAULT_FX_RATE, 4),
                "_raw_fx_rate": prev_benchmark_fx if prev_benchmark_fx else DEFAULT_FX_RATE,
                "net_cashflow_twd": 0, "daily_pnl_formula_twd": 0
            })

        last_fx = current_fx
        
        for d in date_range:
            current_date = d.date()
            
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except:
                fx = DEFAULT_FX_RATE

            benchmark_p, benchmark_fx = self._get_asset_effective_price_and_fx(self.benchmark_ticker, current_date, current_fx)
            px_twd = benchmark_p * benchmark_fx

            if not benchmark_started and px_twd > 0:
                benchmark_last_val_twd = px_twd
                benchmark_started = True

            net_div_twd = 0.0
            bm_div_per_share = self.market.get_dividend(self.benchmark_ticker, d)
            if bm_div_per_share > 0 and px_twd > 0:
                net_div_twd = bm_div_per_share * (1 - benchmark_tax_rate) * benchmark_fx

            benchmark_twr = 0.0
            if benchmark_started and benchmark_last_val_twd and benchmark_last_val_twd > 1e-9:
                bm_hpr = (px_twd + net_div_twd) / benchmark_last_val_twd
                if not np.isfinite(bm_hpr):
                    bm_hpr = 1.0
                benchmark_cum_factor *= bm_hpr
                benchmark_twr = (benchmark_cum_factor - 1) * 100
                benchmark_last_val_twd = px_twd

            # ✅ [修正] 在處理今日交易前，先快照「期初股數 (begin_qty)」，這才是真正有資格領股息的部位
            begin_qtys_for_dividend = {sym: h['qty'] for sym, h in holdings.items()}

            daily_txns = df[df['Date'].dt.date == current_date].copy()
            
            if not daily_txns.empty:
                priority_map = {'BUY': 1, 'DIV': 2, 'SELL': 3}
                daily_txns['priority'] = daily_txns['Type'].map(priority_map).fillna(99)
                
                # 優先使用 Timestamp 或 Sequence 保持真實交易軌跡，最後才 fallback 到交易類型 priority
                sort_cols = []
                if 'Timestamp' in daily_txns.columns:
                    sort_cols.append('Timestamp')
                if 'Sequence' in daily_txns.columns:
                    sort_cols.append('Sequence')
                sort_cols.append('priority')
                
                daily_txns = daily_txns.sort_values(by=sort_cols, kind='stable')
            
            daily_net_cashflow_twd = 0.0
            daily_cashflows_for_dietz = []
            
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
                    daily_cashflows_for_dietz.append(cost_twd)

                elif row['Type'] == 'SELL':
                    if not fifo_queues.get(sym) or not fifo_queues[sym]:
                        logger.warning(f"[{group_name}] {sym} on {current_date}: SELL ignored due to empty position.")
                        continue

                    sell_qty_requested = float(row['Qty'])
                    available_qty = sum(batch['qty'] for batch in fifo_queues[sym])
                    executable_qty = min(sell_qty_requested, available_qty)
                    if executable_qty <= 1e-9:
                        logger.warning(f"[{group_name}] {sym} on {current_date}: SELL ignored (available=0).")
                        continue
                    if executable_qty + 1e-9 < sell_qty_requested:
                        msg = (
                            f"Oversell detected for {sym} on {current_date}: "
                            f"requested={sell_qty_requested}, executable={executable_qty}"
                        )
                        if self.oversell_policy == "ERROR":
                            raise ValueError(msg)
                        logger.warning(f"[{group_name}] {msg}")

                    execution_ratio = executable_qty / sell_qty_requested if sell_qty_requested > 0 else 0.0
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    executed_commission = row['Commission'] * execution_ratio
                    executed_tax = row['Tax'] * execution_ratio
                    proceeds_twd = ((executable_qty * row['Price']) - executed_commission - executed_tax) * effective_fx
                    remaining = executable_qty
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
                        if batch['qty'] < 1e-6:
                            fifo_queues[sym].popleft()
                    
                    executed_qty = executable_qty - remaining
                    holdings[sym]['qty'] -= executed_qty
                    holdings[sym]['cost_basis_usd'] -= cost_sold_usd
                    holdings[sym]['cost_basis_twd'] -= cost_sold_twd
                    invested_capital -= cost_sold_twd
                    realized_pnl = proceeds_twd - cost_sold_twd
                    total_realized_pnl_twd += realized_pnl
                    realized_pnl_by_symbol[sym] += realized_pnl
                    realized_cost_by_symbol[sym] += cost_sold_twd
                    xirr_cashflows.append({'date': d, 'amount': proceeds_twd})
                    daily_net_cashflow_twd -= proceeds_twd
                    daily_cashflows_for_dietz.append(-proceeds_twd)

                elif row['Type'] == 'DIV':
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    div_twd = (row['Qty'] * row['Price']) * effective_fx
                    total_realized_pnl_twd += div_twd
                    realized_pnl_by_symbol[sym] += div_twd
                    xirr_cashflows.append({'date': d, 'amount': div_twd})
                    daily_net_cashflow_twd -= div_twd
                    daily_cashflows_for_dietz.append(-div_twd)

            date_str = d.strftime('%Y-%m-%d')
            for sym, h_data in holdings.items():
                # ✅ [修正] 改用期初股數判斷配息資格，避免當日買賣造成股息錯亂
                eligible_qty = begin_qtys_for_dividend.get(sym, 0.0)
                if eligible_qty < 1e-6:
                    continue
                    
                div_per_share = self.market.get_dividend(sym, d)
                if div_per_share <= 0:
                    continue
                
                effective_fx = self._get_effective_fx_rate(sym, fx)
                div_key = f"{sym}_{date_str}"
                is_confirmed = div_key in confirmed_dividends
                
                split_factor = self.market.get_transaction_multiplier(sym, d)
                # ✅ [修正] 使用 eligible_qty 計算除權息
                shares_at_ex = eligible_qty / split_factor
                
                total_gross = shares_at_ex * div_per_share
                total_net_usd = total_gross * 0.7
                total_net_twd = total_net_usd * effective_fx

                dividend_history.append({
                    'symbol': sym,
                    'ex_date': date_str,
                    'shares_held': eligible_qty,  # ✅ 顯示除權息時持有的正確股數
                    'dividend_per_share_gross': div_per_share,
                    'total_gross': round(total_gross, 2),
                    'total_net_usd': round(total_net_usd, 2),
                    'total_net_twd': round(total_net_twd, 0),
                    'fx_rate': fx,
                    'status': 'confirmed' if is_confirmed else 'pending'
                })
                
                if not is_confirmed:
                    total_realized_pnl_twd += total_net_twd
                    realized_pnl_by_symbol[sym] += total_net_twd
                    xirr_cashflows.append({'date': d, 'amount': total_net_twd})
                    daily_net_cashflow_twd -= total_net_twd
                    daily_cashflows_for_dietz.append(-total_net_twd)

            current_market_value_twd = 0.0
            logging_fx = fx
            
            for sym, h in holdings.items():
                if h['qty'] > 1e-6:
                    price, effective_fx = self._get_asset_effective_price_and_fx(sym, current_date, current_fx)
                    current_market_value_twd += h['qty'] * price * effective_fx
                    logging_fx = effective_fx if not self._is_taiwan_stock(sym) else logging_fx
            
            period_hpr_factor = 1.0
            if last_market_value_twd > 1e-9:
                period_return = self._calculate_modified_dietz_return(
                    beginning_value=last_market_value_twd,
                    ending_value=current_market_value_twd,
                    cashflows=daily_cashflows_for_dietz,
                )
                period_hpr_factor = 1.0 + period_return
            elif current_market_value_twd > 1e-9 and daily_net_cashflow_twd > 1e-9:
                period_hpr_factor = current_market_value_twd / daily_net_cashflow_twd

            if not np.isfinite(period_hpr_factor):
                period_hpr_factor = 1.0
            
            cumulative_twr_factor *= period_hpr_factor
            prev_market_value_twd = last_market_value_twd
            last_market_value_twd = current_market_value_twd
            
            unrealized_pnl = current_market_value_twd - sum(h['cost_basis_twd'] for h in holdings.values() if h['qty'] > 1e-6)
            total_pnl = unrealized_pnl + total_realized_pnl_twd

            history_data.append({
                "date": date_str, "total_value": round(current_market_value_twd, 0),
                "invested": round(invested_capital, 0), "net_profit": round(total_pnl, 0),
                "realized_pnl": round(total_realized_pnl_twd, 0),
                "unrealized_pnl": round(unrealized_pnl, 0),
                "twr": round((cumulative_twr_factor - 1) * 100, 2), 
                "benchmark_twr": round(benchmark_twr, 2),
                "fx_rate": round(logging_fx, 4),
                "_raw_fx_rate": logging_fx,
                "net_cashflow_twd": round(-daily_net_cashflow_twd, 0),
                # ✅ [修正] 加入隱藏的原始精度，杜絕 1~2 元的捨入誤差
                "_raw_total_value": current_market_value_twd,
                "_raw_net_cashflow_twd": -daily_net_cashflow_twd,
                "daily_pnl_formula_twd": round(current_market_value_twd - prev_market_value_twd + (-daily_net_cashflow_twd), 0) if prev_market_value_twd > 1e-9 else round(current_market_value_twd + (-daily_net_cashflow_twd), 0)
            })

        final_holdings = []
        current_holdings_cost_sum = 0.0

        tw_now = datetime.now(self.pnl_helper.tz_tw)
        today = tw_now.date()
        pnl_base_date = today
        pnl_prev_date = None
        if history_data:
            try:
                pnl_base_date = pd.to_datetime(history_data[-1]['date']).date()
                if len(history_data) >= 2:
                    pnl_prev_date = pd.to_datetime(history_data[-2]['date']).date()
            except Exception as e:
                logger.debug(f"Failed to derive pnl dates from history: {e}")

        # ✅ [核心修正] 強制取得歷史迴圈結算時確切使用的 FX Rate，消除匯率時間差錯位
        last_fx_used = current_fx
        prev_fx_used = current_fx
        if len(history_data) >= 2:
            last_fx_used = history_data[-1].get('_raw_fx_rate', history_data[-1].get('fx_rate', current_fx))
            prev_fx_used = history_data[-2].get('_raw_fx_rate', history_data[-2].get('fx_rate', current_fx))
        elif len(history_data) == 1:
            last_fx_used = history_data[-1].get('_raw_fx_rate', history_data[-1].get('fx_rate', current_fx))
            prev_fx_used = last_fx_used

        us_asof_date = None
        tw_asof_date = None
        try:
            if hasattr(self.market, 'get_price_asof'):
                unique_symbols = [s for s in df['Symbol'].dropna().unique()]
                us_ref = next((s for s in unique_symbols if not self._is_taiwan_stock(s)), None)
                tw_ref = next((s for s in unique_symbols if self._is_taiwan_stock(s)), None)

                if us_ref:
                    _p, used_ts = self.market.get_price_asof(us_ref, pd.Timestamp(pnl_base_date))
                    us_asof_date = pd.to_datetime(used_ts).date()
                if tw_ref:
                    _p, used_ts = self.market.get_price_asof(tw_ref, pd.Timestamp(pnl_base_date))
                    tw_asof_date = pd.to_datetime(used_ts).date()
        except Exception as e:
            logger.debug(f"Failed to get asof dates: {e}")
            us_asof_date = None
            tw_asof_date = None

        candidate_symbols = set([k for k, v in holdings.items() if v['qty'] > 1e-4])

        try:
            if us_asof_date:
                us_tx = df[df['Date'].dt.date == us_asof_date]
                for s in us_tx['Symbol'].unique():
                    if not self._is_taiwan_stock(s):
                        candidate_symbols.add(s)
            if tw_asof_date:
                tw_tx = df[df['Date'].dt.date == tw_asof_date]
                for s in tw_tx['Symbol'].unique():
                    if self._is_taiwan_stock(s):
                        candidate_symbols.add(s)
        except Exception as e:
            logger.debug(f"Failed to add transaction symbols to candidates: {e}")

        daily_pnl_total_raw = 0.0
        daily_pnl_tw_raw = 0.0
        daily_pnl_us_raw = 0.0
        daily_pnl_fx_raw = 0.0 

        for sym in candidate_symbols:
            h = holdings.get(sym, {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': None})
            is_tw = self._is_taiwan_stock(sym)

            # 強制對齊歷史迴圈使用的確切價格
            curr_p = self.market.get_price(sym, pd.Timestamp(pnl_base_date))
            if hasattr(self.market, 'get_price_asof'):
                curr_p, _ = self.market.get_price_asof(sym, pd.Timestamp(pnl_base_date))

            if pnl_prev_date:
                prev_p = self.market.get_price(sym, pd.Timestamp(pnl_prev_date))
                if hasattr(self.market, 'get_price_asof'):
                    prev_p, _ = self.market.get_price_asof(sym, pd.Timestamp(pnl_prev_date))
            else:
                prev_p = curr_p

            if is_tw:
                effective_fx = 1.0
                prev_effective_fx = 1.0
            else:
                # 確保聚合法採用與 Formula 完全一致的匯率基礎
                effective_fx = self._get_effective_fx_rate(sym, last_fx_used)
                prev_effective_fx = self._get_effective_fx_rate(sym, prev_fx_used)

            # ✅ 嚴格還原該標的當日現金流，確保 100% 數學對齊
            sym_txs = df[(df['Symbol'] == sym) & (df['Date'].dt.date == pnl_base_date)]
            buy_cost_twd = 0.0
            sell_proceeds_twd = 0.0
            div_income_twd = 0.0
            buy_qty = 0.0
            sell_qty = 0.0
            
            for _, r in sym_txs.iterrows():
                if r['Type'] == 'BUY':
                    cost_usd = (r['Qty'] * r['Price']) + r['Commission'] + r['Tax']
                    buy_cost_twd += cost_usd * effective_fx
                    buy_qty += r['Qty']
                elif r['Type'] == 'SELL':
                    # 扣除手續費/稅以得到真實淨流出
                    proceeds_usd = (r['Qty'] * r['Price']) - r['Commission'] - r['Tax']
                    sell_proceeds_twd += proceeds_usd * effective_fx
                    sell_qty += r['Qty']
                elif r['Type'] == 'DIV':
                    div_income_twd += (r['Qty'] * r['Price']) * effective_fx

            end_qty = h['qty']
            begin_qty = end_qty - buy_qty + sell_qty
            if abs(begin_qty) < 1e-6:
                begin_qty = 0.0

            # Pending Dividends 也必須視作正現金流
            div_per_share_today = self.market.get_dividend(sym, pd.Timestamp(pnl_base_date))
            if div_per_share_today > 0:
                div_key = f"{sym}_{pnl_base_date.strftime('%Y-%m-%d')}"
                if div_key not in confirmed_dividends:
                    split_factor = self.market.get_transaction_multiplier(sym, pd.Timestamp(pnl_base_date))
                    # ✅ [修正] 除權息必須基於 begin_qty (昨日留倉)，而非今日買賣後的 h['qty']
                    shares_at_ex = begin_qty / split_factor
                    total_gross = shares_at_ex * div_per_share_today
                    total_net_usd = total_gross * 0.7
                    div_income_twd += total_net_usd * effective_fx

            # 該標的當日淨現金流 = 買入成本 - 賣出所得 - 股息收入 (正數代表現金轉股票)
            sym_net_cf = buy_cost_twd - sell_proceeds_twd - div_income_twd
                
            end_mv_twd = end_qty * curr_p * effective_fx
            begin_mv_twd = begin_qty * prev_p * prev_effective_fx
            
            # ✅ [核心代數恆等式] 單一標的當日損益 = 市值差額 + 當日淨現金流入
            # 如此確保每一分錢的變動 (包含匯差、除權息、交易稅) 都被 100% 收斂
            total_daily_pnl = (end_mv_twd - begin_mv_twd) + (-sym_net_cf)
            
            # 純匯率損益 (FX PnL) 僅歸因於昨日結轉留倉的原始部位
            fx_pnl_contribution = 0.0
            if not is_tw and begin_qty > 0 and effective_fx != prev_effective_fx:
                fx_pnl_contribution = begin_qty * prev_p * (effective_fx - prev_effective_fx)

            # 持倉列 UI 顯示值 (Holding Daily PnL)：僅顯示未實現之當前持倉損益
            holding_daily_pnl = 0.0
            if end_qty > 0:
                old_qty_retained = max(0.0, begin_qty - sell_qty)
                new_qty_retained = max(0.0, end_qty - old_qty_retained)
                
                if old_qty_retained > 0:
                    holding_daily_pnl += old_qty_retained * (curr_p * effective_fx - prev_p * prev_effective_fx)
                
                if new_qty_retained > 0:
                    buy_txs = sym_txs[sym_txs['Type'] == 'BUY']
                    buy_cost_usd_total = (buy_txs['Qty'] * buy_txs['Price'] + buy_txs['Commission'] + buy_txs['Tax']).sum() if not buy_txs.empty else 0.0
                    avg_buy_price = buy_cost_usd_total / buy_qty if buy_qty > 0 else curr_p
                    holding_daily_pnl += new_qty_retained * (curr_p - avg_buy_price) * effective_fx

            daily_pnl_total_raw += total_daily_pnl
            daily_pnl_fx_raw += fx_pnl_contribution
            
            if is_tw:
                daily_pnl_tw_raw += total_daily_pnl
            else:
                daily_pnl_us_raw += (total_daily_pnl - fx_pnl_contribution)

            try:
                if (not h.get('tag')) and (not sym_txs.empty):
                    tags = sym_txs['Tag'].dropna()
                    if not tags.empty:
                        h['tag'] = tags.iloc[0]
            except Exception as e:
                logger.debug(f"Failed to get tag for {sym}: {e}")

            cost = h['cost_basis_twd']
            current_holdings_cost_sum += cost
            mkt_val = h['qty'] * curr_p * effective_fx
            daily_change_pct = round((curr_p - prev_p) / prev_p * 100, 2) if prev_p > 0 else 0.0
            currency = self.currency_detector.detect(sym)
            realized_pnl_symbol = realized_pnl_by_symbol.get(sym, 0.0)
            total_pnl_symbol = (mkt_val - cost) + realized_pnl_symbol
            pnl_cost_basis = cost + realized_cost_by_symbol.get(sym, 0.0)

            if h['qty'] > 1e-4 or abs(total_daily_pnl) > 1:
                 final_holdings.append(HoldingPosition(
                    symbol=sym, tag=h.get('tag'), currency=currency, qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0), pnl_twd=round(total_pnl_symbol, 0),
                    pnl_percent=round(total_pnl_symbol / pnl_cost_basis * 100, 2) if pnl_cost_basis > 0 else 0,
                    current_price_origin=round(curr_p, 2), 
                    avg_cost_usd=round(h['cost_basis_usd'] / h['qty'], 2) if h['qty'] > 0 else 0,
                    prev_close_price=round(prev_p, 2), daily_change_usd=round(curr_p - prev_p, 2),
                    daily_change_percent=daily_change_pct, daily_pl_twd=round(holding_daily_pnl, 0)
                ))

        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        daily_pnl_formula_twd = None
        if len(history_data) >= 2:
            last_day = history_data[-1]
            prev_day = history_data[-2]
            # ✅ [修正] 提取 _raw 欄位進行無損相減，徹底將 pnl_deviation 逼近 0.00
            daily_pnl_formula_twd = (
                (last_day.get('_raw_total_value', last_day.get('total_value', 0)) - 
                 prev_day.get('_raw_total_value', prev_day.get('total_value', 0))) +
                last_day.get('_raw_net_cashflow_twd', last_day.get('net_cashflow_twd', 0))
            )

        display_daily_pnl = daily_pnl_formula_twd if daily_pnl_formula_twd is not None else daily_pnl_total_raw

        pnl_deviation = abs(display_daily_pnl - daily_pnl_total_raw)
        if pnl_deviation > 5:
            logger.warning(
                f"Daily PnL formula/aggregation mismatch: formula={display_daily_pnl:.2f}, "
                f"aggregate={daily_pnl_total_raw:.2f}, deviation={pnl_deviation:.2f}"
            )
        self.validator.validate_daily_balance(holdings, invested_capital, current_holdings_cost_sum)
        
        xirr_val = 0.0
        if xirr_cashflows:
            curr_val_sum = sum(h.market_value_twd for h in final_holdings)
            xirr_cashflows_calc = xirr_cashflows.copy()
            xirr_cashflows_calc.append({'date': datetime.now(), 'amount': curr_val_sum})
            try:
                xirr_res = xirr([x['date'] for x in xirr_cashflows_calc], [x['amount'] for x in xirr_cashflows_calc])
                xirr_val = round(xirr_res * 100, 2)
            except: pass

        current_total_value = sum(h.market_value_twd for h in final_holdings)
        current_invested = current_holdings_cost_sum
        current_total_pnl = current_total_value - current_invested + total_realized_pnl_twd
        
        # ✅ [v3.18] 後端計算當日報酬率，避免前端依賴 history 索引
        daily_pnl_base_value = None
        daily_pnl_roi_percent = None
        if len(history_data) >= 2:
            prev_day_data = history_data[-2]  
            daily_pnl_base_value = prev_day_data.get('total_value', 0)
            if daily_pnl_base_value and daily_pnl_base_value > 0:
                daily_pnl_roi_percent = round((display_daily_pnl / daily_pnl_base_value) * 100, 2)
        
        summary = PortfolioSummary(
            total_value=round(current_total_value, 0),
            invested_capital=round(current_invested, 0),
            total_pnl=round(current_total_pnl, 0),
            twr=history_data[-1]['twr'] if history_data else 0,
            xirr=xirr_val,
            realized_pnl=round(total_realized_pnl_twd, 0),
            benchmark_twr=history_data[-1]['benchmark_twr'] if history_data else 0,
            daily_pnl_twd=round(display_daily_pnl, 0),
            daily_pnl_breakdown=(
                {
                    "tw_pnl_twd": round(daily_pnl_tw_raw, 0), 
                    "us_pnl_twd": round(daily_pnl_us_raw, 0),
                    "fx_pnl_twd": round(daily_pnl_fx_raw, 0)
                } if pnl_deviation <= 5 else None
            ),
            market_stage=current_stage,
            market_stage_desc=stage_desc,
            daily_pnl_asof_date=pd.to_datetime(pnl_base_date).strftime('%Y-%m-%d') if pnl_base_date else None,
            daily_pnl_prev_date=pd.to_datetime(pnl_prev_date).strftime('%Y-%m-%d') if pnl_prev_date else None,
            daily_pnl_roi_percent=daily_pnl_roi_percent,
            daily_pnl_base_value=round(daily_pnl_base_value, 0) if daily_pnl_base_value else None
        )
        
        self.validator.validate_twr_calculation(history_data)
        if pnl_deviation <= 5:
            self.validator.validate_daily_pnl_breakdown(
                display_daily_pnl, daily_pnl_tw_raw, daily_pnl_us_raw, daily_pnl_fx_raw
            )
        
        return PortfolioGroupData(
            summary=summary, holdings=final_holdings, history=history_data,
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d['status']=='pending']
        )
