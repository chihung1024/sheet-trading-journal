from datetime import datetime, time, timedelta
import pytz
import pandas as pd
import logging

logger = logging.getLogger(__name__)

class DailyPnLHelper:
    def __init__(self):
        self.tz_tw = pytz.timezone('Asia/Taipei')
        self.tz_us = pytz.timezone('US/Eastern')
        self.STAGE_PRE_MARKET = 'PRE_MARKET'
        self.STAGE_MARKET_OPEN = 'MARKET_OPEN'
        self.STAGE_POST_MARKET = 'POST_MARKET'
        self.STAGE_CLOSED = 'CLOSED'

    def get_market_stage(self):
        """
        Get the current market stage description.
        Returns: (stage_code, description)
        """
        if self.is_market_open('TW'):
            return self.STAGE_MARKET_OPEN, "TW Market Open"
        elif self.is_market_open('US'):
            return self.STAGE_MARKET_OPEN, "US Market Open"
        else:
            return self.STAGE_CLOSED, "Markets Closed"

    def get_price_strategy(self, current_stage, is_tw):
        """
        Determine price strategy based on stage and market type.
        Returns: (mode, description)
        mode: 'YESTERDAY' or 'TODAY'
        """
        now_tw = datetime.now(self.tz_tw)
        
        if is_tw:
            # T01: 凌晨台股 (02:00) -> YESTERDAY
            # 假設台股開盤前都算昨日收盤狀態
            if 0 <= now_tw.hour < 9:
                return 'YESTERDAY', "Before TW Open"
            else:
                return 'TODAY', "After/During TW Open"
        else:
            # 美股
            return 'TODAY', "Default US Strategy"

    def is_market_open(self, market='US'):
        """[Issue 6] 判斷市場是否開盤 (含週末判斷)"""
        now_tw = datetime.now(self.tz_tw)
        if now_tw.weekday() >= 5: return False # 週末休市
        
        if market == 'US':
            # [Issue 6] DST 動態開盤時間判定
            now_us = now_tw.astimezone(self.tz_us)
            
            # 簡單判斷交易時段 (9:30 - 16:00 ET)
            market_time = now_us.time()
            return time(9, 30) <= market_time <= time(16, 0)
        elif market == 'TW':
            return time(9, 0) <= now_tw.time() <= time(13, 30)
        return False

    def get_historical_pnl(self, stock_data, target_date, qty, fx=1.0):
        """[Issue 2] 基於日期的精確查找 (解決 yfinance 更新延遲問題)"""
        try:
            if not isinstance(stock_data.index, pd.DatetimeIndex):
                stock_data.index = pd.to_datetime(stock_data.index)
            
            # 尋找目標日期或最近的一個交易日 (由後往前找)
            target_ts = pd.Timestamp(target_date)
            # 篩選出不大於目標日期的數據
            valid_data = stock_data[stock_data.index.date <= target_ts.date()]
            
            if len(valid_data) < 2:
                return 0.0, 0.0, 0.0
                
            curr_row = valid_data.iloc[-1] # 目標日的收盤 (或最近交易日)
            prev_row = valid_data.iloc[-2] # 前一日收盤
            
            curr_p = float(curr_row['Close_Adjusted'])
            prev_p = float(prev_row['Close_Adjusted'])
            
            pnl = (curr_p - prev_p) * qty * fx
            return pnl, curr_p, prev_p
        except Exception as e:
            logger.error(f"Historical PnL Error: {e}")
            return 0.0, 0.0, 0.0
