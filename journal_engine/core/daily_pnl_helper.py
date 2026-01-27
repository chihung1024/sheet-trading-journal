from datetime import datetime, time, timedelta
import pytz
import pandas as pd
import logging

# 設定 logger
logger = logging.getLogger(__name__)

class DailyPnLHelper:
    """
    時區與損益計算輔助類別 (v2.40 Core)
    負責處理跨時區市場狀態判斷、價格策略選擇及歷史數據查找。
    解決：凌晨台股損益歸零、夏令時間判定錯誤等問題。
    """
    
    def __init__(self):
        # 定義時區
        self.tz_tw = pytz.timezone('Asia/Taipei')
        self.tz_us = pytz.timezone('US/Eastern')
        
        # 定義 5 個時段狀態常數 (基於台灣時間)
        self.STAGE_US_LIVE_TW_PRE = "STAGE_1"   # 00:00-05:00: 美股盤中 / 台股盤前
        self.STAGE_US_CLOSE_TW_PRE = "STAGE_2"  # 05:00-09:00: 美股盤後 / 台股盤前
        self.STAGE_US_CLOSE_TW_LIVE = "STAGE_3" # 09:00-13:30: 美股盤後 / 台股盤中
        self.STAGE_US_PRE_TW_CLOSE = "STAGE_4"  # 13:30-21:30: 美股盤前 / 台股盤後
        self.STAGE_US_LIVE_TW_CLOSE = "STAGE_5" # 21:30-23:59: 美股盤中 / 台股盤後

    def get_market_stage(self) -> tuple[str, str]:
        """
        根據台灣時間動態判斷當前市場階段
        會自動處理美股日光節約時間 (DST) 的開盤差異
        
        :return: (stage_code, description)
        """
        now_tw = datetime.now(self.tz_tw)
        t = now_tw.time()
        
        # 動態判斷美股開盤時間 (處理 DST)
        # 轉換為美東時間以檢查 DST 狀態
        now_us = now_tw.astimezone(self.tz_us)
        is_dst = now_us.dst() != timedelta(0)
        
        # 夏令: 21:30 開盤, 冬令: 22:30 開盤
        # 這裡我們主要關注"美股盤中"的起始點
        us_open_hour = 21 if is_dst else 22
        us_open_minute = 30
        
        # 階段判斷邏輯 (依照台灣時間劃分)
        if time(0, 0) <= t < time(5, 0):
            # 凌晨時段
            return self.STAGE_US_LIVE_TW_PRE, "美股盤中 / 台股盤前"
            
        elif time(5, 0) <= t < time(9, 0):
            # 清晨時段 (美股收盤後)
            return self.STAGE_US_CLOSE_TW_PRE, "美股盤後 / 台股盤前"
            
        elif time(9, 0) <= t < time(13, 30):
            # 台股盤中時段
            return self.STAGE_US_CLOSE_TW_LIVE, "美股盤後 / 台股盤中"
            
        elif time(13, 30) <= t < time(us_open_hour, us_open_minute):
            # 下午至晚上美股開盤前
            return self.STAGE_US_PRE_TW_CLOSE, "美股盤前 / 台股盤後"
            
        else:
            # 美股開盤後 (21:30/22:30 - 23:59)
            return self.STAGE_US_LIVE_TW_CLOSE, "美股盤中 / 台股盤後"

    def get_price_strategy(self, stage: str, is_tw_stock: bool) -> tuple[str, str]:
        """
        決定該股票在當前階段應該使用哪種價格計算損益
        
        :param stage: 當前市場階段代碼
        :param is_tw_stock: 是否為台股
        :return: (target_mode, description)
                 target_mode: 'TODAY' (計算今日損益) 或 'YESTERDAY' (鎖定昨日損益)
        """
        if is_tw_stock:
            # === 台股策略 ===
            # 在凌晨與清晨 (Stage 1 & 2)，台股尚未開盤，今日損益應鎖定為"昨日戰果"
            # 否則若程式抓到"今日"數據(可能是空的或昨收)，會導致損益歸零或錯誤
            if stage in [self.STAGE_US_LIVE_TW_PRE, self.STAGE_US_CLOSE_TW_PRE]:
                return 'YESTERDAY', "使用昨日收盤損益"
            else:
                # 09:00 以後，視為今日交易日
                return 'TODAY', "使用今日即時/收盤數據"
        else:
            # === 美股策略 ===
            # 美股數據源通常在盤後也能取得當日收盤價，因此全天候使用 'TODAY'
            # 除非在特定極端狀況下才需要鎖定
            return 'TODAY', "使用最新數據"

    def is_market_open(self, market: str = 'US') -> bool:
        """
        判斷指定市場目前是否開盤 (包含週末與時段判斷)
        用於前端決定是否啟用即時輪詢
        
        :param market: 'US' 或 'TW'
        :return: Boolean
        """
        now_tw = datetime.now(self.tz_tw)
        
        # 1. 週末判斷 (週六=5, 週日=6)
        # 注意：美股週五收盤時，台灣已經是週六凌晨，所以台灣週六凌晨 00:00-05:00 仍算交易日
        weekday = now_tw.weekday()
        
        if market == 'TW':
            # 台股週末絕對休市
            if weekday >= 5:
                return False
            # 台股時段: 09:00 - 13:30
            return time(9, 0) <= now_tw.time() <= time(13, 30)
            
        elif market == 'US':
            # 美股週末判斷
            # 台灣週六 05:00 以後 (美股週五收盤) 到 週一 21:30 以前是休市
            
            # 簡單判定：轉換為美東時間
            now_us = now_tw.astimezone(self.tz_us)
            us_weekday = now_us.weekday()
            
            if us_weekday >= 5:
                return False
                
            # 美股交易時段 (ET): 09:30 - 16:00
            market_time = now_us.time()
            return time(9, 30) <= market_time <= time(16, 0)
            
        return False

    def get_historical_pnl(self, stock_data: pd.DataFrame, target_date: date, qty: float, fx: float = 1.0) -> tuple[float, float, float]:
        """
        基於日期的精確查找：計算特定歷史日期的損益
        解決 yfinance 在凌晨時段數據更新延遲或索引不一致的問題
        
        :param stock_data: 包含股價歷史的 DataFrame (需有 DatetimeIndex)
        :param target_date: 目標日期 (datetime.date)
        :param qty: 持倉數量
        :param fx: 匯率
        :return: (pnl, close_price, prev_close_price)
        """
        try:
            if stock_data.empty:
                return 0.0, 0.0, 0.0
                
            # 確保 Index 是 DatetimeIndex
            if not isinstance(stock_data.index, pd.DatetimeIndex):
                stock_data.index = pd.to_datetime(stock_data.index)
            
            # 轉換目標日期為 Timestamp
            target_ts = pd.Timestamp(target_date)
            
            # 篩選出不大於目標日期的所有數據 (由新到舊排序)
            # 這樣可以找到目標日(或目標日之前最近交易日)的收盤價
            valid_data = stock_data[stock_data.index.date <= target_ts.date()]
            
            if len(valid_data) < 2:
                # 數據不足以計算價差
                if len(valid_data) == 1:
                    # 只有一天數據，無法計算 Yesterday PnL (Prev Close 不存在)
                    curr_p = float(valid_data.iloc[-1]['Close_Adjusted'])
                    return 0.0, curr_p, curr_p
                return 0.0, 0.0, 0.0
                
            # 取最後兩筆：[-1] 是目標日收盤，[-2] 是前一日收盤
            curr_row = valid_data.iloc[-1]
            prev_row = valid_data.iloc[-2]
            
            curr_p = float(curr_row['Close_Adjusted'])
            prev_p = float(prev_row['Close_Adjusted'])
            
            # 計算損益
            pnl = (curr_p - prev_p) * qty * fx
            
            return pnl, curr_p, prev_p
            
        except Exception as e:
            logger.error(f"Error calculating historical PnL for target {target_date}: {e}")
            return 0.0, 0.0, 0.0
