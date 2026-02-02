import pandas as pd
import yfinance as yf
import concurrent.futures
import pytz
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE, Config
from .auto_price_selector import AutoPriceSelector

class MarketDataClient:
    """
    負責從 Yahoo Finance 獲取股票價格、匯率及歷史數據的客戶端。
    支援即時匯率更新、歷史數據快取以及自動處理市場日期對齊。
    """

    @staticmethod
    def _normalize_twd_per_usd(rate: float) -> float:
        """
        正規化匯率：確保回傳值為「1 美金兌換台幣」之數值。
        處理數據源可能出現的 TWD/USD (約 0.03) 或 USD/TWD (約 32) 混用情況。
        """
        try:
            r = float(rate)
            if r <= 0:
                return DEFAULT_FX_RATE
            # 若數值小於 1.0 (例如 0.031)，判定為 TWD/USD，需取倒數轉換為 TWD per 1 USD
            return (1.0 / r) if r < 1.0 else r
        except Exception:
            return DEFAULT_FX_RATE

    def __init__(self):
        """
        初始化市場數據客戶端
        - market_data: 存儲所有股票的歷史價格數據 {symbol: DataFrame}
        - fx_rates: 存儲歷史匯率數據序列
        - realtime_fx_rate: 存儲最新的即時匯率點位 (T1)
        """
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)
        self.realtime_fx_rate = None  
        self.last_update_time = None

    def download_data(self, tickers: list, start_date):
        """下載市場數據（股票價格 + 匯率）。"""
        print(f"🚀 [MarketData] 開始下載市場數據，起始日期: {start_date}")
        
        # 1. 下載匯率數據 (TWD=X)
        try:
            # 獲取較長範圍以確保計算基準日 (T0) 有資料
            fx_df = yf.download(EXCHANGE_SYMBOL, start=start_date, interval="1d", progress=False)
            if not fx_df.empty:
                # 處理 Yahoo 可能返回的 MultiIndex 或單一列結構
                close_col = fx_df['Close']
                if isinstance(close_col, pd.DataFrame):
                    close_col = close_col.iloc[:, 0]
                
                # 正規化並重採樣為每日資料，使用 ffill 填充假日
                self.fx_rates = close_col.apply(self._normalize_twd_per_usd).resample('D').ffill()
                
                # 獲取最即時的匯率 (Intraday)
                ticker_fx = yf.Ticker(EXCHANGE_SYMBOL)
                # 優先使用 fast_info，若無則取歷史最後一筆
                fast_info = getattr(ticker_fx, 'fast_info', {})
                last_price = fast_info.get('last_price')
                
                if last_price and last_price > 0:
                    self.realtime_fx_rate = self._normalize_twd_per_usd(last_price)
                else:
                    self.realtime_fx_rate = self.fx_rates.iloc[-1]
                
                print(f"✅ [FX] 匯率同步完成. 當前即時匯率: {self.realtime_fx_rate:.4f}")
        except Exception as e:
            print(f"❌ [FX] 匯率下載失敗: {e}. 使用預設值 {DEFAULT_FX_RATE}")
            self.realtime_fx_rate = DEFAULT_FX_RATE

        # 2. 使用執行緒池並行下載股票數據
        def fetch_ticker(ticker_sym):
            try:
                t = yf.Ticker(ticker_sym)
                # 使用 history 以獲取 Splits 與 Dividends (方案 A 需用到)
                df = t.history(start=start_date, interval="1d")
                if not df.empty:
                    # 統一時區為 naive 以便後續計算
                    df.index = df.index.tz_localize(None).normalize()
                    # 預先計算累計拆股因子 (Scheme A 專用)
                    if 'Stock Splits' in df.columns:
                        # 將 0 替換為 1，然後計算反向累積乘積
                        df['Split_Factor'] = df['Stock Splits'].replace(0, 1).iloc[::-1].cumprod().iloc[::-1]
                    else:
                        df['Split_Factor'] = 1.0
                    return ticker_sym, df
                return ticker_sym, None
            except Exception as ex:
                print(f"❌ [Stock] 下載 {ticker_sym} 失敗: {ex}")
                return ticker_sym, None

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_ticker = {executor.submit(fetch_ticker, s): s for s in tickers}
            for future in concurrent.futures.as_completed(future_to_ticker):
                sym, data = future.result()
                if data is not None:
                    self.market_data[sym] = data
                    print(f"✅ [Stock] {sym} 同步完成")

        self.last_update_time = datetime.now()

    def get_price(self, symbol, date):
        """獲取指定日期的收盤價。"""
        if symbol not in self.market_data:
            return 0.0
        try:
            df = self.market_data[symbol]
            dt = pd.to_datetime(date).tz_localize(None).normalize()
            if dt in df.index:
                return float(df.loc[dt, 'Close'])
            
            # 假日處理：取之前最後一個交易日價格
            past_dates = df.index[df.index <= dt]
            if not past_dates.empty:
                return float(df.loc[past_dates[-1], 'Close'])
            return 0.0
        except:
            return 0.0

    def get_price_asof(self, symbol, used_date):
        """獲取特定日期或其之前最後一個有效價格，並回傳時間戳。"""
        if symbol not in self.market_data:
            return 0.0, used_date
        try:
            df = self.market_data[symbol]
            dt = pd.to_datetime(used_date).tz_localize(None).normalize()
            
            past_dates = df.index[df.index <= dt]
            if not past_dates.empty:
                actual_date = past_dates[-1]
                return float(df.loc[actual_date, 'Close']), actual_date
            return 0.0, used_date
        except:
            return 0.0, used_date

    def get_prev_trading_date(self, symbol, used_date):
        """
        🚀 核心邏輯修正：獲取 target_date 之前（不含當日）的最後一個有效交易日。
        此為損益計算之基準日 (T0)，解決週一盤前基準日位移問題。
        """
        try:
            if symbol not in self.market_data:
                return pd.to_datetime(used_date).tz_localize(None).normalize() - timedelta(days=1)

            df = self.market_data[symbol]
            dt = pd.to_datetime(used_date).tz_localize(None).normalize()

            # 找出所有嚴格早於目標日期的交易日
            past_dates = df.index[df.index < dt]
            if not past_dates.empty:
                # 返回最後一個有資料的日期 (即上一個有效收盤日)
                return past_dates[-1]
            
            return dt - timedelta(days=1)
        except:
            return pd.to_datetime(used_date).tz_localize(None).normalize() - timedelta(days=1)

    def get_transaction_multiplier(self, symbol, date):
        """取得交易日的拆股復權因子（方案 A 專用）。"""
        if symbol not in self.market_data:
            return 1.0
        try:
            df = self.market_data[symbol]
            dt = pd.to_datetime(date).tz_localize(None).normalize()
            
            if dt in df.index:
                return float(df.loc[dt, 'Split_Factor'])
            
            if not df.empty:
                if dt < df.index.min():
                    return float(df.iloc[0]['Split_Factor'])
                return float(df.iloc[-1]['Split_Factor'])
            return 1.0
        except:
            return 1.0

    def get_dividend_adjustment_factor(self, symbol, date):
        """取得配息調整因子（方案 A：永遠為 1，因為配息另計）。"""
        return 1.0

    def get_dividend(self, symbol, date):
        """取得指定日期的配息金額（方案 A 抓取）。"""
        if symbol not in self.market_data:
            return 0.0
        try:
            df = self.market_data[symbol]
            dt = pd.to_datetime(date).tz_localize(None).normalize()
            if dt in df.index and 'Dividends' in df.columns:
                return float(df.loc[dt, 'Dividends'])
            return 0.0
        except:
            return 0.0
