import pandas as pd
import yfinance as yf
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)

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
                # 使用 auto_adjust=False 獲取完整數據
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    
                    # 準備數據：使用 Adj Close
                    hist_adj = self._prepare_data(t, hist)
                    
                    self.market_data[t] = hist_adj
                    print(f"[{t}] 下載成功 ({len(hist)} 筆)")
                else:
                    print(f"[{t}] 警告: 無歷史數據")
                    
            except Exception as e:
                print(f"[{t}] 下載錯誤: {e}")
        
        return self.market_data, self.fx_rates

    def _prepare_data(self, symbol, df):
        """
        準備數據：使用 Adj Close（包含拆股+配息調整）
        形成平滑的總回報曲線，消除拆股和配息的斷層
        """
        df = df.copy()
        
        # 使用 Adj Close 作為主要價格（已包含所有調整）
        df['Close_Adjusted'] = df['Adj Close']
        
        # 保留原始 Close 用於參考
        df['Close_Raw'] = df['Close']
        
        # 計算累積拆股因子（用於股數調整）
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0
        
        splits = df['Stock Splits'].replace(0, 1.0)
        
        # 反向累積計算拆股因子
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        
        df['Split_Factor'] = cum_splits.shift(-1).fillna(1.0)
        
        # 計算配息調整因子（Adj Close / Close）
        # 這個因子反映了配息對價格的累積影響
        df['Dividend_Adj_Factor'] = df['Adj Close'] / df['Close']
        
        return df

    def get_price(self, symbol, date):
        """
        回傳調整後的價格（來自 Adj Close）
        這個價格已經包含拆股和配息的所有調整
        """
        if symbol not in self.market_data:
            return 0.0
        
        try:
            df = self.market_data[symbol]
            
            # 優先查表
            if date in df.index:
                return float(df.loc[date, 'Close_Adjusted'])
            
            # 查不到則向前填補
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Close_Adjusted'])
            
            return 0.0
        except:
            return 0.0

    def get_transaction_multiplier(self, symbol, date):
        """
        取得交易日的拆股復權因子
        用來將「原始交易股數」轉換為「當前等價股數」
        """
        if symbol not in self.market_data:
            return 1.0
        
        try:
            df = self.market_data[symbol]
            
            if date in df.index:
                return float(df.loc[date, 'Split_Factor'])
            
            # 若交易日在數據範圍外（太早），用最早的因子
            if date < df.index.min():
                return float(df.iloc[0]['Split_Factor'])
            
            # 若交易日在未來，用最新的因子
            return float(df.iloc[-1]['Split_Factor'])
        except:
            return 1.0

    def get_dividend_adjustment_factor(self, symbol, date):
        """
        取得配息調整因子
        用於將交易價格調整到 Adj Close 的基準
        這樣買入成本就會對應到總回報價格體系
        """
        if symbol not in self.market_data:
            return 1.0
        
        try:
            df = self.market_data[symbol]
            
            if date in df.index:
                return float(df.loc[date, 'Dividend_Adj_Factor'])
            
            # 向前填補
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Dividend_Adj_Factor'])
            
            return 1.0
        except:
            return 1.0
    
    def get_dividend(self, symbol, date):
        """
        獲取除息日的每股配息金額
        用於配息明細記錄（非市值計算）
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
