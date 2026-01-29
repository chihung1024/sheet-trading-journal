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
        self.duplicate_div_ids = set()
        self.conflict_div_info = {}

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
        is_tw = self._is_taiwan_stock(symbol)
        
        if is_tw:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            return price, 1.0
        
        tw_now = datetime.now(self.pnl_helper.tz_tw)
        today = tw_now.date()
        
        if target_date < today:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            try:
                fx_to_use = self.market.fx_rates.asof(pd.Timestamp(target_date))
                if pd.isna(fx_to_use): fx_to_use = DEFAULT_FX_RATE
            except:
                fx_to_use = DEFAULT_FX_RATE
            return price, self._get_effective_fx_rate(symbol, fx_to_use)
        
        us_open = self._is_us_market_open(tw_now)
        
        if not us_open:
            prev_date = today - timedelta(days=1)
            while prev_date.weekday() >= 5:
                prev_date -= timedelta(days=1)
            price = self.market.get_price(symbol, pd.Timestamp(prev_date))
            fx_to_use = current_fx
            return price, self._get_effective_fx_rate(symbol, fx_to_use)
        else:
            price = self.market.get_price(symbol, pd.Timestamp(today))
            fx_to_use = current_fx
            return price, self._get_effective_fx_rate(symbol, fx_to_use)

    def _detect_and_remove_duplicate_dividends(self):
        logger.info("檢測重複配息...")
        
        if self.df.empty or 'id' not in self.df.columns:
            return set(), {}
        
        div_txs = self.df[self.df['Type'] == 'DIV'].copy()
        if div_txs.empty: return set(), {}
        
        div_txs['div_key'] = div_txs['Symbol'] + '_' + div_txs['Date'].dt.strftime('%Y-%m-%d')
        grouped = div_txs.groupby('div_key')
        
        ids_to_remove_from_memory = []
        ids_to_delete_from_db = set()
        conflict_info = {}
        
        for div_key, group in grouped:
            if len(group) <= 1: continue
            
            logger.warning(f"{div_key} 有 {len(group)} 筆配息")
            
            first_row = group.iloc[0]
            all_same = all(
                abs(row['Qty'] - first_row['Qty']) < 1e-4 and 
                abs(row['Price'] - first_row['Price']) < 1e-4
                for _, row in group.iterrows()
            )
            
            if all_same:
                for idx, row in group.iloc[1:].iterrows():
                    ids_to_remove_from_memory.append(idx)
                    ids_to_delete_from_db.add(row['id'])
                logger.info(f"  保留 {group.iloc[0]['id']}, 移除 {len(group)-1} 筆重複")
            else:
                conflict_ids = group['id'].tolist()
                conflict_info[div_key] = conflict_ids
                logger.error(f"  {div_key} 數據不一致，標記為衝突")
                for idx, _ in group.iterrows():
                    ids_to_remove_from_memory.append(idx)
        
        if ids_to_remove_from_memory:
            self.df = self.df.drop(ids_to_remove_from_memory)
            logger.info(f"已從記憶體移除 {len(ids_to_remove_from_memory)} 筆")
        
        self.duplicate_div_ids = ids_to_delete_from_db.copy()
        return ids_to_delete_from_db, conflict_info

    def _delete_records_from_database(self, ids_to_delete, record_type="重複"):
        if not ids_to_delete or not self.api_client: return
        
        logger.info(f"從資料庫刪除 {len(ids_to_delete)} 筆{record_type}記錄...")
        result = self.api_client.delete_records(list(ids_to_delete))
        
        if result['success'] > 0:
            logger.info(f"成功刪除 {result['success']} 筆")
        if result['failed'] > 0:
            logger.error(f"刪除失敗 {result['failed']} 筆")

    def run(self):
        logger.info(f"=== 開始多群組計算 (baseline: {self.benchmark_ticker}) ===")
        
        ids_to_delete, self.conflict_div_info = self._detect_and_remove_duplicate_dividends()
        self._delete_records_from_database(ids_to_delete, "重複")
        
        if self.conflict_div_info:
            all_conflict_ids = [id for ids in self.conflict_div_info.values() for id in ids]
            self._delete_records_from_database(all_conflict_ids, "衝突")
        
        current_fx = DEFAULT_FX_RATE
        if hasattr(self.market, 'realtime_fx_rate') and self.market.realtime_fx_rate:
            current_fx = self.market.realtime_fx_rate
        elif not self.market.fx_rates.empty:
            current_fx = float(self.market.fx_rates.iloc[-1])

        if self.df.empty:
            logger.warning("無交易記錄")
            empty_summary = PortfolioSummary(
                total_value=0, invested_capital=0, total_pnl=0, 
                twr=0, xirr=0, realized_pnl=0, benchmark_twr=0, daily_pnl_twd=0
            )
            return PortfolioSnapshot(
                updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
                base_currency=BASE_CURRENCY, exchange_rate=round(current_fx, 2),
                summary=empty_summary, holdings=[], history=[], pending_dividends=[],
                groups={"all": PortfolioGroupData(summary=empty_summary, holdings=[], history=[], pending_dividends=[])}
            )
            
        self._back_adjust_transactions_global()
        
        current_stage, stage_desc = self.pnl_helper.get_market_stage()
        logger.info(f"市場狀態: {current_stage}")

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

            group_result = self._calculate_single_portfolio(group_df, group_date_range, current_fx, group_name, current_stage)
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
        for index, row in self.df.iterrows():
            if row['Type'] not in ['BUY', 'SELL']: continue
            
            sym, date = row['Symbol'], row['Date']
            is_tw = self._is_taiwan_stock(sym)
            split_factor = self.market.get_transaction_multiplier(sym, date)
            div_adj_factor = 1.0 if is_tw else self.market.get_dividend_adjustment_factor(sym, date)
            
            if split_factor != 1.0 or div_adj_factor != 1.0:
                self.df.at[index, 'Qty'] = row['Qty'] * split_factor
                self.df.at[index, 'Price'] = (row['Price'] / split_factor) * div_adj_factor

    def _get_previous_trading_day(self, date):
        prev_date = date - timedelta(days=1)
        while prev_date.weekday() >= 5:
            prev_date -= timedelta(days=1)
        return prev_date

    def _calculate_single_portfolio(self, df, date_range, current_fx, group_name="unknown", current_stage="CLOSED"):
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

        # 🔧 修復：收集所有 DIV 記錄並標記為已確認
        div_txs = df[df['Type'] == 'DIV'].copy()
        for _, row in div_txs.iterrows():
            if 'id' in row and row['id'] not in self.duplicate_div_ids:
                key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
                confirmed_dividends.add(key)
                logger.info(f"✅ 配息已確認: {key} (金額: {row['Qty'] * row['Price']:.2f})")

        if not df.empty:
            first_tx_date = df['Date'].min()
            prev_trading_day = self._get_previous_trading_day(first_tx_date)
            
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
                    # 🔧 修復：跳過重複配息
                    if 'id' in row and row['id'] in self.duplicate_div_ids:
                        logger.warning(f"⚠️ 跳過重複配息: {sym}_{current_date}")
                        continue
                    
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    # ✅ 正確計算：數量 × 單價
                    div_twd = (row['Qty'] * row['Price']) * effective_fx
                    total_realized_pnl_twd += div_twd
                    xirr_cashflows.append({'date': d, 'amount': div_twd})
                    daily_net_cashflow_twd -= div_twd
                    logger.info(f"✅ 處理用戶配息: {sym}_{current_date}, 金額: TWD {div_twd:.0f}")

            # 🔧 修復：市場配息檢測 - 只處理「未在 records 中確認」的配息
            date_str = d.strftime('%Y-%m-%d')
            for sym, h_data in holdings.items():
                div_per_share = self.market.get_dividend(sym, d)
                if div_per_share > 0 and h_data['qty'] > 1e-6:
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    div_key = f"{sym}_{date_str}"
                    
                    # 🔧 關鍵修復：如果配息已在 records 中確認，不要再計算市場數據
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
                    
                    # 🔧 關鍵修復：只有「未確認」的配息才計入損益和現金流
                    if not is_confirmed:
                        total_realized_pnl_twd += total_net_twd
                        xirr_cashflows.append({'date': d, 'amount': total_net_twd})
                        daily_net_cashflow_twd -= total_net_twd
                        logger.info(f"📊 處理市場配息（未確認）: {div_key}, 金額: TWD {total_net_twd:.0f}")
                    else:
                        logger.info(f"⏭️ 跳過市場配息（已在 records 中）: {div_key}")

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
            effective_display_date = self.pnl_helper.get_effective_display_date(is_tw)
            
            sym_txs = df[(df['Symbol'] == sym) & (df['Date'].dt.date == effective_display_date)]
            if not h['tag'] and not sym_txs.empty:
                tags = sym_txs['Tag'].dropna()
                if not tags.empty: h['tag'] = tags.iloc[0]

            effective_fx = self._get_effective_fx_rate(sym, current_fx)
            curr_p = self.market.get_price(sym, pd.Timestamp(effective_display_date))
            
            prev_date = effective_display_date - timedelta(days=1)
            while prev_date.weekday() >= 5:
                prev_date -= timedelta(days=1)
            prev_p = self.market.get_price(sym, pd.Timestamp(prev_date))
            
            position_snap = txn_analyzer.analyze_today_position(sym, effective_display_date, effective_fx)
            realized_pnl_today = position_snap.realized_pnl
            
            base_prev_close = prev_p 
            unrealized_pnl_today = 0.0
            if position_snap.qty > 0:
                weighted_base = txn_analyzer.get_base_price_for_pnl(position_snap, base_prev_close)
                unrealized_pnl_today = (curr_p - weighted_base) * position_snap.qty * effective_fx
            
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
            daily_pnl_twd=round(display_daily_pnl, 0)
        )
        
        self.validator.validate_twr_calculation(history_data)
        
        logger.info(f"✅ 計算完成 - TWR: {summary.twr:.2f}%, 已實現損益: TWD {summary.realized_pnl:,.0f}")
        
        return PortfolioGroupData(
            summary=summary, holdings=final_holdings, history=history_data,
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d['status']=='pending']
        )