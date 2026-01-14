import pandas as pd
import yfinance as yf
import concurrent.futures
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        """
        初始化市場數據客戶端
        - market_data: 存儲所有股票的歷史價格數據
        - fx_rates: 存儲匯率數據（USD/TWD）
        """
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)

    def download_data(self, tickers: list, start_date):
        """
        下載市場數據（股票價格 + 匯率）
        
        參數:
            tickers: 股票代碼列表（如 ['NVDA', 'QQQI']）
            start_date: 開始日期
        
        返回:
            (market_data, fx_rates) 元組
        """
        print(f"正在下載市場數據，起始日期: {start_date}...")
        
        # ==================== 1. 下載匯率數據 ====================
        try:
            fx = yf.Ticker(EXCHANGE_SYMBOL)
            fx_hist = fx.history(start=start_date - timedelta(days=5))
            
            if not fx_hist.empty:
                # 標準化時區和日期格式
                fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
                # 按日重採樣並前向填充（處理週末/假日）
                self.fx_rates = fx_hist['Close'].resample('D').ffill()
            else:
                # 若下載失敗，使用預設匯率
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
        except:
            # 錯誤處理：使用預設匯率
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

        # ==================== 2. 下載個股數據 (平行化) ====================
        # 確保包含 SPY（用於基準對比）
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))
        
        # 定義單個下載任務函數 (注意這裡的縮排是 8 個空格)
        def fetch_single_ticker(t):
            try:
                ticker_obj = yf.Ticker(t)
                
                # 關鍵參數設定：
                # - auto_adjust=False: 保留原始 Close 和 Adj Close 兩欄
                # - actions=True: 包含 Dividends 和 Stock Splits 事件
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    # 標準化日期格式
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    # 準備數據：計算調整因子
                    hist_adj = self._prepare_data(t, hist)
                    return t, hist_adj
                else:
                    print(f"[{t}] 警告: 無歷史數據")
                    return t, None
                    
            except Exception as e:
                print(f"[{t}] 下載錯誤: {e}")
                return t, None

        # 使用 ThreadPoolExecutor 平行下載
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            # 提交所有任務
            future_to_ticker = {executor.submit(fetch_single_ticker, t): t for t in all_tickers}
            
            # 收集結果
            for future in concurrent.futures.as_completed(future_to_ticker):
                result = future.result()
                if result:
                    ticker, data = result
                    if data is not None:
                        self.market_data[ticker] = data
                        print(f"[{ticker}] 下載成功")
        
        return self.market_data, self.fx_rates

    def _prepare_data(self, symbol, df):
        """
        準備股票數據：計算各種調整因子
        """
        df = df.copy()
        
        # ==================== 使用 Adj Close 作為主要價格 ====================
        df['Close_Adjusted'] = df['Adj Close']
        
        # 保留原始 Close 用於參考（實際成交價）
        df['Close_Raw'] = df['Close']
        
        # ==================== 計算累積拆股因子 ====================
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0
        
        # 將 0 替換為 1.0（表示沒有拆股）
        splits = df['Stock Splits'].replace(0, 1.0)
        
        # 反向累積計算：從最新日期往回累積
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        
        # Shift(-1) 讓因子對齊到正確的日期
        df['Split_Factor'] = cum_splits.shift(-1).fillna(1.0)
        
        # ==================== 計算配息調整因子 ====================
        df['Dividend_Adj_Factor'] = df['Adj Close'] / df['Close']
        
        return df

    def get_price(self, symbol, date):
        """
        取得指定日期的股票價格（使用 Adj Close）
        """
        if symbol not in self.market_data:
            return 0.0
        
        try:
            df = self.market_data[symbol]
            
            # 優先精確匹配日期
            if date in df.index:
                return float(df.loc[date, 'Close_Adjusted'])
            
            # 若找不到（如週末/假日），使用最近的前一個交易日價格
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Close_Adjusted'])
            
            return 0.0
        except:
            return 0.0

    def get_transaction_multiplier(self, symbol, date):
        """
        取得交易日的拆股復權因子
        """
        if symbol not in self.market_data:
            return 1.0
        
        try:
            df = self.market_data[symbol]
            
            # 精確匹配日期
            if date in df.index:
                return float(df.loc[date, 'Split_Factor'])
            
            # 若交易日在數據範圍之前（太早），使用最早的因子
            if date < df.index.min():
                return float(df.iloc[0]['Split_Factor'])
            
            # 若交易日在數據範圍之後（未來），使用最新的因子（通常是1.0）
            return float(df.iloc[-1]['Split_Factor'])
        except:
            return 1.0

    def get_dividend_adjustment_factor(self, symbol, date):
        """
        取得配息調整因子
        """
        if symbol not in self.market_data:
            return 1.0
        
        try:
            df = self.market_data[symbol]
            
            # 精確匹配日期
            if date in df.index:
                return float(df.loc[date, 'Dividend_Adj_Factor'])
            
            # 若找不到，向前填補最近的因子
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Dividend_Adj_Factor'])
            
            return 1.0
        except:
            return 1.0

    def get_dividend(self, symbol, date):
        """
        取得指定日期的配息金額（每股）
        """
        if symbol not in self.market_data:
            return 0.0
        
        try:
            df = self.market_data[symbol]
            if date in df.index:
                return float(df.loc[date, 'Dividends'])
        except:
            pass
        
        return 0.0
