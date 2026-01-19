import pandas as pd
import yfinance as yf
import concurrent.futures
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        """
        初始化市場數據客戶端
        - market_data: 儲存所有股票的歷史價格數據
        - fx_rates: 儲存匯率數據（USD/TWD）
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
            # 先抓取歷史日線
            fx_hist = fx.history(start=start_date - timedelta(days=5))
            
            if not fx_hist.empty:
                # 標準化時區和日期格式
                fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
                # 按日重採樣並前向填充（處理週末/假日）
                self.fx_rates = fx_hist['Close'].resample('D').ffill()

                # ✅ [修復] 強制抓取最新的即時匯率 (1分鐘K線)
                try:
                    print("[FX] 正在獲取即時匯率...")
                    realtime_data = fx.history(period="1d", interval="1m")
                    if not realtime_data.empty:
                        latest_rate = float(realtime_data['Close'].iloc[-1])
                        today = pd.Timestamp.now().normalize()
                        self.fx_rates[today] = latest_rate
                        print(f"[FX] ✅ 已獲取即時匯率: {latest_rate:.4f}")
                    else:
                        print("[FX] ⚠️ 無法獲取即時數據，使用日線資料")
                except Exception as e:
                    print(f"[FX] ⚠️ 即時匯率抓取失敗: {e}")

            else:
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
        except Exception as e:
            print(f"[FX] 匯率下載嚴重錯誤: {e}")
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

        # ==================== 2. 下載個股數據 (平行化) ====================
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))
        
        def fetch_single_ticker(t):
            try:
                ticker_obj = yf.Ticker(t)
                
                # ✅ [關鍵修正] 使用 auto_adjust=True 確保復權價格一致性
                # auto_adjust=True 會讓 Close 直接等於復權價，避免即時價破壞復權邏輯
                hist = ticker_obj.history(start=start_date, auto_adjust=True, actions=True)
                
                if not hist.empty:
                    # 標準化日期格式
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    
                    # ✅ [移除] 不再抓取即時報價，避免破壞復權價格
                    # 原因: 
                    # 1. 即時價是原始價，覆蓋 Adj Close 會導致斷層
                    # 2. 對 benchmark 計算而言，一致性比即時性更重要
                    # 3. 日線數據已經包含到今天，延遲最多幾小時
                    
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
            future_to_ticker = {executor.submit(fetch_single_ticker, t): t for t in all_tickers}
            
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
        
        ✅ [重大修正] 當 auto_adjust=True 時：
        - Close 已經是復權價（= 舊版的 Adj Close）
        - Adj Close 欄位不存在
        - Dividends 和 Stock Splits 事件已經被反映在 Close 中
        
        核心概念：
        - Close_Adjusted: 統一使用復權價格
        - Split_Factor: 累積拆股倍數
        - Dividend_Adj_Factor: 配息調整因子
        """
        df = df.copy()
        
        # ✅ [修正] 當 auto_adjust=True 時，Close 已經是復權價
        # 不需要另外計算 Dividend_Adj_Factor
        df['Close_Adjusted'] = df['Close']
        df['Close_Raw'] = df['Close']  # 在 auto_adjust=True 時兩者相同
        
        # ==================== 計算累積拆股因子 ====================
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0
        
        splits = df['Stock Splits'].replace(0, 1.0)
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        df['Split_Factor'] = cum_splits.shift(-1).fillna(1.0)
        
        # ✅ [簡化] 當 auto_adjust=True 時，Dividend_Adj_Factor 恆定為 1.0
        # 因為 Close 已經包含配息調整，不需要再次調整
        df['Dividend_Adj_Factor'] = 1.0
        
        return df

    def get_price(self, symbol, date):
        """
        取得指定日期的股票價格（使用 Close_Adjusted）
        
        ✅ [修正] 現在 Close_Adjusted 是統一的復權價格
        - 包含拆股調整（連續性）
        - 包含配息調整（總回報）
        - 形成平滑曲線（無斷層）
        
        參數:
            symbol: 股票代碼
            date: 查詢日期（pd.Timestamp 或 datetime）
        
        返回:
            調整後的收盤價（float）
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
        
        用途：將原始交易股數轉換為當前等價股數
        
        範例：
        - 2024-01-02 買入 NVDA 100股 @ $492.44
        - 2024-06-10 拆股 10:1
        - get_transaction_multiplier('NVDA', '2024-01-02') = 10.0
        - 調整後股數: 100 × 10 = 1000股
        - 調整後價格: $492.44 / 10 = $49.24
        
        參數:
            symbol: 股票代碼
            date: 交易日期
        
        返回:
            拆股因子（float，無拆股時為 1.0）
        """
        if symbol not in self.market_data:
            return 1.0
        
        try:
            df = self.market_data[symbol]
            
            if date in df.index:
                return float(df.loc[date, 'Split_Factor'])
            
            if date < df.index.min():
                return float(df.iloc[0]['Split_Factor'])
            
            return float(df.iloc[-1]['Split_Factor'])
        except:
            return 1.0

    def get_dividend_adjustment_factor(self, symbol, date):
        """
        取得配息調整因子
        
        ✅ [修正] 當 auto_adjust=True 時，此因子恆定為 1.0
        原因: Close 已經包含配息調整，不需要再次調整成本
        
        參數:
            symbol: 股票代碼
            date: 交易日期
        
        返回:
            配息調整因子（恒為 1.0）
        """
        if symbol not in self.market_data:
            return 1.0
        
        try:
            df = self.market_data[symbol]
            
            if date in df.index:
                return float(df.loc[date, 'Dividend_Adj_Factor'])
            
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Dividend_Adj_Factor'])
            
            return 1.0
        except:
            return 1.0

    def get_dividend(self, symbol, date):
        """
        取得指定日期的配息金額（每股）
        
        用途：記錄配息明細（僅用於報表顯示）
        
        重要提醒：
        - 此方法返回的是「除息日當天」的配息金額
        - yfinance 記錄的日期是「Ex-Dividend Date」（除息日）
        - 實際入帳日期（Payment Date）通常晚 1-2 週
        - 配息金額已經是「拆股調整後」的金額
        
        注意：
        - 當使用 Adj Close 計算市值時，配息效果已經包含在價格中
        - 不應該將此配息再次累加到 realized_pnl（會導致雙重計算）
        - 此方法僅用於產生配息明細報表
        
        參數:
            symbol: 股票代碼
            date: 查詢日期（除息日）
        
        返回:
            每股配息金額（USD，稅前）
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