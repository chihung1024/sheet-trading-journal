import pandas as pd
import numpy as np
import logging
import pytz
from collections import deque, defaultdict
from datetime import datetime, timedelta
from pyxirr import xirr
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, DividendRecord, PortfolioGroupData
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE
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

    def _get_asset_effective_price_and_fx(self, symbol, target_date, current_fx):
        """取得估值價格與匯率。

        重要修正：
        - 價格：一律以 MarketDataClient 的 as-of/pad 結果為準（非交易日就取最近交易日）。
        - 匯率：只有在「實際用到的交易日 == 今天」且美股盤中時才用 current_fx；
               其他情況（含週末/假日 pad 到前一交易日）一律用 fx_rates.asof(used_date)。

        這可以徹底避免：週末/假日 curr/prev 都 pad 到同一天，導致 daily pnl 變 0。
        """
        is_tw = self._is_taiwan_stock(symbol)
        
        if is_tw:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            return price, 1.0

        tw_now = datetime.now(self.pnl_helper.tz_tw)
        today = tw_now.date()

        # 價格 (as-of/pad)
        used_ts = pd.Timestamp(target_date)
        if hasattr(self.market, 'get_price_asof'):
            price, used_ts = self.market.get_price_asof(symbol, pd.Timestamp(target_date))
        else:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            used_ts = pd.Timestamp(target_date)

        # 匯率：只有「實際 used_date 就是今天」且盤中，才用即時匯率
        fx_to_use = DEFAULT_FX_RATE
        try:
            if used_ts.date() == today and self._is_us_market_open(tw_now):
                fx_to_use = current_fx
            else:
                fx_to_use = self.market.fx_rates.asof(used_ts)
                if pd.isna(fx_to_use):
                    fx_to_use = DEFAULT_FX_RATE
        except:
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

        if self.df.empty:
            logger.warning("無交易記錄")
            empty_summary = PortfolioSummary(
                total_value=0, invested_capital=0, total_pnl=0, 
                twr=0, xirr=0, realized_pnl=0, benchmark_twr=0, daily_pnl_twd=0,
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
            group_date_range = pd.date_range(start=group_start_date, end=group_end_date, freq='D').normalize()

            group_result = self._calculate_single_portfolio(group_df, group_date_range, current_fx, group_name, current_stage, stage_desc)
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

    def _back_adjust_transactions_global(self):
        """Scheme A: only adjust for splits (to align transactions with split-adjusted Close).

        - Qty *= split_factor
        - Price /= split_factor
        - Do NOT apply dividend adjustment to transaction price (avoid dividend double-counting).
        """
        for index, row in self.df.iterrows():
            if row['Type'] not in ['BUY', 'SELL']:
                continue

            sym, date = row['Symbol'], row['Date']
            split_factor = self.market.get_transaction_multiplier(sym, date)

            if split_factor != 1.0:
                self.df.at[index, 'Qty'] = row['Qty'] * split_factor
                self.df.at[index, 'Price'] = (row['Price'] / split_factor)

    def _get_previous_trading_day(self, symbol, date):
        """取得上一個有效交易日。

        優先使用 MarketDataClient 的 index（可涵蓋美股/台股假日），避免僅跳過週末造成 pad 對齊錯誤。
        """
        try:
            if hasattr(self.market, 'get_price_asof') and hasattr(self.market, 'get_prev_trading_date'):
                _p, used = self.market.get_price_asof(symbol, pd.Timestamp(date))
                prev = self.market.get_prev_trading_date(symbol, used)
                return pd.to_datetime(prev).tz_localize(None).normalize()
        except:
            pass

        d = pd.Timestamp(date).date()
        prev_date = d - timedelta(days=1)
        while prev_date.weekday() >= 5:
            prev_date -= timedelta(days=1)
        return pd.Timestamp(prev_date).normalize()

    def _calculate_single_portfolio(self, df, date_range, current_fx, group_name="unknown", current_stage="CLOSED", stage_desc="Markets Closed"):
        txn_analyzer = TransactionAnalyzer(df)
        
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

        # ✅ 收集所有 DIV 記錄的 key（標記為已確認）
        div_txs = df[df['Type'] == 'DIV'].copy()
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            confirmed_dividends.add(key)

        if not df.empty:
            first_tx_date = df['Date'].min()
            prev_trading_day = self._get_previous_trading_day(self.benchmark_ticker, first_tx_date)
            
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
                "date": prev_trading_day.strftime('%Y-%m-%d'), "total_value": 0,
                "invested": 0, "net_profit": 0, "realized_pnl": 0, "unrealized_pnl": 0,
                "twr": 0.0, "benchmark_twr": 0.0, "fx_rate": round(prev_fx, 4)
            })

        last_fx = current_fx
        
        for d in date_range:
            current_date = d.date()
            
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
                    # ✅ 簡化計算：Qty × Price（前端已處理淨額）
                    div_twd = (row['Qty'] * row['Price']) * effective_fx
                    total_realized_pnl_twd += div_twd
                    xirr_cashflows.append({'date': d, 'amount': div_twd})
                    daily_net_cashflow_twd -= div_twd

            # ✅ 市場配息檢測 - 僅處理「未在 records 中確認」的配息
            date_str = d.strftime('%Y-%m-%d')
            for sym, h_data in holdings.items():
                if h_data['qty'] < 1e-6:
                    continue
                    
                div_per_share = self.market.get_dividend(sym, d)
                if div_per_share <= 0:
                    continue
                
                effective_fx = self._get_effective_fx_rate(sym, fx)
                div_key = f"{sym}_{date_str}"
                
                # 🎯 關鍵邏輯：已確認的配息跳過市場計算
                is_confirmed = div_key in confirmed_dividends
                
                split_factor = self.market.get_transaction_multiplier(sym, d)
                shares_at_ex = h_data['qty'] / split_factor
                
                total_gross = shares_at_ex * div_per_share
                total_net_usd = total_gross * 0.7
                total_net_twd = total_net_usd * effective_fx

                # 添加到配息歷史記錄
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
                
                # 🎯 僅「未確認」配息計入損益
                if not is_confirmed:
                    total_realized_pnl_twd += total_net_twd
                    xirr_cashflows.append({'date': d, 'amount': total_net_twd})
                    daily_net_cashflow_twd -= total_net_twd

            # 計算當日市值和 TWR
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
            last_market_value_twd = current_market_value_twd
            
            unrealized_pnl = current_market_value_twd - sum(h['cost_basis_twd'] for h in holdings.values() if h['qty'] > 1e-6)
            total_pnl = unrealized_pnl + total_realized_pnl_twd
            benchmark_twr = (curr_benchmark_val_twd / first_benchmark_val_twd - 1) * 100 if first_benchmark_val_twd else 0.0

            history_data.append({
                "date": date_str, "total_value": round(current_market_value_twd, 0),
                "invested": round(invested_capital, 0), "net_profit": round(total_pnl, 0),
                "realized_pnl": round(total_realized_pnl_twd, 0),
                "unrealized_pnl": round(unrealized_pnl, 0),
                "twr": round((cumulative_twr_factor - 1) * 100, 2), 
                "benchmark_twr": round(benchmark_twr, 2),
                "fx_rate": round(logging_fx, 4)
            })
            last_fx = fx

        final_holdings = []
        current_holdings_cost_sum = 0.0

        # 用 benchmark 決定「今日日損益」的 as-of 與 prev 交易日（避免週末/假日對齊錯誤）
        daily_pnl_asof_date = None
        daily_pnl_prev_date = None
        try:
            tw_now = datetime.now(self.pnl_helper.tz_tw)
            today = tw_now.date()
            if hasattr(self.market, 'get_price_asof') and hasattr(self.market, 'get_prev_trading_date'):
                _bp, used_bm = self.market.get_price_asof(self.benchmark_ticker, pd.Timestamp(today))
                prev_bm = self.market.get_prev_trading_date(self.benchmark_ticker, used_bm)
                daily_pnl_asof_date = pd.to_datetime(used_bm).strftime('%Y-%m-%d')
                daily_pnl_prev_date = pd.to_datetime(prev_bm).strftime('%Y-%m-%d')
        except:
            pass

        effective_date_tw = self.pnl_helper.get_effective_display_date(True)
        effective_date_us = self.pnl_helper.get_effective_display_date(False)
        
        txns_tw_day = df[df['Date'].dt.date == effective_date_tw]
        txns_us_day = df[df['Date'].dt.date == effective_date_us]
        
        active_symbols = set([k for k, v in holdings.items() if v['qty'] > 1e-4])
        active_symbols.update(txns_tw_day['Symbol'].unique())
        active_symbols.update(txns_us_day['Symbol'].unique())

        for sym in active_symbols:
            h = holdings.get(sym, {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': None})
            
            is_tw = self._is_taiwan_stock(sym)
            display_date = self.pnl_helper.get_effective_display_date(is_tw)
            
            sym_txs = df[(df['Symbol'] == sym) & (df['Date'].dt.date == display_date)]
            if not h['tag'] and not sym_txs.empty:
                tags = sym_txs['Tag'].dropna()
                if not tags.empty: h['tag'] = tags.iloc[0]

            # 取得「實際 used_date」與「上一交易日」
            curr_p = self.market.get_price(sym, pd.Timestamp(display_date))
            used_ts = pd.Timestamp(display_date)
            prev_ts = pd.Timestamp(display_date) - pd.Timedelta(days=1)

            if hasattr(self.market, 'get_price_asof'):
                curr_p, used_ts = self.market.get_price_asof(sym, pd.Timestamp(display_date))

            if hasattr(self.market, 'get_prev_trading_date'):
                prev_ts = self.market.get_prev_trading_date(sym, used_ts)
            else:
                prev_ts = used_ts - pd.Timedelta(days=1)
                while prev_ts.weekday() >= 5:
                    prev_ts -= pd.Timedelta(days=1)

            prev_p = self.market.get_price(sym, pd.Timestamp(prev_ts))

            # 匯率：用 used_ts/prev_ts 各自的歷史匯率（盤中才用 current_fx）
            if is_tw:
                effective_fx = 1.0
                prev_effective_fx = 1.0
            else:
                tw_now = datetime.now(self.pnl_helper.tz_tw)
                today = tw_now.date()

                fx_used = DEFAULT_FX_RATE
                fx_prev = DEFAULT_FX_RATE
                try:
                    if used_ts.date() == today and self._is_us_market_open(tw_now):
                        fx_used = current_fx
                    else:
                        fx_used = self.market.fx_rates.asof(used_ts)
                        if pd.isna(fx_used): fx_used = DEFAULT_FX_RATE

                    fx_prev = self.market.fx_rates.asof(pd.Timestamp(prev_ts))
                    if pd.isna(fx_prev): fx_prev = DEFAULT_FX_RATE
                except:
                    fx_used = DEFAULT_FX_RATE
                    fx_prev = DEFAULT_FX_RATE

                effective_fx = self._get_effective_fx_rate(sym, fx_used)
                prev_effective_fx = self._get_effective_fx_rate(sym, fx_prev)

            # ✅ 用 used_ts.date() 做為今日（避免 display_date 是假日但價格 pad 到前一日）
            pnl_date = used_ts.date()
            position_snap = txn_analyzer.analyze_today_position(sym, pnl_date, effective_fx, prev_p)
            realized_pnl_today = position_snap.realized_pnl_vs_prev_close

            # ✅ unrealized 以「前一交易日收盤估值」與「當日 as-of 估值」做差（含 FX）
            unrealized_pnl_today = 0.0
            if position_snap.qty > 0:
                curr_mv_twd = position_snap.qty * curr_p * effective_fx
                prev_mv_twd = position_snap.qty * prev_p * prev_effective_fx
                unrealized_pnl_today = curr_mv_twd - prev_mv_twd

            total_daily_pnl = realized_pnl_today + unrealized_pnl_today

            cost = h['cost_basis_twd']
            current_holdings_cost_sum += cost
            mkt_val = h['qty'] * curr_p * effective_fx
            daily_change_pct = round((curr_p - prev_p) / prev_p * 100, 2) if prev_p > 0 else 0.0
            currency = self.currency_detector.detect(sym)

            if h['qty'] > 1e-4 or abs(total_daily_pnl) > 1:
                 final_holdings.append(HoldingPosition(
                    symbol=sym, tag=h['tag'], currency=currency, qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0), pnl_twd=round(mkt_val - cost, 0),
                    pnl_percent=round((mkt_val - cost) / cost * 100, 2) if cost > 0 else 0,
                    current_price_origin=round(curr_p, 2), 
                    avg_cost_usd=round(h['cost_basis_usd'] / h['qty'], 2) if h['qty'] > 0 else 0,
                    prev_close_price=round(prev_p, 2), daily_change_usd=round(curr_p - prev_p, 2),
                    daily_change_percent=daily_change_pct, daily_pl_twd=round(total_daily_pnl, 0)
                ))
        
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        display_daily_pnl = sum(h.daily_pl_twd for h in final_holdings)
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
        
        summary = PortfolioSummary(
            total_value=round(current_total_value, 0),
            invested_capital=round(current_invested, 0),
            total_pnl=round(current_total_pnl, 0),
            twr=history_data[-1]['twr'] if history_data else 0,
            xirr=xirr_val,
            realized_pnl=round(total_realized_pnl_twd, 0),
            benchmark_twr=history_data[-1]['benchmark_twr'] if history_data else 0,
            daily_pnl_twd=round(display_daily_pnl, 0),
            market_stage=current_stage,
            market_stage_desc=stage_desc,
            daily_pnl_asof_date=daily_pnl_asof_date,
            daily_pnl_prev_date=daily_pnl_prev_date
        )
        
        self.validator.validate_twr_calculation(history_data)
        
        return PortfolioGroupData(
            summary=summary, holdings=final_holdings, history=history_data,
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d['status']=='pending']
        )
