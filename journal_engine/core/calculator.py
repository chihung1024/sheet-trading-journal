import pandas as pd
import numpy as np
import logging
import pytz
from collections import deque, defaultdict
from datetime import datetime, timedelta
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, DividendRecord, PortfolioGroupData
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE
from .transaction_analyzer import TransactionAnalyzer, PositionSnapshot
from .daily_pnl_helper import DailyPnLHelper
from .currency_detector import CurrencyDetector
from .dividend_policy import (
    UnsupportedDividendPolicyError,
    reviewed_dividend_net_multiplier,
    reviewed_dividend_withholding_rate,
)
from .performance_metrics import annotate_twr_history, calculate_xirr_metric
from .validator import PortfolioValidator

logger = logging.getLogger(__name__)

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client, benchmark_ticker="SPY", api_client=None, oversell_policy="CLAMP", calculation_now=None):
        self.df = transactions_df
        self.market = market_client
        self.benchmark_ticker = benchmark_ticker
        self.api_client = api_client
        self._calculation_now_tw = self._normalize_calculation_now(calculation_now)
        self.pnl_helper = DailyPnLHelper(
            now_provider=(lambda: self._calculation_now_tw)
            if self._calculation_now_tw is not None
            else None
        )
        self.currency_detector = CurrencyDetector()
        self.validator = PortfolioValidator()
        self.oversell_policy = str(oversell_policy or "CLAMP").upper()
        if self.oversell_policy not in {"CLAMP", "ERROR"}:
            raise ValueError(f"Invalid oversell_policy={oversell_policy}. Use 'CLAMP' or 'ERROR'.")

    @staticmethod
    def _normalize_calculation_now(calculation_now):
        if calculation_now is None:
            return None
        if (
            not isinstance(calculation_now, datetime)
            or calculation_now.tzinfo is None
            or calculation_now.utcoffset() is None
        ):
            raise ValueError("calculation_now must be timezone-aware")
        return calculation_now.astimezone(pytz.timezone('Asia/Taipei'))

    def _now_tw(self):
        if self._calculation_now_tw is not None:
            return self._calculation_now_tw
        return datetime.now(self.pnl_helper.tz_tw)

    def _run_now(self):
        """Return a run-level clock value without changing production defaults.

        In replay mode every call returns the same injected Taipei timestamp. In normal
        production mode each call delegates to the same naive system-local
        ``datetime.now()`` used by the legacy ``updated_at`` and date-range call sites.
        """
        if self._calculation_now_tw is not None:
            return self._calculation_now_tw
        return datetime.now()

    @property
    def calculation_as_of(self):
        return self._now_tw().date()

    def _is_taiwan_stock(self, symbol):
        return self.currency_detector.is_base_currency(symbol)

    def _get_effective_fx_rate(self, symbol, fx_context):
        return self.currency_detector.get_fx_multiplier(symbol, fx_context)

    def _get_fx_context(self, value_date, current_fx, realtime=False):
        """Return TWD/native multipliers for a valuation/cash-flow date.

        Production MarketDataClient exposes a currency-aware mapping. Legacy/fake
        clients retain the historical scalar USD/TWD path so existing tests and
        integrations remain backward compatible.
        """
        if realtime and hasattr(self.market, 'get_realtime_fx_snapshot'):
            return self.market.get_realtime_fx_snapshot(value_date)
        if hasattr(self.market, 'get_fx_snapshot'):
            return self.market.get_fx_snapshot(value_date)
        return current_fx

    @staticmethod
    def _serialize_fx_context(fx_context, usd_fx):
        if isinstance(fx_context, dict):
            result = {str(k): float(v) for k, v in fx_context.items()}
            result.setdefault('TWD', 1.0)
            return result
        return {'TWD': 1.0, 'USD': float(usd_fx)}

    @staticmethod
    def _legacy_usd_reference_fx(fx_context, fallback_fx):
        """Return compatibility USD/TWD metadata without creating an FX dependency.

        `history.fx_rate` and snapshot `exchange_rate` are legacy USD/TWD reference
        fields. A TWD-only portfolio must not fail merely because its currency-aware
        context has no USD member; USD is required only when an actual USD/foreign
        valuation path needs it, which is enforced separately by the runner gate.
        """
        if isinstance(fx_context, dict):
            candidate = fx_context.get('USD')
            if candidate is not None:
                try:
                    candidate = float(candidate)
                    if np.isfinite(candidate) and candidate > 0:
                        return candidate
                except (TypeError, ValueError):
                    pass
        return float(fallback_fx)
    
    def _is_us_market_open(self, tw_datetime):
        tw_hour = tw_datetime.hour
        tw_weekday = tw_datetime.weekday()
        if tw_weekday >= 5: return False
        return tw_hour >= 22 or tw_hour < 5

    def _get_benchmark_tax_rate(self):
        """Return a reviewed benchmark dividend rate, or ``None`` if unavailable."""
        return reviewed_dividend_withholding_rate(self.benchmark_ticker)

    def _get_asset_effective_price_and_fx(self, symbol, target_date, current_fx):
        """Return native price and TWD/native valuation multiplier."""
        is_tw = self._is_taiwan_stock(symbol)
        
        if is_tw:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            return price, 1.0

        tw_now = self._now_tw()
        today = tw_now.date()

        used_ts = pd.Timestamp(target_date)
        if hasattr(self.market, 'get_price_asof'):
            price, used_ts = self.market.get_price_asof(symbol, pd.Timestamp(target_date))
        else:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            used_ts = pd.Timestamp(target_date)

        # Currency-aware production path: never replace a missing native FX with
        # DEFAULT_FX_RATE. The runner validates required currencies before calculation,
        # and CurrencyDetector fails closed if the context is incomplete.
        if hasattr(self.market, 'get_fx_snapshot'):
            fx_context = self._get_fx_context(
                used_ts,
                current_fx,
                realtime=(used_ts.date() == today),
            )
            return price, self._get_effective_fx_rate(symbol, fx_context)

        # Legacy scalar USD/TWD compatibility path for existing fake/test clients.
        fx_to_use = DEFAULT_FX_RATE
        try:
            if used_ts.date() == today:
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
                twr=0, twr_status="not_applicable", twr_reason="no_history", twr_invalid_since=None,
                xirr=0, xirr_status="not_applicable", xirr_reason="no_cashflows",
                xirr_asof_date=None, xirr_cashflow_conventional=None,
                realized_pnl=0, benchmark_twr=0, daily_pnl_twd=0,
                daily_pnl_breakdown={"tw_pnl_twd": 0.0, "us_pnl_twd": 0.0},
                market_stage=current_stage, market_stage_desc=stage_desc,
                daily_pnl_asof_date=None, daily_pnl_prev_date=None
            )
            return PortfolioSnapshot(
                updated_at=self._run_now().strftime("%Y-%m-%d %H:%M"),
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
            group_end_date = self._run_now().replace(tzinfo=None)
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
            updated_at=self._run_now().strftime("%Y-%m-%d %H:%M"),
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
        anomalies = []
        anomaly_keys = set()
        xirr_cashflows = []
        
        cumulative_twr_factor = 1.0
        last_market_value_twd = 0.0

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
                "twr": 0.0, "benchmark_twr": 0.0, "fx_rate": round(current_fx, 4),
                "_raw_fx_rate": current_fx,
                "_raw_fx_rates": self._serialize_fx_context(
                    self._get_fx_context(prev_trading_day, current_fx),
                    current_fx,
                ),
                "net_cashflow_twd": 0, "daily_pnl_formula_twd": 0
            })

        for d in date_range:
            current_date = d.date()

            if hasattr(self.market, 'get_fx_snapshot'):
                fx_context = self._get_fx_context(d, current_fx)
                fx = self._legacy_usd_reference_fx(fx_context, current_fx)
            else:
                try:
                    fx = self.market.fx_rates.asof(d)
                    if pd.isna(fx): fx = DEFAULT_FX_RATE
                except Exception:
                    fx = DEFAULT_FX_RATE
                fx_context = fx

            benchmark_p, benchmark_fx = self._get_asset_effective_price_and_fx(self.benchmark_ticker, current_date, current_fx)
            px_twd = benchmark_p * benchmark_fx

            if not benchmark_started and px_twd > 0:
                benchmark_last_val_twd = px_twd
                benchmark_started = True

            net_div_twd = 0.0
            bm_div_per_share = self.market.get_dividend(self.benchmark_ticker, d)
            if bm_div_per_share > 0 and px_twd > 0:
                if benchmark_tax_rate is None:
                    currency = self.currency_detector.detect(self.benchmark_ticker)
                    raise UnsupportedDividendPolicyError(
                        f"Benchmark dividend withholding policy is undefined for {currency} symbol {self.benchmark_ticker}"
                    )
                net_div_twd = bm_div_per_share * (1 - benchmark_tax_rate) * benchmark_fx

            benchmark_twr = 0.0
            if benchmark_started and benchmark_last_val_twd and benchmark_last_val_twd > 1e-9:
                bm_hpr = (px_twd + net_div_twd) / benchmark_last_val_twd
                if not np.isfinite(bm_hpr):
                    bm_hpr = 1.0
                benchmark_cum_factor *= bm_hpr
                benchmark_twr = (benchmark_cum_factor - 1) * 100
                benchmark_last_val_twd = px_twd

            begin_qtys_for_dividend = {sym: h['qty'] for sym, h in holdings.items()}

            daily_txns = df[df['Date'].dt.date == current_date].copy()
            
            if not daily_txns.empty:
                priority_map = {'BUY': 1, 'DIV': 2, 'SELL': 3}
                daily_txns['priority'] = daily_txns['Type'].map(priority_map).fillna(99)
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
                    effective_fx = self._get_effective_fx_rate(sym, fx_context)
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
                    effective_fx = self._get_effective_fx_rate(sym, fx_context)
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
                    effective_fx = self._get_effective_fx_rate(sym, fx_context)
                    div_twd = (row['Qty'] * row['Price']) * effective_fx
                    total_realized_pnl_twd += div_twd
                    realized_pnl_by_symbol[sym] += div_twd
                    xirr_cashflows.append({'date': d, 'amount': div_twd})
                    daily_net_cashflow_twd -= div_twd
                    daily_cashflows_for_dietz.append(-div_twd)

            date_str = d.strftime('%Y-%m-%d')
            for sym, h_data in holdings.items():
                eligible_qty = begin_qtys_for_dividend.get(sym, 0.0)
                if eligible_qty < 1e-6:
                    continue
                    
                div_per_share = self.market.get_dividend(sym, d)
                if div_per_share <= 0:
                    continue
                
                effective_fx = self._get_effective_fx_rate(sym, fx_context)
                div_key = f"{sym}_{date_str}"
                is_confirmed = div_key in confirmed_dividends
                withholding_rate = reviewed_dividend_withholding_rate(sym)
                if withholding_rate is None:
                    if not is_confirmed and div_key not in anomaly_keys:
                        currency = self.currency_detector.detect(sym)
                        anomalies.append({
                            'code': 'DIVIDEND_POLICY_REVIEW_REQUIRED',
                            'symbol': sym,
                            'date': date_str,
                            'currency': currency,
                            'message': (
                                f"Automatic pending dividend not accrued because "
                                f"withholding policy is unreviewed for {currency}"
                            ),
                        })
                        anomaly_keys.add(div_key)
                    # A confirmed DIV already carries the actual net cash flow; an
                    # unconfirmed event must wait for review rather than guess tax.
                    continue
                
                split_factor = self.market.get_transaction_multiplier(sym, d)
                shares_at_ex = eligible_qty / split_factor
                
                total_gross = shares_at_ex * div_per_share
                total_net_native = total_gross * (1.0 - withholding_rate)
                total_net_twd = total_net_native * effective_fx
                currency = self.currency_detector.detect(sym)

                dividend_history.append({
                    'symbol': sym,
                    'ex_date': date_str,
                    'shares_held': eligible_qty,
                    'dividend_per_share_gross': div_per_share,
                    'total_gross': round(total_gross, 2),
                    'tax_rate': round(withholding_rate * 100, 2),
                    'currency': currency,
                    'total_net_native': round(total_net_native, 2),
                    'total_net_usd': round(total_net_native, 2),
                    'total_net_twd': round(total_net_twd, 0),
                    'fx_rate': effective_fx,
                    'status': 'confirmed' if is_confirmed else 'pending'
                })
                
                if not is_confirmed:
                    total_realized_pnl_twd += total_net_twd
                    realized_pnl_by_symbol[sym] += total_net_twd
                    xirr_cashflows.append({'date': d, 'amount': total_net_twd})
                    daily_net_cashflow_twd -= total_net_twd
                    daily_cashflows_for_dietz.append(-total_net_twd)

            current_market_value_twd = 0.0
            
            for sym, h in holdings.items():
                if h['qty'] > 1e-6:
                    price, effective_fx = self._get_asset_effective_price_and_fx(sym, current_date, current_fx)
                    current_market_value_twd += h['qty'] * price * effective_fx
            
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
                "realized_pnl": round(total_realized_pnl_twd, 0), "unrealized_pnl": round(unrealized_pnl, 0),
                "twr": round((cumulative_twr_factor - 1) * 100, 2), 
                "benchmark_twr": round(benchmark_twr, 2),
                "fx_rate": round(float(fx), 4),
                "_raw_fx_rate": float(fx),
                "_raw_fx_rates": self._serialize_fx_context(fx_context, fx),
                "net_cashflow_twd": round(-daily_net_cashflow_twd, 0),
                "_raw_total_value": current_market_value_twd,
                "_raw_net_cashflow_twd": -daily_net_cashflow_twd,
                "daily_pnl_formula_twd": round(current_market_value_twd - prev_market_value_twd + (-daily_net_cashflow_twd), 0) if prev_market_value_twd > 1e-9 else round(current_market_value_twd + (-daily_net_cashflow_twd), 0)
            })

        twr_reliability = annotate_twr_history(history_data)
        if twr_reliability.status == "undefined":
            logger.warning(
                "[%s] Linked TWR reliability is undefined from %s: reason=%s",
                group_name,
                twr_reliability.invalid_since,
                twr_reliability.reason,
            )

        final_holdings = []
        current_holdings_cost_sum = 0.0

        tw_now = self._now_tw()
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

        last_fx_used = current_fx
        prev_fx_used = current_fx
        if len(history_data) >= 2:
            last_fx_used = history_data[-1].get(
                '_raw_fx_rates',
                history_data[-1].get('_raw_fx_rate', history_data[-1].get('fx_rate', current_fx)),
            )
            prev_fx_used = history_data[-2].get(
                '_raw_fx_rates',
                history_data[-2].get('_raw_fx_rate', history_data[-2].get('fx_rate', current_fx)),
            )
        elif len(history_data) == 1:
            last_fx_used = history_data[-1].get(
                '_raw_fx_rates',
                history_data[-1].get('_raw_fx_rate', history_data[-1].get('fx_rate', current_fx)),
            )
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
                effective_fx = self._get_effective_fx_rate(sym, last_fx_used)
                prev_effective_fx = self._get_effective_fx_rate(sym, prev_fx_used)

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
                    proceeds_usd = (r['Qty'] * r['Price']) - r['Commission'] - r['Tax']
                    sell_proceeds_twd += proceeds_usd * effective_fx
                    sell_qty += r['Qty']
                elif r['Type'] == 'DIV':
                    div_income_twd += (r['Qty'] * r['Price']) * effective_fx

            end_qty = h['qty']
            begin_qty = end_qty - buy_qty + sell_qty
            if abs(begin_qty) < 1e-6:
                begin_qty = 0.0

            div_per_share_today = self.market.get_dividend(sym, pd.Timestamp(pnl_base_date))
            if div_per_share_today > 0:
                div_key = f"{sym}_{pnl_base_date.strftime('%Y-%m-%d')}"
                if div_key not in confirmed_dividends:
                    net_multiplier = reviewed_dividend_net_multiplier(sym)
                    if net_multiplier is not None:
                        split_factor = self.market.get_transaction_multiplier(sym, pd.Timestamp(pnl_base_date))
                        shares_at_ex = begin_qty / split_factor
                        total_gross = shares_at_ex * div_per_share_today
                        total_net_native = total_gross * net_multiplier
                        div_income_twd += total_net_native * effective_fx

            sym_net_cf = buy_cost_twd - sell_proceeds_twd - div_income_twd
                
            end_mv_twd = end_qty * curr_p * effective_fx
            begin_mv_twd = begin_qty * prev_p * prev_effective_fx
            total_daily_pnl = (end_mv_twd - begin_mv_twd) + (-sym_net_cf)
            
            fx_pnl_contribution = 0.0
            if not is_tw and begin_qty > 0 and effective_fx != prev_effective_fx:
                fx_pnl_contribution = begin_qty * prev_p * (effective_fx - prev_effective_fx)

            holding_daily_pnl = 0.0
            if end_qty > 0:
                old_qty_retained = max(0.0, begin_qty - sell_qty)
                new_qty_retained = max(0.0, end_qty - old_qty_retained)
                
                if old_qty_retained > 0:
                    holding_daily_pnl += old_qty_retained * (curr_p * effective_fx - prev_p * prev_effective_fx)
                
                if new_qty_retained > 0:
                    buy_txs = sym_txs[sym_txs['Type'] == 'BUY'
                    ]
                    buy_cost_usd_total = (buy_txs['Qty'] * buy_txs['Price'] + buy_txs['Commission'] + buy_txs['Tax']).sum() if not buy_txs.empty else 0.0
                    avg_buy_price = buy_cost_usd_total / buy_qty if buy_qty > 0 else curr_p
                    holding_daily_pnl += new_qty_retained * (curr_p - avg_buy_price) * effective_fx

            daily_pnl_total_raw += total_daily_pnl
            daily_pnl_fx_raw += fx_pnl_contribution
            
            if is_tw:
                daily_pnl_tw_raw += total_daily_pnl
            else:
                # Backward-compatible key name; this bucket now represents all
                # non-TWD securities, not only USD securities.
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

        xirr_terminal_date = history_data[-1]['date'] if history_data else None
        xirr_terminal_value_raw = (
            float(history_data[-1].get('_raw_total_value', last_market_value_twd))
            if history_data
            else 0.0
        )
        xirr_metric = calculate_xirr_metric(
            xirr_cashflows,
            terminal_value_twd=xirr_terminal_value_raw,
            terminal_date=xirr_terminal_date,
        )
        if xirr_metric.status != "ok" and xirr_metric.status != "not_applicable":
            logger.warning(
                "[%s] XIRR unavailable: reason=%s, asof=%s",
                group_name,
                xirr_metric.reason,
                xirr_metric.asof_date,
            )
        elif xirr_metric.cashflow_conventional is False:
            logger.warning(
                "[%s] XIRR uses non-conventional cash flows; multiple roots may exist",
                group_name,
            )

        current_total_value = sum(h.market_value_twd for h in final_holdings)
        current_invested = current_holdings_cost_sum
        current_total_pnl = current_total_value - current_invested + total_realized_pnl_twd
        
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
            twr_status=twr_reliability.status,
            twr_reason=twr_reliability.reason,
            twr_invalid_since=twr_reliability.invalid_since,
            xirr=xirr_metric.value_percent,
            xirr_status=xirr_metric.status,
            xirr_reason=xirr_metric.reason,
            xirr_asof_date=xirr_metric.asof_date,
            xirr_cashflow_conventional=xirr_metric.cashflow_conventional,
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
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d['status']=='pending'],
            anomalies=anomalies,
        )
