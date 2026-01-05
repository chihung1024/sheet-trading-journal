import pandas as pd
import yfinance as yf
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)
        
        # [參照 portfolio-journal 架構] 
        # 建立手動事件庫，模擬資料庫中的 Splits Table。
        # 這是最穩健的解法，解決 API 資料缺漏問題。
        self.manual_splits = {
            'NVDA': {'2024-06-10': 10.0}, # NVDA 10拆1 (Ex-Date)
            'GOOGL': {'2022-07-18': 20.0},
            'AMZN': {'2022-06-06': 20.0},
            'TSLA': {'2022-08-25': 3.0},
        }

    def download_data(self, tickers: list, start_date):
        """
        下載股價、匯率、配息與拆股資訊
        """
        print(f"正在下載市場數據，起始日期: {start_date}...")
        
        # 1. 下載匯率 (USD -> TWD)
        try:
            fx = yf.Ticker(EXCHANGE_SYMBOL)
            fx_hist = fx.history(start=start_date - timedelta(days=5))
            if not fx_hist.empty:
                # 正規化時間至午夜，確保對齊
                fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
                self.fx_rates = fx_hist['Close']
                print(f"匯率下載成功，最新匯率: {self.fx_rates.iloc[-1]:.2f}")
            else:
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
        except Exception as e:
            print(f"匯率下載失敗: {e}，使用預設匯率")
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

        # 2. 下載個股數據
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))
        
        for t in all_tickers:
            try:
                ticker_obj = yf.Ticker(t)
                # auto_adjust=False 取得原始股價 (Raw Price)
                # actions=True 包含 Dividends 與 Splits
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    self.market_data[t] = hist
                    print(f"[{t}] 數據下載成功 ({len(hist)} 筆)")
                else:
                    print(f"[{t}] 警告: 無法取得歷史數據")
                    
            except Exception as e:
                print(f"[{t}] 下載發生錯誤: {e}")
        
        return self.market_data, self.fx_rates
    
    def get_price(self, symbol, date):
        """取得特定日期的收盤價"""
        if symbol not in self.market_data: return 0.0
        try:
            price = self.market_data[symbol]['Close'].asof(date)
            return self.market_data[symbol]['Close'].iloc[-1] if pd.isna(price) else price
        except: return 0.0
    
    def get_dividend(self, symbol, date):
        """[新增] 查詢當日是否有股息 (Market Data)"""
        if symbol not in self.market_data: return 0.0
        try:
            actions = self.market_data[symbol]
            if date in actions.index and 'Dividends' in actions.columns:
                div = actions.loc[date]['Dividends']
                return float(div.iloc[0]) if isinstance(div, pd.Series) else float(div)
        except: pass
        return 0.0

    def get_split_ratio(self, symbol, date):
        """
        檢查當日是否有拆股
        邏輯：優先使用 Manual Splits，其次使用 Market Data
        """
        # 1. 檢查手動清單 (比對字串日期)
        date_str = date.strftime('%Y-%m-%d')
        if symbol in self.manual_splits and date_str in self.manual_splits[symbol]:
            ratio = self.manual_splits[symbol][date_str]
            print(f"★ [{symbol}] 觸發手動拆股修正: {date_str} -> {ratio}倍")
            return ratio

        # 2. 檢查 API 數據
        if symbol not in self.market_data: return 1.0
        
        actions = self.market_data[symbol]
        if date in actions.index and 'Stock Splits' in actions.columns:
            split = actions.loc[date]['Stock Splits']
            if isinstance(split, pd.Series): split = split.iloc[0]
            if split > 0 and split != 1:
                return float(split)
                
        return 1.0
