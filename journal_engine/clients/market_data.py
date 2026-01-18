import pandas as pd
import yfinance as yf
import concurrent.futures
import logging
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

# 取得 logger 實例
logger = logging.getLogger(__name__)

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
        logger.info(f"正在下載市場數據，起始日期: {start_date}...")
        
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

                # ✅ 強制抓取最新的即時匯率 (1分鐘K線)
                # 解決 Daily 資料在盤中可能不會即時更新的問題
                try:
                    logger.info(f"[FX] 正在獲取 {EXCHANGE_SYMBOL} 即時匯率...")
                    # 抓取最近 1 天的 1 分鐘資料，取最後一筆
                    realtime_data = fx.history(period="1d", interval="1m")
                    if not realtime_data.empty:
                        latest_rate = float(realtime_data['Close'].iloc[-1])
                        # 取得今日的標準化日期 (00:00:00)
                        today = pd.Timestamp.now().normalize()
                        
                        # 覆蓋或新增今日匯率
                        self.fx_rates[today] = latest_rate
                        logger.info(f"[FX] ✅ 已獲取即時匯率: {latest_rate:.4f}")
                    else:
                        logger.warning("[FX] ⚠️ 無法獲取即時數據，使用日線資料")
                except Exception as e:
                    logger.warning(f"[FX] ⚠️ 即時匯率抓取失敗: {e}")

            else:
                logger.warning(f"[FX] 下載失敗，將使用預設匯率: {DEFAULT_FX_RATE}")
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
        except Exception as e:
            logger.error(f"[FX] 匯率下載嚴重錯誤: {e}")
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
                    
                    # ✅ 強制抓取即時報價 (1分鐘 K線)覆蓋今日數據
                    try:
                        intraday = ticker_obj.history(period="1d", interval="1m")
                        if not intraday.empty:
                            latest_price = float(intraday['Close'].iloc[-1])
                            last_date = hist.index[-1]
                            
                            # 用即時價覆蓋日線最後一筆，確保計算當下損益是最新的
                            hist.at[last_date, 'Close'] = latest_price
                            hist.at[last_date, 'Adj Close'] = latest_price
                            logger.info(f"[{t}] ✅ 即時報價覆蓋: {latest_price:.2f}")
                    except:
                        pass

                    # 準備數據：計算調整因子
                    hist_adj = self._prepare_data(t, hist)
                    return t, hist_adj
                else:
                    logger.warning(f"[{t}] 警告: 無歷史數據")
                    return t, None
                    
            except Exception as e:
                logger.error(f"[{t}] 下載錯誤: {e}")
                return t, None

        # 使用 ThreadPoolExecutor 平行下載提高效率
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_ticker = {executor.submit(fetch_single_ticker, t): t for t in all_tickers}
            
            for future in concurrent.futures.as_completed(future_to_ticker):
                result = future.result()
                if result:
                    ticker, data = result
                    if data is not None:
                        self.market_data[ticker] = data
                        logger.info(f"[{ticker}] 下載與預處理成功")
        
        return self.market_data, self.fx_rates

    def _prepare_data(self, symbol, df):
        """
        準備股票數據：計算拆股與配息調整因子
        """
        df = df.copy()
        
        # 使用 Adj Close 作為主要價格基礎 (yfinance 會追溯調整配息再投資效果)
        df['Close_Adjusted'] = df['Adj Close']
        df['Close_Raw'] = df['Close']
        
        # --- 計算累積拆股因子 ---
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0
        
        splits = df['Stock Splits'].replace(0, 1.0)
        # 反向累積計算：讓歷史交易能換算成當前股數
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        
        # 對齊日期：拆股日之前的交易需要調整
        df['Split_Factor'] = cum_splits.shift(-1).fillna(1.0)
        
        # --- 計算配息調整因子 ---
        # 公式：Dividend_Adj_Factor = Adj Close / Close
        # 用於將「歷史買入價」調整到與「現在市值」相同的基準
        df['Dividend_Adj_Factor'] = df['Adj Close'] / df['Close']
        
        return df

    def get_price(self, symbol, date):
        """取得指定日期的調整後價格"""
        if symbol not in self.market_data:
            return 0.0
        
        try:
            df = self.market_data[symbol]
            if date in df.index:
                return float(df.loc[date, 'Close_Adjusted'])
            
            # 若找不到（如週末），向前尋找最近的交易日
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
        """取得指定日期的每股配息金額 (USD)"""
        if symbol not in self.market_data:
            return 0.0
        
        try:
            df = self.market_data[symbol]
            if date in df.index:
                return float(df.loc[date, 'Dividends'])
        except:
            pass
        return 0.0
