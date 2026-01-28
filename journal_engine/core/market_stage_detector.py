"""market_stage_detector.py

[v2.52] 專業級市場時段檢測器

目的:
- 精確判斷美股/台股的交易時段
- 解決匯率與價格時間點錯位問題
- 支援夏令時/冬令時自動切換

核心原則:
價格與匯率必須反映「同一個市場時刻」的狀態
"""

from datetime import datetime, time, timedelta
import pytz
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


class MarketStage:
    """市場時段枚舉"""
    # 台股時段
    TW_PRE_MARKET = 'TW_PRE_MARKET'      # 台股盤前 (00:00-09:00)
    TW_TRADING = 'TW_TRADING'            # 台股盤中 (09:00-13:30)
    TW_POST_MARKET = 'TW_POST_MARKET'    # 台股盤後 (13:30-24:00)
    
    # 美股時段
    US_PRE_MARKET = 'US_PRE_MARKET'      # 美股盤前 (台灣時間 16:00-21:30/22:30)
    US_TRADING = 'US_TRADING'            # 美股盤中 (台灣時間 21:30/22:30-04:00/05:00)
    US_POST_MARKET = 'US_POST_MARKET'    # 美股盤後 (台灣時間 04:00/05:00-16:00)
    
    # 全休市
    ALL_CLOSED = 'ALL_CLOSED'            # 雙市場休市 (週末/假日)


class MarketStageDetector:
    """專業級市場時段檢測器"""
    
    def __init__(self):
        self.tz_tw = pytz.timezone('Asia/Taipei')
        self.tz_us_eastern = pytz.timezone('US/Eastern')
        
        # 美股交易時間 (美東時間)
        self.US_MARKET_OPEN = time(9, 30)   # 09:30 ET
        self.US_MARKET_CLOSE = time(16, 0)  # 16:00 ET
        
        # 台股交易時間 (台灣時間)
        self.TW_MARKET_OPEN = time(9, 0)    # 09:00 TW
        self.TW_MARKET_CLOSE = time(13, 30) # 13:30 TW
    
    def get_current_stage(self) -> Tuple[str, str, datetime, datetime]:
        """
        獲取當前市場時段
        
        Returns:
            (stage_code, description, tw_now, us_now)
            - stage_code: 時段代碼 (MarketStage.XXX)
            - description: 中文描述
            - tw_now: 台灣時間
            - us_now: 美東時間
        """
        tw_now = datetime.now(self.tz_tw)
        us_now = tw_now.astimezone(self.tz_us_eastern)
        
        # 週末判斷 (台灣時間)
        if tw_now.weekday() >= 5:
            return MarketStage.ALL_CLOSED, "週末休市", tw_now, us_now
        
        # 判斷美股狀態
        us_open = self._is_us_market_open(us_now)
        
        # 判斷台股狀態
        tw_open = self._is_tw_market_open(tw_now)
        
        # 組合判斷
        if tw_open:
            return MarketStage.TW_TRADING, "台股盤中", tw_now, us_now
        elif us_open:
            return MarketStage.US_TRADING, "美股盤中", tw_now, us_now
        else:
            # 都休市,進一步判斷是盤前還是盤後
            tw_time = tw_now.time()
            
            if tw_time < self.TW_MARKET_OPEN:
                return MarketStage.TW_PRE_MARKET, "台股盤前", tw_now, us_now
            elif tw_time < time(21, 0):  # 21:00 前視為盤後等待美股
                return MarketStage.US_PRE_MARKET, "等待美股開盤", tw_now, us_now
            else:
                return MarketStage.US_POST_MARKET, "美股盤後", tw_now, us_now
    
    def _is_us_market_open(self, us_datetime: datetime) -> bool:
        """判斷美股是否開盤 (美東時間)"""
        # 週末不開盤
        if us_datetime.weekday() >= 5:
            return False
        
        us_time = us_datetime.time()
        return self.US_MARKET_OPEN <= us_time <= self.US_MARKET_CLOSE
    
    def _is_tw_market_open(self, tw_datetime: datetime) -> bool:
        """判斷台股是否開盤 (台灣時間)"""
        # 週末不開盤
        if tw_datetime.weekday() >= 5:
            return False
        
        tw_time = tw_datetime.time()
        return self.TW_MARKET_OPEN <= tw_time <= self.TW_MARKET_CLOSE
    
    def get_effective_price_date(self, symbol: str, is_taiwan_stock: bool) -> Tuple[datetime.date, str]:
        """
        [v2.52 核心方法] 獲取有效價格日期
        
        根據市場時段,決定應該使用哪一天的價格數據
        
        邏輯:
        - 台股: 開盤前用昨天收盤,開盤後用今天盤中價
        - 美股: 開盤前用昨天收盤,開盤後用今天盤中價
        
        Args:
            symbol: 股票代碼
            is_taiwan_stock: 是否為台股
        
        Returns:
            (effective_date, reason): 有效日期與原因說明
        """
        stage, desc, tw_now, us_now = self.get_current_stage()
        
        if is_taiwan_stock:
            # 台股邏輯
            if stage == MarketStage.TW_TRADING:
                # 台股盤中: 使用今天
                return tw_now.date(), f"台股盤中,使用今日價格 ({desc})"
            else:
                # 台股盤前/盤後: 使用昨天收盤
                prev_date = self._get_previous_trading_day(tw_now.date())
                return prev_date, f"台股未開盤,使用前一交易日 ({desc})"
        else:
            # 美股邏輯
            if stage == MarketStage.US_TRADING:
                # 美股盤中: 使用美股今天
                return us_now.date(), f"美股盤中,使用今日價格 ({desc})"
            else:
                # 美股盤前/盤後: 使用美股昨天收盤
                prev_date = self._get_previous_trading_day(us_now.date())
                return prev_date, f"美股未開盤,使用前一交易日 ({desc})"
    
    def get_effective_fx_date(self) -> Tuple[datetime.date, str]:
        """
        [v2.52 核心方法] 獲取有效匯率日期
        
        關鍵原則:
        匯率日期必須與價格日期保持一致,才能正確反映市值變化
        
        邏輯:
        - 如果美股開盤: 使用即時匯率 (今天)
        - 如果美股未開: 使用昨天收盤匯率
        
        Returns:
            (effective_date, reason): 有效日期與原因說明
        """
        stage, desc, tw_now, us_now = self.get_current_stage()
        
        if stage == MarketStage.US_TRADING:
            # 美股盤中: 使用即時匯率
            return tw_now.date(), f"美股盤中,使用即時匯率 ({desc})"
        else:
            # 美股未開: 使用昨天收盤匯率
            prev_date = self._get_previous_trading_day(tw_now.date())
            return prev_date, f"美股未開盤,使用前一交易日匯率 ({desc})"
    
    def _get_previous_trading_day(self, date: datetime.date) -> datetime.date:
        """獲取前一個交易日 (排除週末)"""
        prev = date - timedelta(days=1)
        while prev.weekday() >= 5:  # 5=週六, 6=週日
            prev -= timedelta(days=1)
        return prev
    
    def should_use_realtime_data(self, is_taiwan_stock: bool) -> bool:
        """
        判斷是否應該使用即時數據
        
        Args:
            is_taiwan_stock: 是否為台股
        
        Returns:
            True: 使用即時數據; False: 使用昨天收盤數據
        """
        stage, _, _, _ = self.get_current_stage()
        
        if is_taiwan_stock:
            return stage == MarketStage.TW_TRADING
        else:
            return stage == MarketStage.US_TRADING
    
    def log_current_status(self):
        """記錄當前市場狀態 (用於調試)"""
        stage, desc, tw_now, us_now = self.get_current_stage()
        
        logger.info("=" * 60)
        logger.info(f"[MarketStageDetector] 當前市場狀態")
        logger.info(f"時段代碼: {stage}")
        logger.info(f"時段描述: {desc}")
        logger.info(f"台灣時間: {tw_now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        logger.info(f"美東時間: {us_now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        logger.info(f"台股開盤: {self._is_tw_market_open(tw_now)}")
        logger.info(f"美股開盤: {self._is_us_market_open(us_now)}")
        logger.info("=" * 60)


# 全域實例 (單例模式)
_detector_instance = None

def get_market_detector() -> MarketStageDetector:
    """獲取全域市場檢測器實例"""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = MarketStageDetector()
    return _detector_instance
