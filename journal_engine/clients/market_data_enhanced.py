# journal_engine/clients/market_data_enhanced.py
# 增強的市場數據获取模組 - 支持自動發現並並發取數據

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MarketDataEnhanced:
    """增強的市場數據获取模組 - 結合portfolio-journal的數據提取能力"""
    
    def __init__(self, max_retries=3, retry_delay=5):
        """
        初始化增強數據获取器
        
        Args:
            max_retries (int): 最大重試次数
            retry_delay (int): 重試延遅 (秒)
        """
        self.max_retries = max_retries
        self.retry_delay = retry_delay

    def auto_discover_targets(self, api_client):
        """
        从 API 自動發現需要更新的標的
        """
        try:
            logger.info("自動發現標的...")
            # 從 API 取得記錄中的所有符號
            records = api_client.fetch_records()
            if not records:
                return []
            
            df = pd.DataFrame(records)
            symbols = df['symbol'].unique().tolist()
            logger.info(f"發現 {len(symbols)} 個標的")
            return symbols
        except Exception as e:
            logger.error(f"自動發現失敗: {str(e)}")
            return []

    def fetch_market_data(self, symbols, period='5y', progress_callback=None):
        """
        批量下載市場數據
        
        Args:
            symbols (list): 標的簦號列表
            period (str): 日期十計時間 ('1d', '1mo', '5y' 等)
            progress_callback (callable): 進度回調
            
        Returns:
            dict: {symbol: {'prices': {date: price, ...}, ...}, ...}
        """
        market_data = {}
        
        for idx, symbol in enumerate(symbols):
            try:
                logger.info(f"下載 {symbol} 的數據...")
                
                # 使用 yfinance 下載數據
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period=period)
                
                if hist.empty:
                    logger.warning(f"{symbol} 的數據為空")
                    continue
                
                # 轉換為我組需要的格式
                prices = {}
                for date, row in hist.iterrows():
                    date_str = date.strftime('%Y-%m-%d')
                    prices[date_str] = float(row['Close'])
                
                market_data[symbol] = {'prices': prices}
                
                # 進度回調
                if progress_callback:
                    progress_callback(idx + 1, len(symbols))
                    
            except Exception as e:
                logger.warning(f"{symbol} 下載失敗: {str(e)}")
                continue
        
        logger.info(f"批量下載完成，獲取 {len(market_data)} 個標的")
        return market_data
