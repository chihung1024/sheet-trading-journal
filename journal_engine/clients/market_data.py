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
        print(f"正在下載市場數據 (會計模式: 原始價格 + 拆股復權)...")
        
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
                # [關鍵] auto_adjust=False: 取得原始價格
                # 這樣除息日當天股價會出現真實的下跌缺口 (Gap)
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    
                    # 計算 "僅拆股調整" 的價格
                    hist_adj = self._prepare_data(t, hist)
                    
                    self.market_data[t] = hist_adj
                    print(f"[{t}] 下載並處理成功 ({len(hist)} 筆)")
                else:
                    print(f"[{t}] 警告: 無歷史數據")
                    
            except Exception as e:
                print(f"[{t}] 下載錯誤: {e}")
        
        return self.market_data, self.fx_rates

    def _prepare_data(self, symbol, df):
        """
        準備數據：
        1. 計算拆股因子 (Split_Factor)
        2. 計算僅拆股調整的價格 (Close_Adjusted)
        
        注意：這裡不計算 Dividend_Adj_Factor，保留真實股價下跌，
        讓圖表反映出除息造成的市值減少。
        """
        df = df.copy()
        
        # 1. 整合手動拆股資訊
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0
            
        if symbol in self.manual_splits:
            for date_str, ratio in self.manual_splits[symbol].items():
                date_ts = pd.Timestamp(date_str).normalize()
                if date_ts in df.index:
                    df.loc[date_ts, 'Stock Splits'] = ratio

        # 2. 計算累積拆股因子
        splits = df['Stock Splits'].replace(0, 1.0)
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        
        # Shift(-1) 對齊 Ex-Date
        split_factor = cum_splits.shift(-1).fillna(1.0)
        df['Split_Factor'] = split_factor

        # 3. 計算復權價格 (使用原始 Close)
        # 這是 "現在的股數對應的股價"，但除息日會跌
        df['Close_Adjusted'] = df['Close'] / split_factor
        
        return df

    def get_price(self, symbol, date):
        """回傳 [僅拆股調整] 的價格"""
        if symbol not in self.market_data: return 0.0
        try:
            df = self.market_data[symbol]
            if date in df.index:
                return float(df.loc[date]['Close_Adjusted'])
            
            # 向前填補
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Close_Adjusted'])
            return 0.0
        except: return 0.0

    def get_transaction_multiplier(self, symbol, date):
        """
        取得交易日的拆股復權因子
        必須使用向前/向後填補，防止交易日是非交易日導致查不到
        """
        if symbol not in self.market_data: return 1.0
        
        try:
            df = self.market_data[symbol]
            
            # 優先精確查找
            if date in df.index:
                return float(df.loc[date, 'Split_Factor'])
                
            # 查不到時，使用最近的 "未來" 因子還是 "過去" 因子？
            # Split Factor 是 "從該日往後的累積拆股倍數"。
            # 如果我在週六買，應該用週五的因子還是週一的？
            # 應該用 "該日期所處區間" 的因子。
            # 使用 method='pad' (ffill) 向前查找最近的過去交易日
            
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Split_Factor'])
                
            # 如果日期太早 (在數據開始前)，假設因子與第一天相同
            if date < df.index.min():
                return float(df.iloc[0]['Split_Factor'])
                
            return 1.0
        except:
            return 1.0
    
    def get_dividend(self, symbol, date):
        """獲取原始配息 (Raw Dividend)"""
        if symbol not in self.market_data: return 0.0
        try:
            df = self.market_data[symbol]
            if date in df.index:
                return float(df.loc[date]['Dividends'])
        except: pass
        return 0.0
