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
    def __init__(self, transactions_df, market_client, benchmark_ticker="SPY", api_client=None):
        self.df = transactions_df
        self.market = market_client
        self.benchmark_ticker = benchmark_ticker
        self.api_client = api_client
        self.pnl_helper = DailyPnLHelper()
        self.currency_detector = CurrencyDetector()
        self.validator = PortfolioValidator()

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

    def _is_div_confirmed(self, confirmed_dividends, symbol, check_date, tolerance_days=5):
        # [TWR-FIX] DIV 以使用者輸入入帳日為權威，市場除息偵測改為日期容忍比對，避免重複計入。
        if symbol not in confirmed_dividends:
            return False
        check_ts = pd.Timestamp(check_date).normalize()
        for confirmed_date in confirmed_dividends[symbol]:
            if abs((check_ts - confirmed_date).days) <= tolerance_days:
                return True
        return False

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

        txn_analyzer = TransactionAnalyzer(df)
        
        holdings = {}
        fifo_queues = {}
        invested_capital = 0.0
        total_realized_pnl_twd = 0.0
        realized_pnl_by_symbol = defaultdict(float)
        realized_cost_by_symbol = defaultdict(float)
        history_data = []
        confirmed_dividends = defaultdict(set)  # [TWR-FIX] 以 symbol -> {入帳日} 結構做模糊去重。
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
            # [TWR-FIX] 使用 DIV 交易列 Date(入帳日) 作為權威日期。
            confirmed_dividends[row['Symbol']].add(pd.Timestamp(row['Date']).normalize())

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
                    if not fifo_queues.get(sym) or not fifo_queues[sym]:
                        continue
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
                        if batch['qty'] < 1e-6:
                            fifo_queues[sym].popleft()
                    
                    holdings[sym]['qty'] -= (row['Qty'] - remaining)
                    holdings[sym]['cost_basis_usd'] -= cost_sold_usd
                    holdings[sym]['cost_basis_twd'] -= cost_sold_twd
                    invested_capital -= cost_sold_twd
                    realized_pnl = proceeds_twd - cost_sold_twd
                    total_realized_pnl_twd += realized_pnl
                    realized_pnl_by_symbol[sym] += realized_pnl
                    realized_cost_by_symbol[sym] += cost_sold_twd
                    xirr_cashflows.append({'date': d, 'amount': proceeds_twd})
                    daily_net_cashflow_twd -= proceeds_twd

                elif row['Type'] == 'DIV':
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    div_twd = (row['Qty'] * row['Price']) * effective_fx
                    total_realized_pnl_twd += div_twd
                    realized_pnl_by_symbol[sym] += div_twd
                    xirr_cashflows.append({'date': d, 'amount': div_twd})
                    daily_net_cashflow_twd -= div_twd

            date_str = d.strftime('%Y-%m-%d')
            for sym, h_data in holdings.items():
                if h_data['qty'] < 1e-6:
                    continue
                    
                div_per_share = self.market.get_dividend(sym, d)
                if div_per_share <= 0:
                    continue
                
                effective_fx = self._get_effective_fx_rate(sym, fx)
                # [TWR-FIX] 以 symbol + ±5 天模糊日期比對確認配息，避免除息日/入帳日不一致造成重複。
                is_confirmed = self._is_div_confirmed(confirmed_dividends, sym, d)
                
                split_factor = self.market.get_transaction_multiplier(sym, d)
                shares_at_ex = h_data['qty'] / split_factor
                
                total_gross = shares_at_ex * div_per_share
                total_net_usd = total_gross * 0.7
                total_net_twd = total_net_usd * effective_fx

                dividend_history.append({
                    'symbol': sym,
                    'ex_date': date_str,
                    'shares_held': h_data['qty'],
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

            current_market_value_twd = 0.0
            logging_fx = fx
            
            for sym, h in holdings.items():
                if h['qty'] > 1e-6:
                    price, effective_fx = self._get_asset_effective_price_and_fx(sym, current_date, current_fx)
                    current_market_value_twd += h['qty'] * price * effective_fx
                    logging_fx = effective_fx if not self._is_taiwan_stock(sym) else logging_fx
            
            period_hpr_factor = 1.0
            if last_market_value_twd > 1e-9:
                period_hpr_factor = (current_market_value_twd - daily_net_cashflow_twd) / last_market_value_twd
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
                # 使用者定義: 買進為負、賣出為正
                "net_cashflow_twd": round(-daily_net_cashflow_twd, 0),
                # 當日損益標準定義: 當天淨值 - 前一天淨值 + 當天現金流
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

        daily_pnl_asof_date = None
        daily_pnl_prev_date = None
        unified_fx_prev_ts = None  # ✅ [v3.20] 統一匯率前日基準
        try:
            if hasattr(self.market, 'get_price_asof') and hasattr(self.market, 'get_prev_trading_date'):
                _bp, used_bm = self.market.get_price_asof(self.benchmark_ticker, pd.Timestamp(pnl_base_date))
                prev_bm = self.market.get_prev_trading_date(self.benchmark_ticker, used_bm)
                daily_pnl_asof_date = pd.to_datetime(used_bm).strftime('%Y-%m-%d')
                daily_pnl_prev_date = pd.to_datetime(prev_bm).strftime('%Y-%m-%d')
                # ✅ [v3.20] 統一使用 benchmark 的前日交易日作為匯率參考日
                # 解決不同標的因數據可用性造成 fx_prev 日期不一致的問題
                unified_fx_prev_ts = prev_bm
        except Exception as e:
            logger.debug(f"Failed to get pnl date info for benchmark: {e}")

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
        daily_pnl_fx_raw = 0.0  # ✅ [v3.19] 匯率損益分量

        for sym in candidate_symbols:
            h = holdings.get(sym, {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': None})
            
            is_tw = self._is_taiwan_stock(sym)

            curr_p = self.market.get_price(sym, pd.Timestamp(pnl_base_date))
            used_ts = pd.Timestamp(pnl_base_date)
            if hasattr(self.market, 'get_price_asof'):
                curr_p, used_ts = self.market.get_price_asof(sym, pd.Timestamp(pnl_base_date))

            prev_ts = used_ts - pd.Timedelta(days=1)
            if hasattr(self.market, 'get_prev_trading_date'):
                prev_ts = self.market.get_prev_trading_date(sym, used_ts)
            else:
                while prev_ts.weekday() >= 5:
                    prev_ts -= pd.Timedelta(days=1)

            prev_p = self.market.get_price(sym, pd.Timestamp(prev_ts))

            if is_tw:
                effective_fx = 1.0
                prev_effective_fx = 1.0
            else:
                fx_used = DEFAULT_FX_RATE
                fx_prev = DEFAULT_FX_RATE
                try:
                    # ✅ [v3.19] 盤前也使用即時匯率計算市值
                    # 只要有 realtime_fx_rate，就使用它（無論盤中或盤前）
                    if hasattr(self.market, 'realtime_fx_rate') and self.market.realtime_fx_rate:
                        fx_used = self.market.realtime_fx_rate
                    elif used_ts.date() == pnl_base_date:
                        fx_used = current_fx
                    else:
                        fx_used = self.market.fx_rates.asof(used_ts)
                        if pd.isna(fx_used): fx_used = DEFAULT_FX_RATE

                    # ✅ [v3.20] 使用統一的 benchmark 前日匯率，確保所有美股一致
                    fx_prev_lookup_ts = unified_fx_prev_ts if unified_fx_prev_ts else prev_ts
                    fx_prev = self.market.fx_rates.asof(pd.Timestamp(fx_prev_lookup_ts))
                    if pd.isna(fx_prev): fx_prev = DEFAULT_FX_RATE
                except Exception as e:
                    logger.warning(f"Failed to get FX rates for {sym}: {e}")
                    fx_used = DEFAULT_FX_RATE
                    fx_prev = DEFAULT_FX_RATE

                effective_fx = self._get_effective_fx_rate(sym, fx_used)
                prev_effective_fx = self._get_effective_fx_rate(sym, fx_prev)

            pnl_date = pd.to_datetime(used_ts).date()
            position_snap = txn_analyzer.analyze_today_position(sym, pnl_date, effective_fx, prev_p)
            realized_pnl_today = position_snap.realized_pnl_vs_prev_close

            unrealized_pnl_today = 0.0
            if position_snap.qty > 0:
                # ✅ [v3.18] 使用加權基準價計算未實現損益
                # 舊倉用前日收盤價，新倉用成本價，確保新買入當日不會虛增損益
                base_price = txn_analyzer.get_base_price_for_pnl(position_snap, prev_p)
                curr_mv_twd = position_snap.qty * curr_p * effective_fx
                base_mv_twd = position_snap.qty * base_price * prev_effective_fx
                unrealized_pnl_today = curr_mv_twd - base_mv_twd

            total_daily_pnl = realized_pnl_today + unrealized_pnl_today
            daily_pnl_total_raw += total_daily_pnl
            
            # ✅ [v3.19] 計算匯率損益分量（僅美股）
            # 匯率損益 = 持倉市值 × (當前匯率 - 前日匯率) / 當前匯率
            fx_pnl_contribution = 0.0
            if not is_tw and position_snap.qty > 0 and effective_fx != prev_effective_fx:
                # 純匯率變動帶來的損益（假設股價不變）
                base_price = txn_analyzer.get_base_price_for_pnl(position_snap, prev_p)
                fx_pnl_contribution = position_snap.qty * base_price * (effective_fx - prev_effective_fx)
                daily_pnl_fx_raw += fx_pnl_contribution
            
            if is_tw:
                daily_pnl_tw_raw += total_daily_pnl
            else:
                # 美股損益扣除匯率部分，避免重複計算
                daily_pnl_us_raw += (total_daily_pnl - fx_pnl_contribution)

            try:
                sym_txs = df[(df['Symbol'] == sym) & (df['Date'].dt.date == pnl_date)]
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
                    daily_change_percent=daily_change_pct, daily_pl_twd=round(total_daily_pnl, 0)
                ))

        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        daily_pnl_formula_twd = None
        if len(history_data) >= 2:
            last_day = history_data[-1]
            prev_day = history_data[-2]
            daily_pnl_formula_twd = (
                (last_day.get('total_value', 0) - prev_day.get('total_value', 0)) +
                last_day.get('net_cashflow_twd', 0)
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
            # 找到前一個交易日的總資產淨值作為基準
            prev_day_data = history_data[-2]  # 倒數第二筆是前一日
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
                    "fx_pnl_twd": round(daily_pnl_fx_raw, 0)  # ✅ [v3.19] 新增匯率損益
                } if pnl_deviation <= 5 else None
            ),
            market_stage=current_stage,
            market_stage_desc=stage_desc,
            daily_pnl_asof_date=daily_pnl_asof_date,
            daily_pnl_prev_date=daily_pnl_prev_date,
            daily_pnl_roi_percent=daily_pnl_roi_percent,
            daily_pnl_base_value=round(daily_pnl_base_value, 0) if daily_pnl_base_value else None
        )
        
        self.validator.validate_twr_calculation(history_data)
        # ✅ [v3.19] 驗證台/美/匯率損益分量加總
        if pnl_deviation <= 5:
            self.validator.validate_daily_pnl_breakdown(
                display_daily_pnl, daily_pnl_tw_raw, daily_pnl_us_raw, daily_pnl_fx_raw
            )
        
        return PortfolioGroupData(
            summary=summary, holdings=final_holdings, history=history_data,
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d['status']=='pending']
        )
