import pandas as pd
import yfinance as yf
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)
        
        # 手動拆股清單 (格式: Symbol -> Ex-Date -> Ratio)
        # 用於補強 yfinance 可能漏掉的拆股事件
        self.manual_splits = {
            'NVDA': {'2024-06-10': 10.0},
            'GOOGL': {'2022-07-18': 20.0},
            'AMZN': {'2022-06-06': 20.0},
            'TSLA': {'2022-08-25': 3.0},
        }

    def download_data(self, tickers: list, start_date):
        print(f"正在下載市場數據，起始日期: {start_date}...")
        
        # 1. 下載匯率 (匯率通常無拆股問題，簡單處理)
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
                # 我們抓取 Raw Data，然後自己計算復權，這樣最可控
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    
                    # [核心邏輯] 計算復權價格 (Adjusted Price)
                    # 這會產生一條平滑的價格曲線，消除拆股斷層
                    hist_adj = self._calculate_adjusted_prices(t, hist)
                    
                    self.market_data[t] = hist_adj
                    print(f"[{t}] 下載並復權成功 ({len(hist)} 筆)")
                else:
                    print(f"[{t}] 警告: 無歷史數據")
                    
            except Exception as e:
                print(f"[{t}] 下載錯誤: {e}")
        
        return self.market_data, self.fx_rates

    def _calculate_adjusted_prices(self, symbol, df):
        """
        計算「拆股復權」後的價格與因子
        """
        df = df.copy()
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0
            
        # 1. 注入手動拆股資訊
        if symbol in self.manual_splits:
            for date_str, ratio in self.manual_splits[symbol].items():
                date_ts = pd.Timestamp(date_str).normalize()
                if date_ts in df.index:
                    df.loc[date_ts, 'Stock Splits'] = ratio
        
        # 2. 計算累積拆股因子 (Cumulative Split Factor)
        # 我們需要「從今天往回推」的因子。
        # 例如 10:1 拆股，Ex-Date(含)之後的因子是 1，Ex-Date 之前的因子是 10。
        # 價格調整公式: Adj_Price = Raw_Price / Factor
        # 交易量調整公式: Adj_Qty = Raw_Qty * Factor
        
        # 先將 0 轉為 1
        splits = df['Stock Splits'].replace(0, 1.0)
        
        # 這是 "向前累積" (從舊到新)，yfinance 的 split 是發生在 Ex-Date
        # 為了取得 "Back Adjustment Factor"，我們從後往前乘
        # 但 Pandas cumprod 是從前往後。
        # 邏輯：Factor = (Product of all future splits)
        # 例如 2023年買，2024年拆10倍。2023年的 Factor 應該是 10。
        
        # 我們將 split 序列反轉，做 cumprod，再反轉回來
        # Shift(-1) 是因為 Ex-Date 當天的價格已經變小了，不需要除以因子
        # 需要除以因子的是 Ex-Date "前一天" 以前的價格
        
        # 簡單算法：
        # 總拆股倍數 = 所有 split ratio 相乘
        # 每日累積倍數 = 該日之後的所有 split ratio 相乘
        
        # 反向累積乘積
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        
        # Shift(-1) 讓 Ex-Date 當天的因子歸位到前一天開始生效
        # Ex-Date 當天及未來是 1.0 (或未來的拆股倍數)
        # 填補最後一天為 1.0
        adj_factor = cum_splits.shift(-1).fillna(1.0)
        
        df['Split_Factor'] = adj_factor
        df['Close_Adjusted'] = df['Close'] / adj_factor
        
        return df

    def get_price(self, symbol, date):
        """回傳復權後的平滑價格"""
        if symbol not in self.market_data: return 0.0
        try:
            df = self.market_data[symbol]
            # 優先查表
            if date in df.index:
                return float(df.loc[date]['Close_Adjusted'])
            # 查不到則向前填補 (因為曲線已平滑，填補很安全)
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Close_Adjusted'])
            return 0.0
        except: return 0.0

    def get_transaction_multiplier(self, symbol, date):
        """
        取得交易日的復權因子
        用來將「原始股數」轉換為「復權股數」
        """
        if symbol not in self.market_data: return 1.0
        try:
            df = self.market_data[symbol]
            if date in df.index:
                return float(df.loc[date]['Split_Factor'])
            # 若交易日在數據範圍外(例如太早)，用最早的因子
            if date < df.index.min():
                return float(df.iloc[0]['Split_Factor'])
            # 若交易日在數據範圍後(未來)，用最新的因子(通常是1)
            return float(df.iloc[-1]['Split_Factor'])
        except: return 1.0
    
    def get_dividend(self, symbol, date):
        # 股息不需要復權，因為它發的是現金
        if symbol not in self.market_data: return 0.0
        try:
            df = self.market_data[symbol]
            if date in df.index:
                return float(df.loc[date]['Dividends'])
        except: pass
        return 0.0
