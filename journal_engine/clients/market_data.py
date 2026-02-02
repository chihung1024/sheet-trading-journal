import pandas as pd
import yfinance as yf
import concurrent.futures
import pytz
from datetime import datetime, timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE
from .auto_price_selector import AutoPriceSelector

class MarketDataClient:
    @staticmethod
    def _normalize_twd_per_usd(rate: float) -> float:
        """Normalize FX to 'TWD per 1 USD'.

        Defensive guard: some data sources (or transforms) may return the inverse
        (USD per 1 TWD), which is typically < 1.0.
        """
        try:
            r = float(rate)
            if r <= 0:
                return DEFAULT_FX_RATE
            return (1.0 / r) if r < 1.0 else r
        except Exception:
            return DEFAULT_FX_RATE

    def __init__(self):
        """
        初始化市場數據客戶端
        - market_data: 存儲所有股票的歷史價格數據
        - fx_rates: 存儲匯率數據（USD/TWD）
        - realtime_fx_rate: [v2.52] 存儲即時匯率，與歷史數據分離
        """
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)
        self.realtime_fx_rate = None  # [v2.52] 新增獨立的即時匯率存儲

    def _is_taiwan_stock(self, symbol: str) -> bool:
        """判斷是否為台股標的。"""
        return symbol.endswith('.TW') or symbol.endswith('.TWO')

    def _is_taiwan_market_hours(self) -> bool:
        """判斷目前是否為台股交易時間（台北時間 09:00-13:30）。"""
        try:
            taiwan_tz = pytz.timezone('Asia/Taipei')
            now = datetime.now(taiwan_tz)
            
            # 週末不交易
            if now.weekday() >= 5:  # Saturday=5, Sunday=6
                return False
            
            hour = now.hour
            minute = now.minute
            
            # 交易時間: 09:00-13:30
            if hour == 9 and minute >= 0:
                return True
            elif 10 <= hour <= 12:
                return True
            elif hour == 13 and minute <= 30:
                return True
            
            return False
        except Exception as e:
            print(f"[台股時間判斷] 錯誤: {e}")
            return False

    def _fetch_taiwan_realtime_price(self, ticker_obj, symbol: str) -> float:
        """專用於台股的即時報價獲取，多種方法嘗試。
        
        Returns:
            float: 即時價格，失敗則返回 None
        """
        latest_price = None
        
        # 方法1: 嘗試 fast_info
        try:
            info = ticker_obj.fast_info
            current_price = info.get('last_price') or info.get('regularMarketPrice') or info.get('regular_market_price')
            if current_price and current_price > 0:
                latest_price = float(current_price)
                print(f"[{symbol}] ✅ fast_info 獲取即時價: {latest_price:.2f}")
                return latest_price
        except Exception as e:
            print(f"[{symbol}] fast_info 失敗: {e}")
        
        # 方法2: 嘗試 1分鐘K線（最近 1天）
        try:
            intraday = ticker_obj.history(period="1d", interval="1m")
            if not intraday.empty:
                latest_price = float(intraday['Close'].iloc[-1])
                print(f"[{symbol}] ✅ 1m K線獲取即時價: {latest_price:.2f}")
                return latest_price
        except Exception as e:
            print(f"[{symbol}] 1m K線失敗: {e}")
        
        # 方法3: 嘗試 5分鐘K線
        try:
            intraday_5m = ticker_obj.history(period="1d", interval="5m")
            if not intraday_5m.empty:
                latest_price = float(intraday_5m['Close'].iloc[-1])
                print(f"[{symbol}] ✅ 5m K線獲取即時價: {latest_price:.2f}")
                return latest_price
        except Exception as e:
            print(f"[{symbol}] 5m K線失敗: {e}")
        
        print(f"[{symbol}] ⚠️ 無法獲取即時報價")
        return None

    def download_data(self, tickers: list, start_date):
        """下載市場數據（股票價格 + 匯率）。"""
        print(f"正在下載市場數據，起始日期: {start_date}...")
        
        # 判斷是否為台股交易時間
        is_tw_trading = self._is_taiwan_market_hours()
        if is_tw_trading:
            print("✅ 目前為台股交易時間，將加強台股即時報價獲取")
        else:
            print("⚠️ 非台股交易時間，台股將使用昨日收盤價")

        # ==================== 1. 下載匯率數據 ====================
        try:
            fx = yf.Ticker(EXCHANGE_SYMBOL)
            fx_hist = fx.history(start=start_date - timedelta(days=5))

            if not fx_hist.empty:
                fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
                self.fx_rates = fx_hist['Close'].resample('D').ffill().apply(self._normalize_twd_per_usd)

                # 即時匯率（獨立存放）
                try:
                    print("[FX] 正在獲取即時匯率...")
                    latest_rate = None

                    try:
                        raw_price = fx.fast_info.get('last_price') or fx.fast_info.get('regular_market_price')
                        if raw_price:
                            latest_rate = self._normalize_twd_per_usd(float(raw_price))
                            print(f"[FX] 使用 fast_info 獲取: {latest_rate:.4f}")
                    except Exception:
                        pass

                    if latest_rate is None:
                        realtime_data = fx.history(period="1d", interval="1m")
                        if not realtime_data.empty:
                            latest_rate = self._normalize_twd_per_usd(float(realtime_data['Close'].iloc[-1]))
                            print(f"[FX] 使用 1m K線 獲取: {latest_rate:.4f}")

                    if latest_rate is not None:
                        self.realtime_fx_rate = latest_rate
                        print(f"[FX] ✅ 已獲取即時匯率: {latest_rate:.4f} (存儲於 realtime_fx_rate)")
                    else:
                        print("[FX] ⚠️ 無法獲取即時數據，後續計算將依賴歷史收盤")

                except Exception as e:
                    print(f"[FX] ⚠️ 即時匯率抓取失敗: {e}")

            else:
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
        except Exception as e:
            print(f"[FX] 匯率下載嚴重錯誤: {e}")
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

        # ==================== 2. 下載個股數據 (平行化) ====================
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))

        def fetch_single_ticker(t):
            try:
                ticker_obj = yf.Ticker(t)
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)

                if not hist.empty:
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()

                    # 盤中即時價覆蓋最後一筆日線
                    last_date = hist.index[-1]
                    is_taiwan = self._is_taiwan_stock(t)
                    
                    if is_taiwan:
                        # 台股：只在交易時間才嘗試獲取即時價
                        if is_tw_trading:
                            latest_price = self._fetch_taiwan_realtime_price(ticker_obj, t)
                            if latest_price:
                                hist.at[last_date, 'Close'] = latest_price
                                if 'Adj Close' in hist.columns:
                                    hist.at[last_date, 'Adj Close'] = latest_price
                                print(f"[{t}] ✅ 台股盤中價覆蓋: {latest_price:.2f}")
                        else:
                            print(f"[{t}] ⚠️ 非交易時間，使用昨日收盤價")
                    else:
                        # 美股或其他市場：照舊邏輯嘗試 1m K線
                        try:
                            intraday = ticker_obj.history(period="1d", interval="1m")
                            if not intraday.empty:
                                latest_price = float(intraday['Close'].iloc[-1])
                                hist.at[last_date, 'Close'] = latest_price
                                if 'Adj Close' in hist.columns:
                                    hist.at[last_date, 'Adj Close'] = latest_price
                                print(f"[{t}] ✅ 即時報價覆蓋: {latest_price:.2f}")
                        except Exception as e:
                            print(f"[{t}] 即時價獲取失敗: {e}")

                    hist_adj = self._prepare_data(t, hist)
                    return t, hist_adj

                print(f"[{t}] 警告: 無歷史數據")
                return t, None

            except Exception as e:
                print(f"[{t}] 下載錯誤: {e}")
                return t, None

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_ticker = {executor.submit(fetch_single_ticker, t): t for t in all_tickers}
            for future in concurrent.futures.as_completed(future_to_ticker):
                result = future.result()
                if result:
                    ticker, data = result
                    if data is not None:
                        self.market_data[ticker] = data
                        print(f"[{ticker}] 下載成功")

        return self.market_data, self.fx_rates

    def _prepare_data(self, symbol, df):
        """準備股票數據（方案 A）：

        - 估值價格一律使用 Close（split-adjusted price return）。
        - 配息不做價格復權，配息效果由 DIV 記錄或市場配息偵測入帳。
        """
        df = df.copy()

        selector = AutoPriceSelector(symbol, df)
        df['Close_Adjusted'] = selector.get_adjusted_price_series()

        metadata = selector.get_metadata()
        print(f"[{symbol}] 價格來源: {metadata['price_source']} - {metadata['selection_reason']}")

        df['Close_Raw'] = df['Close'] if 'Close' in df.columns else df.get('Close_Adjusted')

        # ==================== 計算累積拆股因子 ====================
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0

        splits = df['Stock Splits'].replace(0, 1.0)
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        df['Split_Factor'] = cum_splits.shift(-1).fillna(1.0)

        # ==================== 方案 A：不做配息價格復權 ====================
        df['Dividend_Adj_Factor'] = 1.0

        return df

    def get_price(self, symbol, date):
        """取得指定日期的股票價格（方案 A：Close_Adjusted=Close）。"""
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

    def get_price_asof(self, symbol, date):
        """取得指定日期的股票價格，並回傳實際使用的交易日 (as-of/pad)。"""
        if symbol not in self.market_data:
            dt = pd.to_datetime(date).tz_localize(None).normalize()
            return 0.0, dt

        try:
            df = self.market_data[symbol]
            dt = pd.to_datetime(date).tz_localize(None).normalize()

            if dt in df.index:
                return float(df.loc[dt, 'Close_Adjusted']), dt

            idx = df.index.get_indexer([dt], method='pad')[0]
            if idx != -1:
                used = df.index[idx]
                return float(df.iloc[idx]['Close_Adjusted']), used

            return 0.0, dt
        except:
            dt = pd.to_datetime(date).tz_localize(None).normalize()
            return 0.0, dt

    def get_prev_trading_date(self, symbol, used_date):
        """回傳 used_date 的上一個可用交易日 (依該標的資料 index)。"""
        try:
            if symbol not in self.market_data:
                return pd.to_datetime(used_date).tz_localize(None).normalize()

            df = self.market_data[symbol]
            dt = pd.to_datetime(used_date).tz_localize(None).normalize()

            if dt not in df.index:
                idx = df.index.get_indexer([dt], method='pad')[0]
                if idx == -1:
                    return dt
                dt = df.index[idx]

            idx = df.index.get_indexer([dt])[0]
            if idx <= 0:
                return dt
            return df.index[idx - 1]
        except:
            return pd.to_datetime(used_date).tz_localize(None).normalize()

    def get_transaction_multiplier(self, symbol, date):
        """取得交易日的拆股復權因子。"""
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
        """取得配息調整因子（方案 A：永遠為 1）。"""
        return 1.0

    def get_dividend(self, symbol, date):
        """取得指定日期的配息金額（每股）。"""
        if symbol not in self.market_data:
            return 0.0

        try:
            df = self.market_data[symbol]
            if date in df.index and 'Dividends' in df.columns:
                return float(df.loc[date, 'Dividends'])
        except:
            pass

        return 0.0
