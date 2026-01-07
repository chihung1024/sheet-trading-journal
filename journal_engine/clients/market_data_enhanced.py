# journal_engine/clients/market_data_enhanced.py
# 增強的市場數據客戶端 - 支持自動發現與批量下載

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import logging

# 設置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MarketDataEnhanced:
    """增強的市場數據客戶端 - 整合portfolio-journal的最佳實踐"""
    
    def __init__(self, max_retries=3, retry_delay=5):
        """
        初始化增強市場數據客戶端
        
        Args:
            max_retries (int): 最多重試次數
            retry_delay (int): 重試延遲（秒）
        """
        self.prices = {}  # {symbol: Series}
        self.dividends = {}  # {symbol: Series}
        self.splits = {}  # {symbol: Series}
        self.fx_rates = {}  # {symbol: Series}
        
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        
        # 貨幣到匯率對的映射
        self.currency_mapping = {
            'USD': 'TWD=X',
            'HKD': 'HKDTWD=X',
            'JPY': 'JPYTWD=X',
            'CNY': 'CNYUSD=X',
            'GBP': 'GBPUSD=X',
            'EUR': 'EURUSD=X'
        }
        
        self.last_update = {}  # {symbol: datetime}
    
    def auto_discover_targets(self, api_client):
        """
        自動發現所有需要更新的標的
        
        參數:
            api_client: CloudflareClient 實例
        
        返回:
            list: 需要更新的標的代碼列表
        """
        print("=" * 60)
        print("🔍 正在自動發現需要更新的標的...")
        print("=" * 60)
        
        all_symbols = set()
        
        try:
            # 1. 從交易記錄提取所有標的
            records = api_client.fetch_records()
            if records:
                df = pd.DataFrame(records)
                
                # 提取交易標的
                if 'symbol' in df.columns:
                    traded_symbols = df['symbol'].unique().tolist()
                    all_symbols.update(traded_symbols)
                    print(f"  ✓ 發現 {len(traded_symbols)} 個交易標的")
                    for sym in traded_symbols[:5]:
                        print(f"    - {sym}")
                    if len(traded_symbols) > 5:
                        print(f"    ... 及其他 {len(traded_symbols) - 5} 個")
                
                # 2. 自動映射貨幣到匯率對
                if 'currency' in df.columns:
                    currencies = df['currency'].unique()
                    for curr in currencies:
                        if curr in self.currency_mapping:
                            fx_pair = self.currency_mapping[curr]
                            all_symbols.add(fx_pair)
                    print(f"  ✓ 映射 {len([c for c in currencies if c in self.currency_mapping])} 個匯率對")
            
            # 3. 添加基準指數
            all_symbols.add('SPY')
            print(f"  ✓ 添加基準指數: SPY")
            
            # 4. 清除空值
            all_symbols = set(filter(None, all_symbols))
            
            result_list = sorted(list(all_symbols))
            print(f"\n✅ 自動發現完成！")
            print(f"   共發現 {len(result_list)} 個需要更新的標的")
            print("=" * 60)
            
            return result_list
        
        except Exception as e:
            logger.error(f"自動發現失敗: {e}")
            print(f"❌ 自動發現出現錯誤: {str(e)}")
            # 回退到基本標的
            return ['SPY', 'TWD=X']
    
    def should_update_symbol(self, symbol, force=False):
        """
        檢查是否需要更新某個標的
        
        參數:
            symbol (str): 標的代碼
            force (bool): 是否強制更新
        
        返回:
            bool: 是否需要更新
        """
        if force:
            return True
        
        # 檢查上次更新時間
        if symbol not in self.last_update:
            return True
        
        last_update = self.last_update[symbol]
        hours_since_update = (datetime.now() - last_update).total_seconds() / 3600
        
        # 匯率和指數：6小時更新一次
        if '=' in symbol or symbol in ['SPY', '^GSPC', '^TWII']:
            return hours_since_update >= 6
        
        # 台灣股票：工作日1次，週末跳過
        if symbol.endswith('.TW') or symbol.endswith('.TWO'):
            today = datetime.now()
            if today.weekday() >= 5:  # 週末
                return False
            return hours_since_update >= 24
        
        # 美國股票：每日更新
        return hours_since_update >= 24
    
    def robust_download(self, symbols, start_date, end_date=None):
        """
        帶重試機制的批量下載
        
        參數:
            symbols (list): 標的代碼列表
            start_date (datetime): 開始日期
            end_date (datetime): 結束日期（預設為今天）
        
        返回:
            DataFrame: 多標的的 OHLCV 數據，失敗返回 None
        """
        if end_date is None:
            end_date = datetime.now()
        
        print("\n" + "=" * 60)
        print(f"📥 準備下載市場數據")
        print(f"   標的數量: {len(symbols)}")
        print(f"   日期範圍: {start_date.date()} ~ {end_date.date()}")
        print("=" * 60)
        
        # 篩選需要更新的標的
        symbols_to_download = [s for s in symbols if self.should_update_symbol(s)]
        
        if not symbols_to_download:
            print("⚠️  所有標的都已是最新，跳過下載")
            return None
        
        print(f"需要下載的標的: {len(symbols_to_download)} 個")
        
        for attempt in range(1, self.max_retries + 1):
            try:
                print(f"\n[嘗試 {attempt}/{self.max_retries}] 正在下載...")
                
                data = yf.download(
                    tickers=symbols_to_download,
                    start=start_date,
                    end=end_date,
                    interval='1d',
                    auto_adjust=False,
                    back_adjust=False,
                    progress=False,
                    timeout=30
                )
                
                if data is not None and not data.empty:
                    print(f"✅ 下載成功！")
                    print(f"   獲取 {len(data)} 行數據")
                    
                    # 記錄更新時間
                    for symbol in symbols_to_download:
                        self.last_update[symbol] = datetime.now()
                    
                    return data
                else:
                    raise Exception("yfinance 返回空數據")
            
            except Exception as e:
                error_msg = str(e)[:100]
                print(f"⚠️  第 {attempt} 次失敗: {error_msg}")
                
                if attempt == self.max_retries:
                    print(f"❌ 在 {self.max_retries} 次嘗試後放棄下載")
                    print(f"   錯誤信息: {error_msg}")
                    return None
                
                # 指數退避
                wait_time = self.retry_delay * (2 ** (attempt - 1))
                print(f"⏳ 等待 {wait_time} 秒後重試...")
                time.sleep(wait_time)
        
        return None
    
    def process_market_data(self, data, symbols):
        """
        從下載的數據中提取 OHLCV、股息、拆股
        
        參數:
            data (DataFrame): yfinance 返回的數據
            symbols (list): 標的列表
        """
        print("\n" + "=" * 60)
        print("📊 正在處理市場數據...")
        print("=" * 60)
        
        if data is None or data.empty:
            print("❌ 沒有有效的數據可處理")
            return
        
        # 處理MultiIndex列結構（多標的時）
        if isinstance(data.columns, pd.MultiIndex):
            # 將列名轉為大寫
            data.columns = data.columns.set_levels(
                [lvl.str.upper() for lvl in data.columns.levels[1]],
                level=1
            )
            # 交換層級使Symbol在前
            data.columns = data.columns.swaplevel(0, 1)
        
        processed_count = 0
        
        for symbol in symbols:
            try:
                # 獲取該標的的數據
                if isinstance(data.columns, pd.MultiIndex):
                    sym_data = data[symbol.upper()]
                elif len(symbols) == 1:
                    sym_data = data
                else:
                    continue
                
                if sym_data.empty:
                    print(f"  ⚠️  {symbol}: 無有效數據")
                    continue
                
                # 存儲收盤價
                if 'Close' in sym_data.columns:
                    self.prices[symbol] = sym_data['Close'].dropna()
                    print(f"  ✓ {symbol}: 收盤價 {len(self.prices[symbol])} 筆")
                
                # 存儲股息
                if 'Dividends' in sym_data.columns:
                    div_data = sym_data['Dividends'][sym_data['Dividends'] > 0]
                    if len(div_data) > 0:
                        self.dividends[symbol] = div_data
                        print(f"    └─ 股息紀錄: {len(div_data)} 筆")
                
                # 存儲拆股
                if 'Stock Splits' in sym_data.columns:
                    split_data = sym_data['Stock Splits'][sym_data['Stock Splits'] != 1.0]
                    if len(split_data) > 0:
                        self.splits[symbol] = split_data
                        print(f"    └─ 拆股紀錄: {len(split_data)} 筆")
                
                processed_count += 1
            
            except KeyError:
                print(f"  ⚠️  {symbol}: 未在下載的數據中找到")
                continue
            except Exception as e:
                logger.error(f"處理 {symbol} 時出錯: {e}")
                print(f"  ❌ {symbol}: 處理出錯 - {str(e)[:50]}")
                continue
        
        print(f"\n✅ 數據處理完成！")
        print(f"   成功處理: {processed_count}/{len(symbols)} 個標的")
        print("=" * 60)
    
    def get_price(self, symbol, date):
        """
        獲取特定日期的股價
        
        參數:
            symbol (str): 標的代碼
            date (datetime): 日期
        
        返回:
            float: 股價，未找到返回 None
        """
        if symbol not in self.prices:
            return None
        
        try:
            # 嘗試精確匹配
            if date in self.prices[symbol].index:
                return self.prices[symbol][date]
            
            # 如果精確日期沒有，取最近的前一個日期
            available_dates = self.prices[symbol].index[self.prices[symbol].index <= date]
            if len(available_dates) > 0:
                nearest_date = available_dates[-1]
                return self.prices[symbol][nearest_date]
            
            return None
        except Exception as e:
            logger.error(f"獲取 {symbol} 在 {date} 的價格時出錯: {e}")
            return None
    
    def get_dividend(self, symbol, date):
        """
        獲取特定日期的股息
        
        參數:
            symbol (str): 標的代碼
            date (datetime): 日期
        
        返回:
            float: 股息，未找到返回 0
        """
        if symbol not in self.dividends:
            return 0.0
        
        try:
            if date in self.dividends[symbol].index:
                return self.dividends[symbol][date]
            return 0.0
        except:
            return 0.0
    
    def get_split_factor(self, symbol, date):
        """
        獲取特定日期的拆股因子
        
        參數:
            symbol (str): 標的代碼
            date (datetime): 日期
        
        返回:
            float: 拆股因子，無拆股返回 1.0
        """
        if symbol not in self.splits:
            return 1.0
        
        try:
            if date in self.splits[symbol].index:
                return self.splits[symbol][date]
            return 1.0
        except:
            return 1.0
    
    def get_cumulative_splits(self, symbol, start_date, end_date):
        """
        獲取日期範圍內所有拆股的累乘因子
        
        參數:
            symbol (str): 標的代碼
            start_date (datetime): 開始日期
