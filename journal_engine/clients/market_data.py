import pandas as pd
import yfinance as yf
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)
        # [Fix] 新增: 專門儲存拆股資訊的字典，比 history['Stock Splits'] 更可靠
        self.splits_map = {}

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
                # 處理匯率時區
                idx = pd.to_datetime(fx_hist.index)
                if idx.tz is not None: idx = idx.tz_localize(None)
                fx_hist.index = idx.normalize()
                
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
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))
        
        for t in all_tickers:
            try:
                ticker_obj = yf.Ticker(t)
                
                # 下載歷史價格 (Raw Price: auto_adjust=False)
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    # 標準化歷史數據的索引
                    idx = pd.to_datetime(hist.index)
                    if idx.tz is not None: idx = idx.tz_localize(None)
                    hist.index = idx.normalize()
                    
                    self.market_data[t] = hist
                    print(f"[{t}] 數據下載成功 ({len(hist)} 筆)")
                    
                    # [Fix] 額外獲取拆股數據 (解決 NVDA 拆股漏失問題)
                    try:
                        splits = ticker_obj.splits
                        if not splits.empty:
                            # 處理拆股數據的時區與格式
                            s_idx = pd.to_datetime(splits.index)
                            if s_idx.tz is not None: s_idx = s_idx.tz_localize(None)
                            splits.index = s_idx.normalize()
                            
                            self.splits_map[t] = splits
                            print(f"[{t}] 額外拆股資訊已載入: {len(splits)} 筆")
                    except Exception as e:
                        print(f"[{t}] 額外拆股資訊獲取失敗 (非致命): {e}")

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
            # 使用 asof 查找最近的價格 (因為 index 已經 normalize，這裡會很準)
            price = self.market_data[symbol]['Close'].asof(date)
            if pd.isna(price):
                return self.market_data[symbol]['Close'].iloc[-1]
            return price
        except:
            return 0.0
    
    def get_split_ratio(self, symbol, date):
        """檢查當日是否有拆股"""
        
        # [Fix Priority 1] 優先檢查 splits_map (最可靠)
        if symbol in self.splits_map:
            s_data = self.splits_map[symbol]
            if date in s_data.index:
                ratio = float(s_data.loc[date])
                if ratio > 0 and ratio != 1:
                    return ratio

        # [Priority 2] 若沒找到，才檢查 history 欄位 (Fallback)
        if symbol in self.market_data:
            actions = self.market_data[symbol]
            if date in actions.index and 'Stock Splits' in actions.columns:
                split = actions.loc[date]['Stock Splits']
                # 處理 Series 格式 (若當天有多筆資料)
                if isinstance(split, pd.Series):
                    split = split.iloc[0]
                    
                if split > 0 and split != 1:
                    return float(split)
        
        return 1.0
