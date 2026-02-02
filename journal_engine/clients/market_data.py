import pandas as pd
import yfinance as yf
import concurrent.futures
import pytz
from dataclasses import dataclass
from datetime import datetime, timedelta, time
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE
from .auto_price_selector import AutoPriceSelector


@dataclass
class RealtimeQuote:
    symbol: str
    price: float
    timestamp: pd.Timestamp
    market_date: pd.Timestamp  # normalized date in market tz
    source: str


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
        - market_data: 存儲所有股票的歷史價格數據 (EOD / daily bars)
        - fx_rates: 存儲匯率歷史數據（USD/TWD, daily series)
        - realtime_quotes: 盤中/即時報價（不覆蓋日線收盤）
        - realtime_fx_rate: [兼容舊版] 即時匯率（由 realtime_quotes[EXCHANGE_SYMBOL] 同步）
        """
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)
        self.realtime_quotes: dict[str, RealtimeQuote] = {}
        self.realtime_fx_rate = None

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

    def _is_us_market_hours(self) -> bool:
        """判斷目前是否為美股交易時間（美東 09:30-16:00）。"""
        try:
            us_tz = pytz.timezone('US/Eastern')
            now_us = datetime.now(us_tz)
            if now_us.weekday() >= 5:
                return False
            return time(9, 30) <= now_us.time() <= time(16, 0)
        except Exception as e:
            print(f"[美股時間判斷] 錯誤: {e}")
            return False

    def _should_use_realtime(self, symbol: str) -> bool:
        """是否應使用即時報價（僅在該市場盤中）。"""
        symbol = (symbol or '').upper()
        if symbol == (EXCHANGE_SYMBOL or '').upper() or '=' in symbol:
            # FX 視為跟著程式跑盤中刷新即可（不強制 24/5 判斷）
            return self._is_taiwan_market_hours() or self._is_us_market_hours()
        if self._is_taiwan_stock(symbol):
            return self._is_taiwan_market_hours()
        return self._is_us_market_hours()

    def _market_tz_for_symbol(self, symbol: str):
        symbol = (symbol or '').upper()
        if symbol == (EXCHANGE_SYMBOL or '').upper() or '=' in symbol:
            return pytz.timezone('Asia/Taipei')
        if self._is_taiwan_stock(symbol):
            return pytz.timezone('Asia/Taipei')
        return pytz.timezone('America/New_York')

    def _fetch_intraday_prices_batch(self, symbols: list[str], market_tz, name: str = "Intraday Batch") -> dict[str, RealtimeQuote]:
        """批量抓取盤中最後價（1m），並只保留『市場當日』的最新價。

        Note: 不覆蓋日線 EOD，只寫入 realtime_quotes。
        """
        symbols = [s for s in (symbols or []) if s]
        if not symbols:
            return {}

        def yf_intraday_func():
            return yf.download(
                tickers=symbols,
                period="2d",
                interval="1m",
                progress=False,
                auto_adjust=False,
                back_adjust=False,
                threads=False,
            )

        try:
            data = yf_intraday_func()
        except Exception as e:
            print(f"[{name}] ⚠️ yfinance intraday download failed: {e}")
            return {}

        if data is None or data.empty:
            print(f"[{name}] ⚠️ yfinance 沒有回傳任何盤中數據")
            return {}

        # yfinance commonly returns MultiIndex columns: (Field, Ticker)
        if isinstance(data.columns, pd.MultiIndex):
            try:
                data.columns = data.columns.set_levels([lvl.upper() for lvl in data.columns.levels[1]], level=1)
                data.columns = data.columns.swaplevel(0, 1)  # => (Ticker, Field)
            except Exception:
                pass

        out: dict[str, RealtimeQuote] = {}
        today_market = datetime.now(market_tz).date()

        for sym_orig in symbols:
            sym = sym_orig.upper()
            try:
                sym_df = data[sym] if isinstance(data.columns, pd.MultiIndex) else data
                if not isinstance(sym_df, pd.DataFrame) or sym_df.empty:
                    continue

                closes = sym_df.get('Close')
                if closes is None:
                    continue

                closes = closes.dropna()
                if closes.empty:
                    continue

                last_price = float(closes.iloc[-1])
                last_ts = closes.index[-1]

                # Ensure tz-aware timestamp
                if getattr(last_ts, 'tzinfo', None) is None:
                    # yfinance sometimes returns naive; assume UTC as safest
                    last_ts = pd.Timestamp(last_ts).tz_localize('UTC')
                else:
                    last_ts = pd.Timestamp(last_ts)

                market_date = last_ts.tz_convert(market_tz).date()
                if market_date != today_market:
                    continue

                out[sym] = RealtimeQuote(
                    symbol=sym,
                    price=last_price,
                    timestamp=last_ts,
                    market_date=pd.Timestamp(market_date),
                    source='yf.download-1m',
                )
            except Exception:
                continue

        return out

    def _fetch_fx_realtime_fallback(self) -> RealtimeQuote | None:
        """FX 專用 fallback：當 batch 取不到 EXCHANGE_SYMBOL 時，單獨以更高成功率方式嘗試。

        Order:
        1) fast_info
        2) history(period=1d, interval=1m)

        Note:
        - 僅用於 FX；避免對所有股票退回逐檔查詢。
        """
        sym = (EXCHANGE_SYMBOL or '').upper()
        if not sym:
            return None

        taipei_tz = pytz.timezone('Asia/Taipei')
        now_utc = pd.Timestamp.utcnow().tz_localize('UTC')
        today_tw = pd.Timestamp(datetime.now(taipei_tz).date())

        try:
            fx = yf.Ticker(sym)
        except Exception:
            return None

        # 1) fast_info
        try:
            info = fx.fast_info
            raw = info.get('last_price') or info.get('regular_market_price') or info.get('regularMarketPrice')
            if raw:
                p = self._normalize_twd_per_usd(float(raw))
                if p and p > 0:
                    return RealtimeQuote(
                        symbol=sym,
                        price=float(p),
                        timestamp=now_utc,
                        market_date=today_tw,
                        source='fx.fast_info',
                    )
        except Exception:
            pass

        # 2) 1m history
        try:
            intraday = fx.history(period="1d", interval="1m")
            if intraday is not None and (not intraday.empty) and 'Close' in intraday.columns:
                closes = intraday['Close'].dropna()
                if not closes.empty:
                    last_price = self._normalize_twd_per_usd(float(closes.iloc[-1]))
                    last_ts = closes.index[-1]
                    if getattr(last_ts, 'tzinfo', None) is None:
                        last_ts = pd.Timestamp(last_ts).tz_localize('UTC')
                    else:
                        last_ts = pd.Timestamp(last_ts)
                    market_date = last_ts.tz_convert(taipei_tz).date()
                    return RealtimeQuote(
                        symbol=sym,
                        price=float(last_price),
                        timestamp=last_ts,
                        market_date=pd.Timestamp(market_date),
                        source='fx.history-1m',
                    )
        except Exception:
            pass

        return None

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

    def _upsert_daily_row_with_price(self, hist: pd.DataFrame, target_date: pd.Timestamp, latest_price: float, symbol: str) -> pd.DataFrame:
        """[Deprecated] 舊版：將盤中價寫入日線 row。

        v2.55 起改為「即時報價與日線收盤分離」：盤中價存入 realtime_quotes，不覆蓋 EOD。
        保留此函式避免舊版本呼叫崩潰。
        """
        try:
            if hist is None or hist.empty:
                return hist

            d = pd.to_datetime(target_date).tz_localize(None).normalize()

            if d not in hist.index:
                template = hist.iloc[-1].copy()
                template.name = d
                if 'Dividends' in template.index:
                    template['Dividends'] = 0.0
                if 'Stock Splits' in template.index:
                    template['Stock Splits'] = 0.0

                hist = pd.concat([hist, template.to_frame().T], axis=0)
                hist = hist[~hist.index.duplicated(keep='last')].sort_index()

            hist.at[d, 'Close'] = latest_price
            if 'Adj Close' in hist.columns:
                hist.at[d, 'Adj Close'] = latest_price

            print(f"[{symbol}] ✅ (Deprecated) 寫入盤中價到日線: date={d.date()} price={latest_price:.2f}")
            return hist
        except Exception as e:
            print(f"[{symbol}] ⚠️ upsert 日線資料失敗: {e}")
            return hist

    def download_data(self, tickers: list, start_date):
        """下載市場數據（股票價格 + 匯率）。"""
        print(f"正在下載市場數據，起始日期: {start_date}...")

        is_tw_trading = self._is_taiwan_market_hours()
        is_us_trading = self._is_us_market_hours()

        if is_tw_trading:
            print("✅ 目前為台股交易時間，將更新台股即時報價")
        if is_us_trading:
            print("✅ 目前為美股交易時間，將更新美股即時報價")
        if (not is_tw_trading) and (not is_us_trading):
            print("⚠️ 非台股/美股交易時間，將僅使用日線收盤資料")

        # ==================== 1. 下載匯率日線（EOD） ====================
        try:
            fx = yf.Ticker(EXCHANGE_SYMBOL)
            fx_hist = fx.history(start=start_date - timedelta(days=5))

            if not fx_hist.empty:
                fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
                self.fx_rates = fx_hist['Close'].resample('D').ffill().apply(self._normalize_twd_per_usd)
            else:
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
        except Exception as e:
            print(f"[FX] 匯率下載嚴重錯誤: {e}")
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

        # ==================== 2. 盤中即時報價（RT，不覆蓋日線） ====================
        try:
            all_tickers = list(set([t for t in (tickers or []) if t] + ['SPY']))
            tw_symbols = [t for t in all_tickers if self._is_taiwan_stock((t or '').upper())]
            us_symbols = [t for t in all_tickers if (t and not self._is_taiwan_stock((t or '').upper()))]

            # FX quote：只要程式在盤中跑（TW 或 US），就一起抓一份 RT
            fx_symbols = [EXCHANGE_SYMBOL] if (is_tw_trading or is_us_trading) else []

            # TW batch
            if is_tw_trading and (tw_symbols or fx_symbols):
                tw_tz = pytz.timezone('Asia/Taipei')
                q_tw = self._fetch_intraday_prices_batch(list(set(tw_symbols + fx_symbols)), tw_tz, name='TW Intraday')
                for k, v in q_tw.items():
                    self.realtime_quotes[k] = v

            # US batch
            if is_us_trading and (us_symbols or fx_symbols):
                us_tz = pytz.timezone('America/New_York')
                q_us = self._fetch_intraday_prices_batch(list(set(us_symbols + fx_symbols)), us_tz, name='US Intraday')
                # FX 可能在兩邊都抓到，取 timestamp 較新的
                for k, v in q_us.items():
                    old = self.realtime_quotes.get(k)
                    if (old is None) or (v.timestamp > old.timestamp):
                        self.realtime_quotes[k] = v

            # RT summary log
            try:
                keys = sorted(list(self.realtime_quotes.keys()))
                preview = ', '.join(keys[:10])
                more = f" (+{len(keys) - 10} more)" if len(keys) > 10 else ""
                print(f"[RT] ✅ realtime_quotes={len(keys)} symbols: {preview}{more}")
            except Exception:
                print(f"[RT] ✅ realtime_quotes={len(self.realtime_quotes)}")

            # FX fallback + 同步 realtime_fx_rate（兼容 calculator 舊用法）
            fx_sym = (EXCHANGE_SYMBOL or '').upper()
            fx_q = self.realtime_quotes.get(fx_sym)
            if (fx_q is None) and (is_tw_trading or is_us_trading):
                fx_fb = self._fetch_fx_realtime_fallback()
                if fx_fb and fx_fb.price and fx_fb.price > 0:
                    self.realtime_quotes[fx_sym] = fx_fb
                    fx_q = fx_fb
                    print(f"[FX] ✅ 即時匯率 fallback 成功: source={fx_fb.source}")

            if fx_q and fx_q.price and fx_q.price > 0:
                self.realtime_fx_rate = self._normalize_twd_per_usd(fx_q.price)
                ts = fx_q.timestamp
                ts_str = str(ts) if ts is not None else "unknown"
                print(f"[FX] ✅ 已獲取即時匯率: {self.realtime_fx_rate:.4f} (source={fx_q.source}, ts={ts_str})")
            else:
                self.realtime_fx_rate = None
                print("[FX] ⚠️ 無法獲取即時匯率，後續計算將依賴歷史收盤")

        except Exception as e:
            print(f"[RT] ⚠️ 即時報價批量抓取失敗: {e}")

        # ==================== 3. 下載個股日線（EOD / daily bars） ====================
        all_tickers = list(set([t for t in (tickers or []) if t] + ['SPY']))

        def fetch_single_ticker(t):
            try:
                ticker_obj = yf.Ticker(t)
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)

                if not hist.empty:
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
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
        """取得指定日期的估值價格。

        - 盤中（該市場開盤且 date 為市場當日）：優先回傳 realtime_quotes
        - 其他情境：回傳日線收盤（Close_Adjusted）並 pad
        """
        if not symbol:
            return 0.0

        sym = symbol.upper()
        dt = pd.to_datetime(date).tz_localize(None).normalize()

        # Realtime path
        try:
            if self._should_use_realtime(sym):
                q = self.realtime_quotes.get(sym)
                if q and q.market_date is not None:
                    qd = pd.to_datetime(q.market_date).tz_localize(None).normalize()
                    if q.price and q.price > 0 and qd == dt:
                        return float(q.price)
        except Exception:
            pass

        # EOD path
        if sym not in self.market_data:
            return 0.0

        try:
            df = self.market_data[sym]
            if dt in df.index:
                return float(df.loc[dt, 'Close_Adjusted'])

            idx = df.index.get_indexer([dt], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Close_Adjusted'])

            return 0.0
        except Exception:
            return 0.0

    def get_price_asof(self, symbol, date):
        """取得指定日期的價格，並回傳實際使用的交易日 (as-of/pad)。

        - 若該市場盤中且有 realtime quote（且 quote date == date）：回 (RT price, date)
        - 否則回 (EOD close, used_trading_date)
        """
        dt = pd.to_datetime(date).tz_localize(None).normalize()
        if not symbol:
            return 0.0, dt

        sym = symbol.upper()

        # Realtime path
        try:
            if self._should_use_realtime(sym):
                q = self.realtime_quotes.get(sym)
                if q and q.market_date is not None:
                    qd = pd.to_datetime(q.market_date).tz_localize(None).normalize()
                    if q.price and q.price > 0 and qd == dt:
                        return float(q.price), dt
        except Exception:
            pass

        # EOD path
        if sym not in self.market_data:
            return 0.0, dt

        try:
            df = self.market_data[sym]

            if dt in df.index:
                return float(df.loc[dt, 'Close_Adjusted']), dt

            idx = df.index.get_indexer([dt], method='pad')[0]
            if idx != -1:
                used = df.index[idx]
                return float(df.iloc[idx]['Close_Adjusted']), used

            return 0.0, dt
        except Exception:
            return 0.0, dt

    def get_prev_trading_date(self, symbol, used_date):
        """回傳 used_date 的上一個可用交易日 (依該標的資料 index)。

        Important:
        - 若 used_date 不在 index（常見：盤中使用 today + realtime quote），上一交易日應為 pad 後的那一天（昨日收盤）。
        - 若 used_date 在 index，才回傳 index 的前一格。
        """
        try:
            sym = (symbol or '').upper()
            df = self.market_data.get(sym)
            dt = pd.to_datetime(used_date).tz_localize(None).normalize()

            if df is None or df.empty:
                return dt

            if dt not in df.index:
                idx = df.index.get_indexer([dt], method='pad')[0]
                if idx == -1:
                    return dt
                # dt is "today" (realtime), prev trading date should be the padded date itself
                return df.index[idx]

            idx = df.index.get_indexer([dt])[0]
            if idx <= 0:
                return dt
            return df.index[idx - 1]
        except Exception:
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
        except Exception:
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
        except Exception:
            pass

        return 0.0
