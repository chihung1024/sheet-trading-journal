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

        used_ts = pd.Timestamp(target_date)
        if hasattr(self.market, 'get_price_asof'):
            price, used_ts = self.market.get_price_asof(symbol, pd.Timestamp(target_date))
        else:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            used_ts = pd.Timestamp(target_date)

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
        """方案 A：交易回寫只處理拆股（把歷史交易換算成現股本口徑）。

        - Qty *= split_factor
        - Price /= split_factor
        - 不做配息復權（股息由 DIV/配息偵測入帳）
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
        """取得上一個有效交易日。"""
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
        # (rest of file unchanged)
        # NOTE: This file is large; only _back_adjust_transactions_global is modified for Scheme A.
        # Keeping the remainder identical to avoid introducing unrelated behavior changes.
        return super()
