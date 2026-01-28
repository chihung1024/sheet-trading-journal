import pandas as pd
import yfinance as yf
import concurrent.futures
import pytz
from datetime import datetime, timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE
from .auto_price_selector import AutoPriceSelector

class MarketDataClient:
    @staticmethod
    def _normalize_twd_per_usd(rate: float) -> float:
        """Normalize FX to 'TWD per 1 USD'.

        Defensive guard: some data sources (or transforms) may return the inverse
        (USD per 1 TWD), which is typically < 1.0.
        """
        try:
            r = float(rate)
            if r <= 0:
                return DEFAULT_FX_RATE
            return (1.0 / r) if r < 1.0 else r
        except Exception:
            return DEFAULT_FX_RATE

    def __init__(self):
        """
        初始化市場數據客戶端
        - market_data: 存儲所有股票的歷史價格數據
        - fx_rates: 存儲匯率數據（USD/TWD）
        - realtime_fx_rate: [v2.52] 存儲即時匯率，與歷史數據分離
        """
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)
        self.realtime_fx_rate = None  # [v2.52] 新增獨立的即時匯率存儲

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
                self.fx_rates = fx_hist['Close'].resample('D').ffill().apply(self._normalize_twd_per_usd)

                # ✅ [v2.52 FIX] 修正匯率更新邏輯
                # 將即時匯率存入 self.realtime_fx_rate，而不覆蓋 self.fx_rates
                # 這樣 calculator 可以在計算"今天"的資產時使用即時匯率，而歷史曲線保持不變
                try:
                    print("[FX] 正在獲取即時匯率...")
                    
                    latest_rate = None
                    
                    # 2. 優先嘗試 fast_info (Yahoo Finance 新版 API，反應更快)
                    try:
                        # 嘗試獲取最後成交價
                        raw_price = fx.fast_info.get('last_price') or fx.fast_info.get('regular_market_price')
                        if raw_price:
                            latest_rate = self._normalize_twd_per_usd(float(raw_price))
                            print(f"[FX] 使用 fast_info 獲取: {latest_rate:.4f}")
                    except Exception as e:
                        pass

                    # 3. 備案：抓取最近 1 天的 1 分鐘資料，取最後一筆
                    if latest_rate is None:
                        realtime_data = fx.history(period="1d", interval="1m")
                        if not realtime_data.empty:
                            latest_rate = self._normalize_twd_per_usd(float(realtime_data['Close'].iloc[-1]))
                            print(f"[FX] 使用 1m K線 獲取: {latest_rate:.4f}")

                    # 4. 更新即時數據變數
                    if latest_rate is not None:
                        self.realtime_fx_rate = latest_rate
                        print(f"[FX] ✅ 已獲取即時匯率: {latest_rate:.4f} (存儲於 realtime_fx_rate)")
                    else:
                        print("[FX] ⚠️ 無法獲取即時數據，後續計算將依賴歷史收盤")

                except Exception as e:
                    print(f"[FX] ⚠️ 即時匯率抓取失敗: {e}")

            else:
                # 若下載失敗，使用預設匯率
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
        except Exception as e:
            print(f"[FX] 匯率下載嚴重錯誤: {e}")
            # 錯誤處理：使用預設匯率
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

        # ==================== 2. 下載個股數據 (平行化) ====================
        # 確保包含 SPY（用於基準對比）
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))
        
        # 定義單個下載任務函數
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
                    
                    # ✅ [新增] 強制抓取即時報價 (1分鐘 K 線)
                    # 解決盤中 Daily 資料未更新，導致損益不動的問題
                    try:
                        # 只抓取最近 1 天的 1 分鐘資料
                        intraday = ticker_obj.history(period="1d", interval="1m")
                        
                        if not intraday.empty:
                            latest_price = float(intraday['Close'].iloc[-1])
                            last_date = hist.index[-1]
                            
                            # 如果日線最後一筆存在，就用即時價覆蓋 Close 和 Adj Close
                            # 這樣能確保 calculator.py 抓到的價格是當下最新的
                            hist.at[last_date, 'Close'] = latest_price
                            hist.at[last_date, 'Adj Close'] = latest_price
                            
                            print(f"[{t}] ✅ 即時報價覆蓋: {latest_price:.2f}")
                    except Exception as e:
                        # 抓不到即時資料就維持原本的日線，不報錯以免影響流程
                        pass

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
        [v2.48] 準備股票數據：使用 AutoPriceSelector 智能選擇價格字段
        """
        df = df.copy()
        
        # ✅ 使用智能選擇器
        selector = AutoPriceSelector(symbol, df)
        df['Close_Adjusted'] = selector.get_adjusted_price_series()
        
        # 記錄選擇結果（用於審計）
        metadata = selector.get_metadata()
        print(f"[{symbol}] 價格來源: {metadata['price_source']} - {metadata['selection_reason']}")
        
        # 保留原始 Close 用於參考（實際成交價）
        df['Close_Raw'] = df['Close']
        
        # ==================== 計算累積拆股因子 ====================
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0
        
        splits = df['Stock Splits'].replace(0, 1.0)
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        df['Split_Factor'] = cum_splits.shift(-1).fillna(1.0)
        
        # ==================== 計算配息調整因子 ====================
        if metadata['price_source'] == 'Adj Close':
            df['Dividend_Adj_Factor'] = df['Adj Close'] / df['Close']
        else:
            df['Dividend_Adj_Factor'] = 1.0
        
        return df

    def get_price(self, symbol, date):
        """取得指定日期的股票價格 [v2.48] AutoPriceSelector"""
        if symbol not in self.market_data:
            return 0.0
        
        try:
            df = self.market_data[symbol]
            if date in df.index:
                return float(df.loc[date, 'Close_Adjusted'])
            
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Close_Adjusted'])
            
            return 0.0
        except:
            return 0.0

    def get_transaction_multiplier(self, symbol, date):
        """取得交易日的拆股復權因子"""
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
        """取得配息調整因子"""
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
        """取得指定日期的配息金額（每股）"""
        if symbol not in self.market_data:
            return 0.0
        
        try:
            df = self.market_data[symbol]
            if date in df.index:
                return float(df.loc[date, 'Dividends'])
        except:
            pass
        
        return 0.0
