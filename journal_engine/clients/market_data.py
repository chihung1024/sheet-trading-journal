import concurrent.futures
import math
from datetime import datetime, timedelta

import pandas as pd
import pytz
import yfinance as yf

from ..config import DEFAULT_FX_RATE, EXCHANGE_SYMBOL, FX_USD_QUOTE_SYMBOLS
from ..core.currency_detector import CurrencyDetector
from .auto_price_selector import AutoPriceSelector


class MarketDataClient:
    @staticmethod
    def _coerce_twd_per_usd(rate):
        """Strictly coerce Yahoo USD/TWD quote to TWD per 1 USD."""
        try:
            value = float(rate)
            if not math.isfinite(value) or value <= 0:
                return None
            return (1.0 / value) if value < 1.0 else value
        except Exception:
            return None

    @classmethod
    def _normalize_twd_per_usd(cls, rate: float) -> float:
        """Backward-compatible helper for pure callers/tests.

        Production FX ingestion uses the strict coercer and never substitutes the
        default rate into a downloaded series; missing/invalid required FX is
        surfaced by the orchestration gate instead.
        """
        normalized = cls._coerce_twd_per_usd(rate)
        return DEFAULT_FX_RATE if normalized is None else normalized

    @staticmethod
    def _clean_positive_series(series: pd.Series) -> pd.Series:
        values = pd.to_numeric(series, errors='coerce').astype(float)
        valid = values.map(lambda value: math.isfinite(float(value)) and float(value) > 0)
        return values[valid]

    @classmethod
    def _derive_twd_per_native(
        cls,
        twd_per_usd: pd.Series,
        native_per_usd: pd.Series,
    ) -> pd.Series:
        """Derive TWD per native unit from two USD quote series.

        Yahoo `CUR=X` is native units per 1 USD, therefore:
        TWD/native = (TWD/USD) / (native/USD).
        """
        if twd_per_usd.empty or native_per_usd.empty:
            return pd.Series(dtype=float)

        combined_index = twd_per_usd.index.union(native_per_usd.index).sort_values()
        usd_twd = twd_per_usd.reindex(combined_index).ffill()
        native_usd = native_per_usd.reindex(combined_index).ffill()
        derived = usd_twd / native_usd
        return cls._clean_positive_series(derived)

    def __init__(self):
        """Initialize market, USD/TWD compatibility, and currency-aware FX data."""
        self.market_data = {}

        # Backward-compatible USD/TWD fields used by existing snapshot/tests.
        self.fx_rates = pd.Series(dtype=float)
        self.realtime_fx_rate = None

        # Canonical currency-aware context: TWD per 1 native-currency unit.
        self.fx_rates_by_currency = {}
        self.realtime_fx_rates_by_currency = {}

    def _download_fx_history(self, quote_symbol: str, start_date, *, usd_twd=False):
        ticker = yf.Ticker(quote_symbol)
        history = ticker.history(start=start_date - timedelta(days=5))
        if history.empty or 'Close' not in history.columns:
            return pd.Series(dtype=float), ticker

        index = pd.to_datetime(history.index)
        if getattr(index, 'tz', None) is not None:
            index = index.tz_localize(None)
        close = pd.Series(history['Close'].values, index=index.normalize())

        if usd_twd:
            close = close.map(self._coerce_twd_per_usd).dropna().astype(float)
        else:
            close = self._clean_positive_series(close)

        if close.empty:
            return pd.Series(dtype=float), ticker
        return close.resample('D').ffill(), ticker

    @staticmethod
    def _get_realtime_quote(ticker, *, usd_twd=False):
        def normalize(raw):
            try:
                value = float(raw)
                if not math.isfinite(value) or value <= 0:
                    return None
                if usd_twd:
                    return MarketDataClient._coerce_twd_per_usd(value)
                return value
            except Exception:
                return None

        try:
            raw_price = ticker.fast_info.get('last_price') or ticker.fast_info.get('regular_market_price')
            normalized = normalize(raw_price)
            if normalized is not None:
                return normalized
        except Exception:
            pass

        try:
            intraday = ticker.history(period='1d', interval='1m')
            if not intraday.empty and 'Close' in intraday.columns:
                return normalize(intraday['Close'].iloc[-1])
        except Exception:
            pass
        return None

    def _download_currency_fx(self, required_currencies, start_date):
        self.fx_rates = pd.Series(dtype=float)
        self.realtime_fx_rate = None
        self.fx_rates_by_currency = {}
        self.realtime_fx_rates_by_currency = {}

        # USD/TWD is the cross base for every non-TWD currency and remains the
        # compatibility exchange_rate exposed by snapshots.
        try:
            usd_twd_history, usd_twd_ticker = self._download_fx_history(
                EXCHANGE_SYMBOL,
                start_date,
                usd_twd=True,
            )
            if not usd_twd_history.empty:
                self.fx_rates = usd_twd_history
                self.fx_rates_by_currency['USD'] = usd_twd_history
                realtime_usd_twd = self._get_realtime_quote(
                    usd_twd_ticker,
                    usd_twd=True,
                )
                if realtime_usd_twd is not None:
                    self.realtime_fx_rate = realtime_usd_twd
                    self.realtime_fx_rates_by_currency['USD'] = realtime_usd_twd
                    print(f"[FX:USD] 即時 TWD/USD: {realtime_usd_twd:.6f}")
            else:
                print('[FX:USD] 警告: 無可用 USD/TWD 歷史匯率')
        except Exception as exc:
            print(f"[FX:USD] 匯率下載失敗: {exc}")

        foreign_currencies = sorted(
            set(required_currencies) - {'TWD', 'USD'}
        )
        for currency in foreign_currencies:
            quote_symbol = FX_USD_QUOTE_SYMBOLS.get(currency)
            if not quote_symbol:
                print(f"[FX:{currency}] 未設定 Yahoo USD quote symbol")
                continue
            try:
                quote_history, quote_ticker = self._download_fx_history(
                    quote_symbol,
                    start_date,
                    usd_twd=False,
                )
                derived = self._derive_twd_per_native(
                    self.fx_rates,
                    quote_history,
                )
                if derived.empty:
                    print(f"[FX:{currency}] 警告: 無法建立 {currency}/TWD 歷史匯率")
                    continue

                self.fx_rates_by_currency[currency] = derived

                native_per_usd = self._get_realtime_quote(
                    quote_ticker,
                    usd_twd=False,
                )
                if (
                    self.realtime_fx_rate is not None
                    and native_per_usd is not None
                    and native_per_usd > 0
                ):
                    twd_per_native = self.realtime_fx_rate / native_per_usd
                    if math.isfinite(twd_per_native) and twd_per_native > 0:
                        self.realtime_fx_rates_by_currency[currency] = twd_per_native
                        print(
                            f"[FX:{currency}] 即時 TWD/{currency}: "
                            f"{twd_per_native:.8f}"
                        )
            except Exception as exc:
                print(f"[FX:{currency}] 匯率下載失敗: {exc}")

    def validate_required_fx_data(self, tickers):
        """Return currencies whose required TWD conversion series is unavailable."""
        required_currencies = {
            CurrencyDetector.detect(ticker)
            for ticker in tickers
            if str(ticker or '').strip()
        }
        missing = []
        for currency in sorted(required_currencies):
            if currency == 'TWD':
                continue
            series = self.fx_rates_by_currency.get(currency)
            if series is None or series.empty:
                missing.append(currency)
                continue
            values = pd.to_numeric(series, errors='coerce')
            if values.isna().any() or not values.map(
                lambda value: math.isfinite(float(value)) and float(value) > 0
            ).all():
                missing.append(currency)
        return missing

    def get_fx_snapshot(self, value_date):
        """Return TWD/native multipliers available as-of the requested date."""
        target = pd.to_datetime(value_date)
        if getattr(target, 'tzinfo', None) is not None:
            target = target.tz_localize(None)
        target = target.normalize()

        snapshot = {'TWD': 1.0}
        for currency, series in self.fx_rates_by_currency.items():
            try:
                value = float(series.asof(target))
            except Exception:
                continue
            if math.isfinite(value) and value > 0:
                snapshot[currency] = value
        return snapshot

    def get_realtime_fx_snapshot(self, value_date=None):
        """Return historical as-of context overlaid with available realtime rates."""
        target = value_date if value_date is not None else pd.Timestamp.now().normalize()
        snapshot = self.get_fx_snapshot(target)
        for currency, value in self.realtime_fx_rates_by_currency.items():
            rate = float(value)
            if math.isfinite(rate) and rate > 0:
                snapshot[currency] = rate
        snapshot['TWD'] = 1.0
        return snapshot

    def download_data(self, tickers: list, start_date):
        """下載市場數據（股票價格 + currency-aware 匯率）。"""
        print(f"正在下載市場數據，起始日期: {start_date}...")

        required_currencies = {
            CurrencyDetector.detect(ticker)
            for ticker in tickers
            if str(ticker or '').strip()
        }
        self._download_currency_fx(required_currencies, start_date)

        # ==================== 下載個股數據 (平行化) ====================
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))

        def fetch_single_ticker(t):
            try:
                ticker_obj = yf.Ticker(t)
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)

                if not hist.empty:
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()

                    # 盤中即時價覆蓋最後一筆日線
                    try:
                        latest_price = None

                        try:
                            raw_price = ticker_obj.fast_info.get('last_price') or ticker_obj.fast_info.get('regular_market_price')
                            if raw_price:
                                latest_price = float(raw_price)
                        except Exception:
                            pass

                        if latest_price is None:
                            intraday = ticker_obj.history(period="1d", interval="1m")
                            if not intraday.empty:
                                latest_price = float(intraday['Close'].iloc[-1])

                        if latest_price is not None:
                            last_date = hist.index[-1]
                            hist.at[last_date, 'Close'] = latest_price
                            if 'Adj Close' in hist.columns:
                                hist.at[last_date, 'Adj Close'] = latest_price
                            print(f"[{t}] 即時報價覆蓋: {latest_price:.2f}")

                    except Exception:
                        pass

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
        """準備股票數據（方案 A）。

        - 估值價格一律使用 Close（split-adjusted price return）。
        - 配息不做價格復權，配息效果由 DIV 記錄或市場配息偵測入帳。
        """
        df = df.copy()

        selector = AutoPriceSelector(symbol, df)
        df['Close_Adjusted'] = selector.get_adjusted_price_series()

        metadata = selector.get_metadata()
        print(f"[{symbol}] 價格來源: {metadata['price_source']} - {metadata['selection_reason']}")

        df['Close_Raw'] = df['Close'] if 'Close' in df.columns else df.get('Close_Adjusted')

        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0

        splits = df['Stock Splits'].replace(0, 1.0)
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        df['Split_Factor'] = cum_splits.shift(-1).fillna(1.0)

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
        except Exception:
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
        except Exception:
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
        except Exception:
            return pd.to_datetime(used_date).tz_localize(None).normalize()

    def get_transaction_multiplier(self, symbol, date):
        """取得交易日的累積拆股復權因子，使用 as-of/pad 語意。"""
        if symbol not in self.market_data:
            return 1.0

        try:
            df = self.market_data[symbol]
            dt = pd.to_datetime(date)
            if getattr(dt, 'tzinfo', None) is not None:
                dt = dt.tz_localize(None)
            dt = dt.normalize()

            if dt in df.index:
                return float(df.loc[dt, 'Split_Factor'])

            idx = df.index.get_indexer([dt], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Split_Factor'])

            return float(df.iloc[0]['Split_Factor'])
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
