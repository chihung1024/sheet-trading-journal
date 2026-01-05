import pandas as pd
import numpy as np
import yfinance as yf
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)
        
        # [手動強制拆股清單] 
        # 格式: Symbol: { 'YYYY-MM-DD': Ratio }
        # 日期必須是 "Ex-Date" (除權日)
        self.manual_splits = {
            'NVDA': {'2024-06-10': 10.0},
            'GOOGL': {'2022-07-18': 20.0},
            'AMZN': {'2022-06-06': 20.0},
            'TSLA': {'2022-08-25': 3.0},
        }

    def download_data(self, tickers: list, start_date):
        print(f"正在下載市場數據，起始日期: {start_date}...")
        
        # 1. 下載匯率 (含 Smart Fill)
        try:
            fx = yf.Ticker(EXCHANGE_SYMBOL)
            fx_hist = fx.history(start=start_date - timedelta(days=5))
            if not fx_hist.empty:
                fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
                # 匯率沒有拆股問題，直接 Resample + FFill
                self.fx_rates = fx_hist['Close'].resample('D').ffill()
                print(f"匯率下載成功，最新匯率: {self.fx_rates.iloc[-1]:.2f}")
            else:
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
        except Exception as e:
            print(f"匯率下載失敗: {e}，使用預設匯率")
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

        # 2. 下載個股數據 (含 Split-Aware Smart Fill)
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))
        
        for t in all_tickers:
            try:
                ticker_obj = yf.Ticker(t)
                # 取得原始資料 (Raw Price)
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    # 正規化日期索引
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    
                    # ----------------------------------------------------
                    # [Critical Fix] 應用「拆股感知填補演算法」
                    # 解決拆股日缺資料導致價格暴衝的問題
                    # ----------------------------------------------------
                    full_hist = self._apply_smart_fill(t, hist)
                    
                    self.market_data[t] = hist # 原始資料 (查配息用)
                    self.market_data[f"{t}_filled"] = full_hist # 填補後資料 (查價格用)
                    
                    print(f"[{t}] 數據下載與修復成功")
                else:
                    print(f"[{t}] 警告: 無法取得歷史數據")
                    
            except Exception as e:
                print(f"[{t}] 下載發生錯誤: {e}")
        
        return self.market_data, self.fx_rates
    
    def _apply_smart_fill(self, symbol, hist):
        """
        核心演算法：拆股感知填補 (Split-Aware Smart Fill)
        1. 整合手動與 API 的拆股資訊。
        2. 計算「反向累積拆股因子」(Backward Factor)。
        3. 將原始價格轉為平滑的「複權價格」。
        4. 對複權價格進行填補 (ffill)。
        5. 將填補後的複權價格還原為「原始價格」。
        """
        # 1. 擴充完整的日曆日 (包含假日)
        full_idx = pd.date_range(start=hist.index.min(), end=pd.Timestamp.now().normalize(), freq='D')
        df = hist.reindex(full_idx)
        
        # 2. 整合拆股資訊
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0
        
        # 注入手動設定的拆股
        if symbol in self.manual_splits:
            for date_str, ratio in self.manual_splits[symbol].items():
                date_ts = pd.Timestamp(date_str).normalize()
                if date_ts in df.index:
                    # 強制覆寫 API 的拆股資訊
                    df.loc[date_ts, 'Stock Splits'] = ratio

        # 3. 計算 Backward Split Factor (由今天往回推)
        # 邏輯：今天的因子是 1。遇到 10:1 拆股，前面的因子變成 10。
        # 這樣 Price / Factor 就會是一條平滑曲線。
        
        # 先將 0 或 NaN 轉為 1 (無拆股)
        split_ratios = df['Stock Splits'].fillna(0).replace(0, 1.0)
        
        # 因為 yfinance 的 split 發生在 Ex-Date，代表當天價格已變。
        # 所以我們要調整的是「Ex-Date 之前」的所有價格。
        # 使用 shift(-1) 讓因子從前一天開始生效，並累積相乘
        # 注意：pandas 的 cumprod 是從前往後，我們需要從後往前
        
        # 這裡改用一個更直觀的方法：
        # 建立一個 Series，預設 1.0
        # 掃描所有 split > 1 的日期
        adjust_factor = pd.Series(1.0, index=df.index)
        
        splits = split_ratios[split_ratios != 1.0]
        for date, ratio in splits.items():
            # 對於拆股日(含)之前的因子進行累積乘法？
            # 不，價格是在 Ex-Date 變小。所以 Ex-Date 之前的價格需要除以因子才能變平滑？
            # 沒錯： $1200 (Pre) -> $120 (Post). Factor=10. $1200/10 = $120.
            # 所以 Ex-Date 之前的所有日期，因子都要乘以 Ratio。
            mask = df.index < date
            adjust_factor.loc[mask] *= ratio
            
        # 4. 計算平滑價格 (Adjusted Close) 並填補
        # 這裡的 Adjusted Close 純粹是為了填補用，不是技術分析用的 Adj Close
        raw_close = df['Close']
        smooth_close = raw_close / adjust_factor
        
        # 進行填補 (這時候填補是安全的，因為曲線是平滑的)
        smooth_filled = smooth_close.ffill()
        
        # 5. 還原為原始價格
        # 還原公式：平滑價格 * 因子
        raw_filled = smooth_filled * adjust_factor
        
        # 建立回傳 DataFrame
        result = pd.DataFrame(index=df.index)
        result['Close'] = raw_filled
        
        return result

    def get_price(self, symbol, date):
        """取得特定日期的收盤價 (優先使用修復後的數據)"""
        key = f"{symbol}_filled"
        source = self.market_data.get(key, self.market_data.get(symbol))
        
        if source is None: return 0.0
        try:
            # 嘗試取得當日價格
            if date in source.index:
                price = float(source.loc[date]['Close'])
                if not pd.isna(price): return price
            
            # 若當日無資料 (照理說 smart fill 後不該發生，除非起始日問題)
            price = source['Close'].asof(date)
            return float(source['Close'].iloc[-1]) if pd.isna(price) else float(price)
        except: return 0.0
    
    def get_dividend(self, symbol, date):
        if symbol not in self.market_data: return 0.0
        try:
            actions = self.market_data[symbol]
            if date in actions.index and 'Dividends' in actions.columns:
                div = actions.loc[date]['Dividends']
                return float(div.iloc[0]) if isinstance(div, pd.Series) else float(div)
        except: pass
        return 0.0

    def get_split_ratio(self, symbol, date):
        # 優先檢查手動清單
        date_str = date.strftime('%Y-%m-%d')
        if symbol in self.manual_splits and date_str in self.manual_splits[symbol]:
            return self.manual_splits[symbol][date_str]

        # 檢查 API 數據
        if symbol not in self.market_data: return 1.0
        try:
            actions = self.market_data[symbol]
            if date in actions.index and 'Stock Splits' in actions.columns:
                split = actions.loc[date]['Stock Splits']
                if isinstance(split, pd.Series): split = split.iloc[0]
                if split > 0 and split != 1: return float(split)
        except: pass
        return 1.0
