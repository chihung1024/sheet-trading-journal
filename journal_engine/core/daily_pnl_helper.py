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
        # Deprecated or simplified usage, logic moved to get_effective_display_date mostly
        # But kept for compatibility if needed
        return 'TODAY', "Default Strategy"

    def get_effective_display_date(self, is_tw):
        """
        [v2.41] 取得用於顯示當日損益的「有效日期」。
        
        邏輯：
        1. 美股 (is_tw=False)：
           - T02 時段 (台股盤中/盤後, 美股未開盤)：有效日期 = 昨天 (因為還在看昨晚收盤的結果)
             例如：台灣週二早上 10:00，美股週二還沒開，這時候看到的「今日」其實是美股的「週一」。
             若昨天是買入日，那今日損益就該算 (昨收 - 成本)。
           - T03/T04 時段 (美股盤中/盤後)：有效日期 = 今天
           
        2. 台股 (is_tw=True)：
           - 基本上都是今天 (因為 00:00 就換日了，且開盤就在早上)
        """
        now_tw = datetime.now(self.tz_tw)
        today_date = now_tw.date()
        
        if is_tw:
            return today_date
        else:
            # 美股邏輯
            # 判斷是否在美股開盤前 (T02: TW 05:00 ~ 21:30)
            # 簡單判定：如果現在時間 < 21:30 (冬令) 或 20:30 (夏令)，視為盤前
            # 這裡用一個保守的判定：如果美股還沒開盤，就視為「展示昨日數據」
            
            now_us = now_tw.astimezone(self.tz_us)
            
            # 美股開盤時間 09:30
            market_open_time = time(9, 30)
            
            if now_us.time() < market_open_time:
                # 尚未開盤 -> 有效日期為昨天 (或是上一個交易日，這裡先減一天，TransactionAnalyzer 會處理週末)
                return today_date - timedelta(days=1)
            else:
                # 已開盤或盤後 -> 有效日期為今天
                return today_date

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
