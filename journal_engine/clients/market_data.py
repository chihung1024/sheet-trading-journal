import pandas as pd
import yfinance as yf
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        """
        初始化市場數據客戶端
        - market_data: 存儲所有股票的歷史價格數據
        - fx_rates: 存儲匯率數據（USD/TWD）
        """
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)

    def download_data(self, tickers: list, start_date):
        """
        下載市場數據（股票價格 + 匯率）
        
        參數:
            tickers: 股票代碼列表（如 ['NVDA', 'QQQI']）
            start_date: 開始日期
        
        返回:
            (market_data, fx_rates) 元組
        """
        print(f"正在下載市場數據，起始日期: {start_date}...")
        
        # ==================== 1. 下載匯率數據 ====================
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

        # ==================== 2. 下載個股數據 ====================
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))
        
        for t in all_tickers:
            try:
                ticker_obj = yf.Ticker(t)
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
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
        準備股票數據：計算各種調整因子
        """
        df = df.copy()
        
        df['Close_Adjusted'] = df['Adj Close']
        df['Close_Raw'] = df['Close']
        
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0
        
        splits = df['Stock Splits'].replace(0, 1.0)
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        df['Split_Factor'] = cum_splits.shift(-1).fillna(1.0)
        
        df['Dividend_Adj_Factor'] = df['Adj Close'] / df['Close']
        
        return df

    def get_price(self, symbol, date):
        """
        取得指定日期的股票價格（使用 Adj Close）
        """
        if symbol not in self.market_data:
            return 0.0
        
        try:
            df = self.market_data[symbol]
            
            if date in df.index:
                return float(df.loc[date, 'Close_Adjusted'])
            
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Close_Adjusted'])
            
            return 0.0
        except:
            return 0.0

    def get_realtime_price(self, symbol):
        """
        ✅ 新增：抽取即時價格（美股盤中使用）
        
        逻輯：
        1. 優先使用 Ticker.info 的即時報價
        2. 如果 API 失敗，使用最新歷史收盤價
        3. 最後 fallback 到 get_price()
        
        參數:
            symbol: 股票代碼
        
        返回:
            即時價格 (float)
        """
        try:
            ticker = yf.Ticker(symbol)
            
            # 策略 1：使用 Ticker.info（最可靠）
            try:
                info = ticker.info
                
                # 優先級 1：regularMarketPrice（盤中價）
                if 'regularMarketPrice' in info and info['regularMarketPrice']:
                    price = float(info['regularMarketPrice'])
                    if price > 0:
                        print(f"[{symbol}] 即時價: ${price:.2f} (regularMarketPrice)")
                        return price
                
                # 優先級 2：currentPrice
                if 'currentPrice' in info and info['currentPrice']:
                    price = float(info['currentPrice'])
                    if price > 0:
                        print(f"[{symbol}] 即時價: ${price:.2f} (currentPrice)")
                        return price
                
                # 優先級 3：previousClose（昨日收盤）
                if 'previousClose' in info and info['previousClose']:
                    price = float(info['previousClose'])
                    if price > 0:
                        print(f"[{symbol}] 使用昨日收盤價: ${price:.2f} (previousClose)")
                        return price
                        
            except Exception as e:
                print(f"[{symbol}] Ticker.info 失敗: {e}")
            
            # 策略 2：使用 history 最新收盤價
            try:
                hist = ticker.history(period='5d', auto_adjust=False)
                if not hist.empty:
                    # 取最新的 Adj Close
                    latest_price = float(hist['Close'].iloc[-1])
                    latest_adj_close = float(hist['Adj Close'].iloc[-1])
                    
                    # 優先使用 Adj Close（與歷史數據一致）
                    if latest_adj_close > 0:
                        print(f"[{symbol}] 最新收盤: ${latest_adj_close:.2f} (Adj Close)")
                        return latest_adj_close
                    elif latest_price > 0:
                        print(f"[{symbol}] 最新收盤: ${latest_price:.2f} (Close)")
                        return latest_price
            except Exception as e:
                print(f"[{symbol}] history 失敗: {e}")
            
            # 策略 3：Fallback 到緩存的歷史數據
            if symbol in self.market_data and not self.market_data[symbol].empty:
                fallback_price = float(self.market_data[symbol].iloc[-1]['Close_Adjusted'])
                print(f"[{symbol}] 使用緩存價格: ${fallback_price:.2f}")
                return fallback_price
            
            # 最後手段
            print(f"[{symbol}] 警告: 無法獲取任何價格")
            return 0.0
            
        except Exception as e:
            print(f"[{symbol}] get_realtime_price 總體錯誤: {e}")
            # 最終 fallback
            return self.get_price(symbol, pd.Timestamp.now())

    def get_transaction_multiplier(self, symbol, date):
        """
        取得交易日的拆股復權因子
        """
        if symbol not in self.market_data:
            return 1.0
        
        try:
            df = self.market_data[symbol]
            
            if date in df.index:
                return float(df.loc[date, 'Split_Factor'])
            
            if date < df.index.min():
                return float(df.iloc[0]['Split_Factor'])
            
            return float(df.iloc[-1]['Split_Factor'])
        except:
            return 1.0

    def get_dividend_adjustment_factor(self, symbol, date):
        """
        取得配息調整因子
        """
        if symbol not in self.market_data:
            return 1.0
        
        try:
            df = self.market_data[symbol]
            
            if date in df.index:
                return float(df.loc[date, 'Dividend_Adj_Factor'])
            
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Dividend_Adj_Factor'])
            
            return 1.0
        except:
            return 1.0

    def get_dividend(self, symbol, date):
        """
        取得指定日期的配息金額（每股）
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