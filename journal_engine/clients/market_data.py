import pandas as pd
import yfinance as yf
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)
        
        # 手動拆股清單 (Ex-Date, Ratio)
        self.manual_splits = {
            'NVDA': {'2024-06-10': 10.0},
            'GOOGL': {'2022-07-18': 20.0},
            'AMZN': {'2022-06-06': 20.0},
            'TSLA': {'2022-08-25': 3.0},
        }

    def download_data(self, tickers: list, start_date):
        print(f"正在下載市場數據，起始日期: {start_date}...")
        
        # 1. 下載匯率
        try:
            fx = yf.Ticker(EXCHANGE_SYMBOL)
            fx_hist = fx.history(start=start_date - timedelta(days=5))
            if not fx_hist.empty:
                fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
                self.fx_rates = fx_hist['Close'].resample('D').ffill()
            else:
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
        except:
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

        # 2. 下載個股數據
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))
        
        for t in all_tickers:
            try:
                ticker_obj = yf.Ticker(t)
                # auto_adjust=False 確保取得原始價格
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    self.market_data[t] = hist
                    print(f"[{t}] 下載成功 ({len(hist)} 筆)")
                else:
                    print(f"[{t}] 警告: 無歷史數據")
                    
            except Exception as e:
                print(f"[{t}] 下載錯誤: {e}")
        
        return self.market_data, self.fx_rates
    
    def get_price_with_date(self, symbol, date):
        """
        [修改] 同時回傳 (價格, 價格日期)
        以便計算機判斷是否使用了過期價格 (Stale Price)
        """
        if symbol not in self.market_data: return 0.0, date
        
        try:
            df = self.market_data[symbol]
            # 嘗試取得當日資料
            if date in df.index:
                return float(df.loc[date]['Close']), date
            
            # 若無，找最近的過去資料 (asof)
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                price = float(df.iloc[idx]['Close'])
                actual_date = df.index[idx]
                return price, actual_date
            
            return 0.0, date
        except:
            return 0.0, date
    
    def get_price(self, symbol, date):
        """相容舊方法，只回傳價格"""
        p, _ = self.get_price_with_date(symbol, date)
        return p
    
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
        date_str = date.strftime('%Y-%m-%d')
        # 1. 手動清單
        if symbol in self.manual_splits and date_str in self.manual_splits[symbol]:
            return self.manual_splits[symbol][date_str]
        # 2. API 數據
        if symbol in self.market_data:
            try:
                actions = self.market_data[symbol]
                if date in actions.index and 'Stock Splits' in actions.columns:
                    split = actions.loc[date]['Stock Splits']
                    if isinstance(split, pd.Series): split = split.iloc[0]
                    if split > 0 and split != 1: return float(split)
            except: pass
        return 1.0
