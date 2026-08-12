import concurrent.futures
import math
import time
from datetime import datetime, timedelta

import pandas as pd
import pytz
import yfinance as yf

from ..config import (
    DEFAULT_FX_RATE,
    EXCHANGE_SYMBOL,
    FX_NATIVE_UNIT_SCALES,
    FX_USD_QUOTE_SYMBOLS,
)
from ..core.currency_detector import CurrencyDetector
from .auto_price_selector import AutoPriceSelector


VALUATION_SOURCE_COLUMN = "Valuation_Source"
VALUATION_SOURCE_DATE_COLUMN = "Valuation_Source_Date"
REALTIME_VALUATION_SOURCE = "realtime_quote"
SELECTED_PRICE_REFETCH_ATTEMPTS = 2
SELECTED_PRICE_REFETCH_DELAY_SECONDS = 1.0


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
        """Derive TWD per one major native currency unit from USD quote series.

        Yahoo `CUR=X` is native currency units per 1 USD, therefore:
        TWD/native-major-unit = (TWD/USD) / (native/USD).
        Market-specific subunit scaling (for example GBp) is applied separately.
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

        self.fx_rates = pd.Series(dtype=float)
        self.realtime_fx_rate = None

        # Canonical currency-aware context: TWD per 1 native quote unit.
        self.fx_rates_by_currency = {}
        self.realtime_fx_rates_by_currency = {}

        # Narrow structured diagnostics for Gate-D provenance. They are populated
        # only by the main thread after each ticker worker completes.
        self.price_metadata_by_symbol = {}
        self.realtime_overlay_symbols = set()

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

    @staticmethod
    def _get_intraday_quote_with_date(ticker):
        """Return a dated stock quote only with complete no-action evidence.

        Stock realtime valuation must carry both date evidence and corporate-action
        safety evidence. The intraday frame provides an exchange-local timestamp and,
        with ``actions=True``, Yahoo/yfinance action columns. A synthetic valuation is
        disabled when required action columns are missing/malformed or when any
        quote-date split/dividend/capital-gain event is present.
        """
        try:
            intraday = ticker.history(
                period='1d',
                interval='1m',
                auto_adjust=False,
                prepost=False,
                actions=True,
            )
            if intraday.empty or 'Close' not in intraday.columns:
                return None

            closes = pd.to_numeric(intraday['Close'], errors='coerce').astype(float)
            valid = closes[
                closes.map(
                    lambda value: math.isfinite(float(value)) and float(value) > 0
                )
            ]
            if valid.empty:
                return None

            quote_timestamp = pd.Timestamp(valid.index[-1])
            if pd.isna(quote_timestamp):
                return None
            if quote_timestamp.tzinfo is not None:
                quote_timestamp = quote_timestamp.tz_localize(None)
            quote_date = quote_timestamp.normalize()

            intraday_index = pd.to_datetime(intraday.index, errors='coerce')
            if intraday_index.isna().any():
                return None
            if intraday_index.tz is not None:
                intraday_index = intraday_index.tz_localize(None)
            quote_date_rows = intraday.loc[intraday_index.normalize() == quote_date]
            if quote_date_rows.empty:
                return None

            # Required action columns must be explicitly present. Assuming zero when
            # action evidence is missing can combine a post-split quote with pre-split
            # holdings/Split_Factor semantics.
            for column in ('Dividends', 'Stock Splits'):
                if column not in quote_date_rows.columns:
                    return None
                values = pd.to_numeric(quote_date_rows[column], errors='coerce')
                if values.isna().any() or (values != 0).any():
                    return None

            if 'Capital Gains' in quote_date_rows.columns:
                capital_gains = pd.to_numeric(
                    quote_date_rows['Capital Gains'],
                    errors='coerce',
                )
                if capital_gains.isna().any() or (capital_gains != 0).any():
                    return None

            return float(valid.iloc[-1]), quote_timestamp
        except Exception:
            return None

    @staticmethod
    def _append_realtime_valuation_row(hist, quote_price, quote_timestamp):
        """Append a dated no-action realtime valuation without mutating EOD bars.

        The quote has already passed quote-date corporate-action validation. It is
        eligible only when its provider timestamp proves a date strictly later than
        the last downloaded daily row. Same-date or older quotes never overwrite
        ``Close``/``Adj Close``. The synthetic row is explicitly labelled so
        deterministic market-input provenance distinguishes it from a vendor daily row.
        """
        if hist is None or hist.empty:
            return hist, False

        try:
            price = float(quote_price)
            if not math.isfinite(price) or price <= 0:
                return hist, False

            quote_date = pd.Timestamp(quote_timestamp)
            if pd.isna(quote_date):
                return hist, False
            if quote_date.tzinfo is not None:
                quote_date = quote_date.tz_localize(None)
            quote_date = quote_date.normalize()

            last_date = pd.Timestamp(hist.index[-1])
            if last_date.tzinfo is not None:
                last_date = last_date.tz_localize(None)
            last_date = last_date.normalize()
            if quote_date <= last_date:
                return hist, False

            work = hist.copy(deep=True)
            if VALUATION_SOURCE_COLUMN not in work.columns:
                work[VALUATION_SOURCE_COLUMN] = 'market'
            if VALUATION_SOURCE_DATE_COLUMN not in work.columns:
                work[VALUATION_SOURCE_DATE_COLUMN] = [
                    pd.Timestamp(index).normalize().strftime('%Y-%m-%d')
                    for index in work.index
                ]

            synthetic_row = work.iloc[-1].copy()
            for column in ('Close', 'Adj Close', 'Open', 'High', 'Low'):
                if column in synthetic_row.index:
                    synthetic_row[column] = price
            if 'Volume' in synthetic_row.index:
                synthetic_row['Volume'] = 0.0
            for column in ('Dividends', 'Stock Splits', 'Capital Gains'):
                if column in synthetic_row.index:
                    synthetic_row[column] = 0.0

            synthetic_row[VALUATION_SOURCE_COLUMN] = REALTIME_VALUATION_SOURCE
            synthetic_row[VALUATION_SOURCE_DATE_COLUMN] = quote_date.strftime('%Y-%m-%d')
            work.loc[quote_date] = synthetic_row
            return work.sort_index(), True
        except Exception:
            return hist, False

    def _download_currency_fx(self, required_currencies, start_date):
        self.fx_rates = pd.Series(dtype=float)
        self.realtime_fx_rate = None
        self.fx_rates_by_currency = {}
        self.realtime_fx_rates_by_currency = {}

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
            unit_scale = FX_NATIVE_UNIT_SCALES.get(currency)
            if not quote_symbol or unit_scale is None:
                print(f"[FX:{currency}] 未設定 Yahoo USD quote symbol / native-unit scale")
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
                if not derived.empty:
                    derived = self._clean_positive_series(derived * float(unit_scale))
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
                    twd_per_native = (
                        self.realtime_fx_rate / native_per_usd * float(unit_scale)
                    )
                    if math.isfinite(twd_per_native) and twd_per_native > 0:
                        self.realtime_fx_rates_by_currency[currency] = twd_per_native
                        print(
                            f"[FX:{currency}] 即時 TWD/{currency}: "
                            f"{twd_per_native:.8f}"
                        )
            except Exception as exc:
                print(f"[FX:{currency}] 匯率下載失敗: {exc}")

    def validate_required_fx_data(self, tickers):
        """Return native quote units whose required TWD conversion is unavailable."""
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

    @staticmethod
    def _selected_price_contains_nan(frame):
        """Return True only when the prepared provider-selected price still has NaN."""
        if frame is None or frame.empty or 'Close_Adjusted' not in frame.columns:
            return False
        selected = pd.to_numeric(frame['Close_Adjusted'], errors='coerce')
        return selected.isna().any()

    def download_data(self, tickers: list, start_date):
        """下載市場數據（股票價格 + currency-aware 匯率）。"""
        print(f"正在下載市場數據，起始日期: {start_date}...")

        # Sidecars describe only the current download generation. Reset before any
        # worker is scheduled so stale provenance cannot leak into a later manifest.
        self.price_metadata_by_symbol = {}
        self.realtime_overlay_symbols = set()

        required_currencies = {
            CurrencyDetector.detect(ticker)
            for ticker in tickers
            if str(ticker or '').strip()
        }
        self._download_currency_fx(required_currencies, start_date)

        all_tickers = list(set([t for t in tickers if t] + ['SPY']))

        def fetch_single_ticker(t):
            try:
                last_result = None
                for attempt in range(1, SELECTED_PRICE_REFETCH_ATTEMPTS + 1):
                    # Construct a fresh Ticker on each attempt. The retry requests the
                    # same provider, date range, adjustment mode, and action fields;
                    # it never fills, drops, substitutes, or repairs a provider row.
                    ticker_obj = yf.Ticker(t)
                    hist = ticker_obj.history(
                        start=start_date,
                        auto_adjust=False,
                        actions=True,
                    )

                    if hist.empty:
                        print(f"[{t}] 警告: 無歷史數據")
                        return t, None, None, False

                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    realtime_overlay_applied = False

                    intraday_quote = self._get_intraday_quote_with_date(ticker_obj)
                    if intraday_quote is not None:
                        latest_price, quote_timestamp = intraday_quote
                        hist, realtime_overlay_applied = self._append_realtime_valuation_row(
                            hist,
                            latest_price,
                            quote_timestamp,
                        )
                        if realtime_overlay_applied:
                            quote_date = pd.Timestamp(quote_timestamp)
                            if quote_date.tzinfo is not None:
                                quote_date = quote_date.tz_localize(None)
                            print(
                                f"[{t}] 即時估值新增: {quote_date.strftime('%Y-%m-%d')} "
                                f"@ {latest_price:.2f}"
                            )

                    hist_adj = self._prepare_data(t, hist)
                    metadata = dict(hist_adj.attrs.get('price_provenance') or {})
                    last_result = (t, hist_adj, metadata, realtime_overlay_applied)

                    if not self._selected_price_contains_nan(hist_adj):
                        return last_result

                    if attempt < SELECTED_PRICE_REFETCH_ATTEMPTS:
                        print(
                            f"[{t}] selected price 含 NaN；將以相同 provider/參數 "
                            f"fresh re-fetch ({attempt + 1}/{SELECTED_PRICE_REFETCH_ATTEMPTS})"
                        )
                        time.sleep(SELECTED_PRICE_REFETCH_DELAY_SECONDS)

                # Persistent invalid data remains unchanged and is rejected by the
                # existing downstream validator. Never make the workflow green by
                # mutating financial semantics here.
                return last_result

            except Exception as e:
                print(f"[{t}] 下載錯誤: {e}")
                return t, None, None, False

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_ticker = {executor.submit(fetch_single_ticker, t): t for t in all_tickers}
            for future in concurrent.futures.as_completed(future_to_ticker):
                result = future.result()
                if result:
                    ticker, data, metadata, realtime_overlay_applied = result
                    if data is not None:
                        self.market_data[ticker] = data
                        if metadata:
                            self.price_metadata_by_symbol[ticker] = metadata
                        if realtime_overlay_applied:
                            self.realtime_overlay_symbols.add(ticker)
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
        df.attrs['price_provenance'] = dict(metadata)
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
