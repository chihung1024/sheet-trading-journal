import pandas as pd
import yfinance as yf
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)

    def download_data(self, tickers: list, start_date):
        """
        下載股價、匯率、配息與拆股資訊
        關鍵修正：使用 .normalize() 確保日期時間為 00:00:00，以便精確比對
        """
        print(f"正在下載市場數據，起始日期: {start_date}...")
        
        # 1. 下載匯率 (USD -> TWD)
        try:
            fx = yf.Ticker(EXCHANGE_SYMBOL)
            # 增加緩衝天數以避免匯率空窗
            fx_hist = fx.history(start=start_date - timedelta(days=5))
            if not fx_hist.empty:
                # 移除時區並正規化時間至午夜
                fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
                self.fx_rates = fx_hist['Close']
                print(f"匯率下載成功，最新匯率: {self.fx_rates.iloc[-1]:.2f}")
            else:
                print("警告: 匯率數據為空，將使用預設值")
        except Exception as e:
            print(f"匯率下載失敗: {e}")

        # 匯率防呆
        if self.fx_rates.empty:
            print(f"嚴重警告: 無法取得匯率，全域使用 {DEFAULT_FX_RATE}")
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

        # 2. 下載個股數據 (含 Benchmark SPY)
        # 確保列表包含 SPY 且不重複，並移除空值
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))
        
        for t in all_tickers:
            try:
                ticker_obj = yf.Ticker(t)
                
                # [重要設定] 
                # auto_adjust=False: 取得當下的原始股價 (Raw Price)
                # actions=True: 包含 Dividends (股息) 與 Stock Splits (拆股)
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    # 正規化時間索引
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    self.market_data[t] = hist
                    print(f"[{t}] 數據下載成功 ({len(hist)} 筆)")
                else:
                    print(f"[{t}] 警告: 無法取得歷史數據")
                    
            except Exception as e:
                print(f"[{t}] 下載發生錯誤: {e}")
        
        return self.market_data, self.fx_rates
    
    def get_price(self, symbol, date):
        """取得特定日期的收盤價 (Raw)，若無則取最近一日"""
        if symbol not in self.market_data:
            return 0.0
        try:
            # 確保傳入的 date 與 index 格式一致 (Normalized)
            price = self.market_data[symbol]['Close'].asof(date)
            if pd.isna(price):
                # 嘗試取最後一筆
                return self.market_data[symbol]['Close'].iloc[-1]
            return price
        except:
            return 0.0
    
    def get_split_ratio(self, symbol, date):
        """檢查當日是否有拆股"""
        if symbol not in self.market_data:
            return 1.0
        
        actions = self.market_data[symbol]
        # 直接使用 index 查找，因已 normalize，匹配率大幅提升
        if date in actions.index and 'Stock Splits' in actions.columns:
            split = actions.loc[date]['Stock Splits']
            # yfinance 的 split 有時會回傳 Series (如果當天有多筆資料)，需轉為 float
            if isinstance(split, pd.Series):
                split = split.iloc[0]
                
            if split > 0 and split != 1:
                return float(split)
        return 1.0
