import pandas as pd
import yfinance as yf
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)
        
        # [手動強制拆股清單] 
        # 解決 API 資料延遲或遺漏問題，確保除權日 (Ex-Date) 當天股數正確變動
        self.manual_splits = {
            'NVDA': {'2024-06-10': 10.0}, # NVDA 10拆1
            'GOOGL': {'2022-07-18': 20.0},
            'AMZN': {'2022-06-06': 20.0},
            'TSLA': {'2022-08-25': 3.0},
            # 如果發現其他股票線圖異常，可在此補上
        }

    def download_data(self, tickers: list, start_date):
        print(f"正在下載市場數據，起始日期: {start_date}...")
        
        # 1. 下載匯率
        try:
            fx = yf.Ticker(EXCHANGE_SYMBOL)
            fx_hist = fx.history(start=start_date - timedelta(days=5))
            if not fx_hist.empty:
                fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
                # [Fix] 使用 ffill() 填補假日或缺漏的匯率，避免運算抓不到
                self.fx_rates = fx_hist['Close'].resample('D').ffill()
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
                # auto_adjust=False: 取得原始價格 (Raw Price)，這樣拆股日的股價才會真的掉下來
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    # 正規化日期
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    
                    # [Critical Fix] 這裡做 Resample 和 ffill 是為了修復線圖崩壞的關鍵
                    # 如果除權日(6/10)當天 yfinance 缺資料，系統會用 asof 抓到 6/7 的高價
                    # 導致：股數變成 10 倍 x 股價還是 $1200 = 資產暴增 10 倍
                    # 透過 ffill，我們盡量確保資料連續性，雖然不能無中生有，但能減少對不上的機率
                    full_hist = hist.resample('D').ffill()
                    
                    # 保留 actions (配息/拆股) 資訊 (resample 後會變 NaN，需從原檔補回)
                    # 這裡我們主要需要 Close Price，Actions 我們用手動或原始資料查
                    self.market_data[t] = hist # 存原始資料查 actions
                    self.market_data[f"{t}_filled"] = full_hist # 存填補後資料查價格
                    
                    print(f"[{t}] 數據下載成功 ({len(hist)} 筆)")
                else:
                    print(f"[{t}] 警告: 無法取得歷史數據")
                    
            except Exception as e:
                print(f"[{t}] 下載發生錯誤: {e}")
        
        return self.market_data, self.fx_rates
    
    def get_price(self, symbol, date):
        """取得特定日期的收盤價"""
        key = f"{symbol}_filled"
        source = self.market_data.get(key, self.market_data.get(symbol))
        
        if source is None: return 0.0
        try:
            # 優先嘗試取得當日精確價格
            if date in source.index:
                return float(source.loc[date]['Close'])
            # 若無，則找最近的 (因為已經 ffill 過，這裡誤差會很小)
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
        date_str = date.strftime('%Y-%m-%d')
        # 1. 優先檢查手動清單
        if symbol in self.manual_splits and date_str in self.manual_splits[symbol]:
            ratio = self.manual_splits[symbol][date_str]
            print(f"★ [{symbol}] 觸發手動拆股修正: {date_str} -> {ratio}倍")
            return ratio

        # 2. 檢查 API 數據
        if symbol not in self.market_data: return 1.0
        try:
            actions = self.market_data[symbol]
            if date in actions.index and 'Stock Splits' in actions.columns:
                split = actions.loc[date]['Stock Splits']
                if isinstance(split, pd.Series): split = split.iloc[0]
                if split > 0 and split != 1: return float(split)
        except: pass
        return 1.0
