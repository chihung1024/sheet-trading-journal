"""
market_stage_detector.py
[v14.0] 全時段資產價值校時中心

目的:
- 作為全系統唯一的「時間基準來源」
- 精確定義資產淨值法 (NAV) 的基準點 (T0) 與現時點 (T1)
- 確保在跨時區、跨假日情境下，損益計算的邏輯一致性
"""

from datetime import datetime, time, timedelta
import pytz
import logging
from typing import Tuple, Optional, Dict

logger = logging.getLogger(__name__)


class MarketStage:
    """市場時段枚舉"""
    # 台股時段
    TW_PRE_MARKET = 'TW_PRE_MARKET'      # 台股盤前
    TW_TRADING = 'TW_TRADING'            # 台股盤中 (09:00-13:30)
    TW_POST_MARKET = 'TW_POST_MARKET'    # 台股盤後
    
    # 美股時段
    US_PRE_MARKET = 'US_PRE_MARKET'      # 美股盤前
    US_TRADING = 'US_TRADING'            # 美股盤中 (21:30/22:30-04:00/05:00)
    US_POST_MARKET = 'US_POST_MARKET'    # 美股盤後
    
    # 全休市
    ALL_CLOSED = 'ALL_CLOSED'            # 雙市場休市 (週末/國定假日)


class MarketStageDetector:
    """專業級市場時段檢測器 (v14.0)"""
    
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
        獲取當前全域市場時段狀態
        
        Returns:
            (stage_code, description, tw_now, us_now)
        """
        tw_now = datetime.now(self.tz_tw)
        us_now = tw_now.astimezone(self.tz_us_eastern)
        
        # 1. 週末判斷 (以台灣時間為準)
        if tw_now.weekday() >= 5:
            return MarketStage.ALL_CLOSED, "週末休市", tw_now, us_now
        
        # 2. 判斷各市場即時狀態
        us_open = self._is_us_market_open(us_now)
        tw_open = self._is_tw_market_open(tw_now)
        
        # 3. 優先級判斷邏輯
        if tw_open:
            return MarketStage.TW_TRADING, "台股盤中", tw_now, us_now
        elif us_open:
            return MarketStage.US_TRADING, "美股盤中", tw_now, us_now
        else:
            # 非交易時段的細分判定
            tw_time = tw_now.time()
            if tw_time < self.TW_MARKET_OPEN:
                return MarketStage.TW_PRE_MARKET, "台股盤前", tw_now, us_now
            elif tw_time < time(21, 0):
                return MarketStage.US_PRE_MARKET, "等待美股開盤", tw_now, us_now
            else:
                return MarketStage.US_POST_MARKET, "美股盤後", tw_now, us_now

    def get_valuation_dates(self, is_taiwan_stock: bool) -> Dict[str, datetime.date]:
        """
        🚀 [v14.0 核心] 定義資產估值的「時間對(Pair)」
        回傳 T0 (基準收盤日) 與 T1 (現時觀測日)
        """
        tw_now = datetime.now(self.tz_tw)
        us_now = tw_now.astimezone(self.tz_us_eastern)
        
        if is_taiwan_stock:
            t1 = tw_now.date()
            # T0 為 T1 之前的最後一個有效交易日
            t0 = self._get_previous_trading_day(t1)
            return {"t0": t0, "t1": t1}
        else:
            # 美股邏輯：以美東日期為基準
            t1 = us_now.date()
            # 若現在美股還沒開盤且非週末，T1 價格會 fallback 到上週五
            # 但 FX1 (匯率) 仍會使用 tw_now 的即時點
            t0 = self._get_previous_trading_day(t1)
            return {"t0": t0, "t1": t1}

    def get_effective_price_date(self, symbol: str, is_taiwan_stock: bool) -> Tuple[datetime.date, str]:
        """獲取有效價格日期 (保持向下相容)"""
        dates = self.get_valuation_dates(is_taiwan_stock)
        stage, desc, _, _ = self.get_current_stage()
        
        if is_taiwan_stock:
            if stage == MarketStage.TW_TRADING:
                return dates["t1"], f"台股盤中 ({desc})"
            return dates["t0"], f"台股休市,使用基準日 ({desc})"
        else:
            if stage == MarketStage.US_TRADING:
                return dates["t1"], f"美股盤中 ({desc})"
            return dates["t0"], f"美股休市,使用基準日 ({desc})"

    def get_effective_fx_date(self) -> Tuple[datetime.date, str]:
        """獲取有效匯率日期 (用於歷史 Snapshot 的匯率對齊)"""
        tw_now = datetime.now(self.tz_tw)
        # 在資產淨值法下，即時匯率的日期永遠是「今天」
        return tw_now.date(), "資產淨值法：使用即時匯率"

    def _is_us_market_open(self, us_datetime: datetime) -> bool:
        """判斷美股是否開盤 (美東時間)"""
        if us_datetime.weekday() >= 5:
            return False
        us_time = us_datetime.time()
        return self.US_MARKET_OPEN <= us_time <= self.US_MARKET_CLOSE

    def _is_tw_market_open(self, tw_datetime: datetime) -> bool:
        """判斷台股是否開盤 (台灣時間)"""
        if tw_datetime.weekday() >= 5:
            return False
        tw_time = tw_datetime.time()
        return self.TW_MARKET_OPEN <= tw_time <= self.TW_MARKET_CLOSE

    def _get_previous_trading_day(self, date_val: datetime.date) -> datetime.date:
        """獲取前一個交易日 (排除週末)"""
        prev = date_val - timedelta(days=1)
        while prev.weekday() >= 5:
            prev -= timedelta(days=1)
        return prev

    def should_use_realtime_data(self, is_taiwan_stock: bool) -> bool:
        """判斷是否應展示即時跳動數據"""
        stage, _, _, _ = self.get_current_stage()
        if is_taiwan_stock:
            return stage == MarketStage.TW_TRADING
        # 美股在盤中、盤前均可顯示跳動 (匯率或價格)
        return stage in [MarketStage.US_TRADING, MarketStage.US_PRE_MARKET]

    def log_current_status(self):
        """記錄當前市場狀態"""
        stage, desc, tw_now, us_now = self.get_current_stage()
        logger.info(f"[MarketStage] {desc} | TW: {tw_now.strftime('%H:%M')} | US: {us_now.strftime('%H:%M')}")


# 全域實例 (Singleton)
_detector_instance = None

def get_market_detector() -> MarketStageDetector:
    """獲取全域市場檢測器實例"""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = MarketStageDetector()
    return _detector_instance
