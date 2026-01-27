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
        [Deprecated] 舊版價格策略判定，保留介面相容性。
        實際邏輯已由 get_effective_display_date 取代。
        """
        return 'TODAY', "Default Strategy"

    def get_effective_display_date(self, is_tw):
        """
        [v2.41 Update] 根據使用者定義的 5 個時段邏輯，決定「當日損益」的計算基準日期。
        
        邏輯依據 (以台灣時間 TW 為準):
        1. 00:00~05:00 (美股盤中, 台股盤前): 
           - 美: 顯示當下交易日 (即昨天 TW) -> US Now
           - 台: 顯示昨日收盤 -> TW Yesterday
        2. 05:00~09:00 (美股盤後, 台股盤前):
           - 美: 顯示剛收盤的交易日 -> US Today (which is yesterday TW)
           - 台: 顯示昨日收盤 -> TW Yesterday
        3. 09:00~13:30 (美股盤後, 台股盤中):
           - 美: 顯示剛收盤的交易日 -> US Today
           - 台: 顯示當下交易日 -> TW Today
        4. 13:30~21:30 (美股盤前, 台股盤後):
           - 美: 顯示剛收盤的交易日 -> US Today (still yesterday TW's night session)
           - 台: 顯示剛收盤的交易日 -> TW Today
        5. 21:30~23:59 (美股盤中, 台股盤後):
           - 美: 顯示當下交易日 -> US Today
           - 台: 顯示剛收盤的交易日 -> TW Today
           
        實作簡化:
        - TW: 09:00 前算昨日，09:00 後算今日。
        - US: 09:30 ET (開盤) 前算昨日，09:30 ET 後算今日。
          (自動處理冬令 22:30 / 夏令 21:30 的開盤差異，確保邏輯一致)
        """
        now_tw = datetime.now(self.tz_tw)
        
        if is_tw:
            # 台股邏輯: 09:00 開盤前看昨天，開盤後看今天
            if now_tw.time() < time(9, 0):
                return now_tw.date() - timedelta(days=1)
            else:
                return now_tw.date()
        else:
            # 美股邏輯: 依據美東時間判斷
            now_us = now_tw.astimezone(self.tz_us)
            
            # 美股開盤判定 (09:30 ET)
            # 若現在時間小於 09:30 (盤前)，視為「還在看上一個交易日的收盤結果」-> Return US Date - 1
            # 若現在時間大於 09:30 (盤中/盤後)，視為「正在看當下交易日的結果」-> Return US Date
            
            # 案例: TW 10:00 (Tue) -> US 21:00 (Mon) -> Time > 09:30 -> Returns Mon (Correct)
            # 案例: TW 23:00 (Tue) -> US 10:00 (Tue) -> Time > 09:30 -> Returns Tue (Correct)
            # 案例: TW 08:00 (Tue) -> US 19:00 (Mon) -> Time > 09:30 -> Returns Mon (Correct)
            # 案例: TW 14:00 (Tue) -> US 01:00 (Tue) -> Time < 09:30 -> Returns Tue - 1 = Mon (Correct)
            
            if now_us.time() < time(9, 30):
                return now_us.date() - timedelta(days=1)
            else:
                return now_us.date()

    def is_market_open(self, market='US'):
        """判斷市場是否開盤 (含週末判斷)"""
        now_tw = datetime.now(self.tz_tw)
        if now_tw.weekday() >= 5: return False # 週末休市
        
        if market == 'US':
            now_us = now_tw.astimezone(self.tz_us)
            market_time = now_us.time()
            return time(9, 30) <= market_time <= time(16, 0)
        elif market == 'TW':
            return time(9, 0) <= now_tw.time() <= time(13, 30)
        return False
