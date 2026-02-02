import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import pandas as pd
import pytz
import yfinance as yf

from ..config import DEFAULT_FX_RATE, EXCHANGE_SYMBOL
from .auto_price_selector import AutoPriceSelector


class MarketDataClient:
    """
    Market data loader with:
      - Batch daily download via yf.download
      - Conditional intraday overlay (1m) only when market is open
      - FX realtime: fast_info if possible; otherwise fallback to daily close
      - SAFE as-of valuation:
          * if requested date is earlier than first available bar, use the first available price
            (prevents 0 valuation -> TWR explosions)
    """

    @staticmethod
    def _normalize_twd_per_usd(rate: float) -> float:
        try:
            r = float(rate)
            if r <= 0:
                return DEFAULT_FX_RATE
            return (1.0 / r) if r < 1.0 else r
        except Exception:
            return DEFAULT_FX_RATE

    @staticmethod
    def _to_normalized_date_index(df: pd.DataFrame) -> pd.DataFrame:
        if df is None or df.empty:
            return df
        df = df.copy()
        df.index = pd.to_datetime(df.index)
        if getattr(df.index, "tz", None) is not None:
            df.index = df.index.tz_localize(None)
        df.index = df.index.normalize()
        return df

    @staticmethod
    def _chunk_list(items: List[str], chunk_size: int) -> List[List[str]]:
        if chunk_size <= 0:
            return [items]
        return [items[i : i + chunk_size] for i in range(0, len(items), chunk_size)]

    @staticmethod
    def _is_tw_ticker(symbol: str) -> bool:
        s = symbol.upper()
        return s.endswith(".TW") or s.endswith(".TWO")

    @staticmethod
    def _now_in_tz(tzname: str) -> datetime:
        tz = pytz.timezone(tzname)
        return datetime.now(tz)

    @classmethod
    def _is_market_open_for_symbol(cls, symbol: str) -> bool:
        if cls._is_tw_ticker(symbol):
            now = cls._now_in_tz("Asia/Taipei")
            if now.weekday() >= 5:
                return False
            t = now.time()
            return (t >= datetime.strptime("09:00", "%H:%M").time()) and (
                t <= datetime.strptime("13:30", "%H:%M").time()
            )

        now = cls._now_in_tz("US/Eastern")
        if now.weekday() >= 5:
            return False
        t = now.time()
        return (t >= datetime.strptime("09:30", "%H:%M").time()) and (
            t <= datetime.strptime("16:00", "%H:%M").time()
        )

    def __init__(self):
        self.market_data: Dict[str, pd.DataFrame] = {}
        self.fx_rates: pd.Series = pd.Series(dtype=float)  # daily USD/TWD (TWD per USD)
        self.realtime_fx_rate: Optional[float] = None
        logging.getLogger("yfinance").setLevel(logging.ERROR)

    def download_data(
        self,
        tickers: List[str],
        start_date,
        *,
        enable_intraday: bool = True,
        intraday_only_tickers: Optional[List[str]] = None,
        batch_size: int = 80,
    ) -> Tuple[Dict[str, pd.DataFrame], pd.Series]:
        print(f"正在下載市場數據，起始日期: {start_date}...")

        self._download_fx(start_date)

        all_tickers = sorted(set([t for t in tickers if t]))
        if "SPY" not in all_tickers:
            all_tickers.append("SPY")

        daily_data = self._download_daily_batch(all_tickers, start_date, batch_size=batch_size)

        for sym, df in daily_data.items():
            if df is None or df.empty:
                print(f"[{sym}] 警告: 無歷史數據")
                continue
            prepared = self._prepare_data(sym, df)
            self.market_data[sym] = prepared
            print(f"[{sym}] 下載成功")

        if enable_intraday:
            self._apply_intraday_overlay(
                all_tickers=all_tickers,
                intraday_only_tickers=intraday_only_tickers,
                batch_size=batch_size,
            )

        return self.market_data, self.fx_rates

    def _download_fx(self, start_date) -> None:
        try:
            fx = yf.Ticker(EXCHANGE_SYMBOL)

            fx_hist = fx.history(start=start_date - timedelta(days=5), auto_adjust=False)
            fx_hist = self._to_normalized_date_index(fx_hist)

            if fx_hist is not None and not fx_hist.empty and "Close" in fx_hist.columns:
                self.fx_rates = (
                    fx_hist["Close"]
                    .resample("D")
                    .ffill()
                    .apply(self._normalize_twd_per_usd)
                )
            else:
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

            print("[FX] 正在獲取即時匯率...")
            latest_rate = None

            try:
                raw_price = fx.fast_info.get("last_price") or fx.fast_info.get("regular_market_price")
                if raw_price:
                    latest_rate = self._normalize_twd_per_usd(float(raw_price))
                    print(f"[FX] 使用 fast_info 獲取: {latest_rate:.4f}")
            except Exception:
                latest_rate = None

            if latest_rate is None:
                try:
                    if self.fx_rates is not None and len(self.fx_rates) > 0:
                        latest_rate = float(self.fx_rates.iloc[-1])
                        print(f"[FX] 使用歷史收盤 fallback: {latest_rate:.4f}")
                except Exception:
                    latest_rate = None

            if latest_rate is not None:
                self.realtime_fx_rate = latest_rate
                print(f"[FX] ✅ 即時匯率就緒: {latest_rate:.4f} (realtime_fx_rate)")
            else:
                self.realtime_fx_rate = None
                print("[FX] ⚠️ 無法獲取即時匯率，後續計算將依賴歷史收盤")

        except Exception as e:
            print(f"[FX] 匯率下載嚴重錯誤: {e}")
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
            self.realtime_fx_rate = None

    def _download_daily_batch(
        self,
        tickers: List[str],
        start_date,
        *,
        batch_size: int,
    ) -> Dict[str, Optional[pd.DataFrame]]:
        result: Dict[str, Optional[pd.DataFrame]] = {t: None for t in tickers}

        chunks = self._chunk_list(tickers, batch_size)
        for chunk in chunks:
            try:
                df = yf.download(
                    tickers=" ".join(chunk),
                    start=start_date,
                    group_by="ticker",
                    auto_adjust=False,
                    actions=True,
                    threads=True,
                    progress=False,
                )

                if df is None or df.empty:
                    for t in chunk:
                        result[t] = None
                    continue

                if not isinstance(df.columns, pd.MultiIndex):
                    one = chunk[0]
                    one_df = df.copy()
                    one_df = self._to_normalized_date_index(one_df)
                    result[one] = one_df
                    continue

                for t in chunk:
                    try:
                        if t not in df.columns.get_level_values(0):
                            result[t] = None
                            continue
                        tdf = df[t].copy()
                        tdf = self._to_normalized_date_index(tdf)
                        result[t] = tdf
                    except Exception:
                        result[t] = None

            except Exception as e:
                print(f"[BATCH] 下載錯誤: {e}")
                for t in chunk:
                    result[t] = None

        return result

    def _apply_intraday_overlay(
        self,
        *,
        all_tickers: List[str],
        intraday_only_tickers: Optional[List[str]],
        batch_size: int,
    ) -> None:
        target = set(all_tickers)
        if intraday_only_tickers is not None:
            target = set([t for t in intraday_only_tickers if t in target])

        gated = [t for t in sorted(target) if self._is_market_open_for_symbol(t)]
        if not gated:
            return

        for chunk in self._chunk_list(gated, batch_size):
            try:
                intraday = yf.download(
                    tickers=" ".join(chunk),
                    period="1d",
                    interval="1m",
                    group_by="ticker",
                    auto_adjust=False,
                    threads=True,
                    progress=False,
                )
                if intraday is None or intraday.empty:
                    continue

                if not isinstance(intraday.columns, pd.MultiIndex):
                    sym = chunk[0]
                    self._overlay_one_intraday(sym, intraday)
                    continue

                for sym in chunk:
                    try:
                        if sym not in intraday.columns.get_level_values(0):
                            continue
                        sym_df = intraday[sym].dropna(how="all")
                        self._overlay_one_intraday(sym, sym_df)
                    except Exception:
                        continue
            except Exception:
                continue

    def _overlay_one_intraday(self, symbol: str, intraday_df: pd.DataFrame) -> None:
        if symbol not in self.market_data:
            return
        if intraday_df is None or intraday_df.empty:
            return
        if "Close" not in intraday_df.columns:
            return

        try:
            latest_price = float(intraday_df["Close"].iloc[-1])
            daily = self.market_data[symbol]
            if daily is None or daily.empty:
                return

            last_date = daily.index[-1]
            daily.at[last_date, "Close"] = latest_price
            if "Adj Close" in daily.columns:
                daily.at[last_date, "Adj Close"] = latest_price
            if "Close_Adjusted" in daily.columns:
                daily.at[last_date, "Close_Adjusted"] = latest_price

            print(f"[{symbol}] ✅ 盤中即時覆蓋: {latest_price:.2f}")
        except Exception:
            return

    def _prepare_data(self, symbol: str, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        selector = AutoPriceSelector(symbol, df)
        df["Close_Adjusted"] = selector.get_adjusted_price_series()
        metadata = selector.get_metadata()
        print(f"[{symbol}] 價格來源: {metadata['price_source']} - {metadata['selection_reason']}")

        df["Close_Raw"] = df["Close"] if "Close" in df.columns else df.get("Close_Adjusted")

        if "Stock Splits" not in df.columns:
            df["Stock Splits"] = 0.0
        splits = df["Stock Splits"].replace(0, 1.0)
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        df["Split_Factor"] = cum_splits.shift(-1).fillna(1.0)

        df["Dividend_Adj_Factor"] = 1.0
        return df

    # -----------------------
    # Accessors (SAFE)
    # -----------------------
    def get_price(self, symbol, date):
        """
        SAFE as-of valuation:
          - exact date -> exact
          - between bars -> pad
          - earlier than first bar -> FIRST bar (IMPORTANT)
        """
        if symbol not in self.market_data:
            return 0.0
        try:
            df = self.market_data[symbol]
            dt = pd.to_datetime(date).tz_localize(None).normalize()

            if df is None or df.empty:
                return 0.0

            if dt <= df.index.min():
                return float(df.iloc[0]["Close_Adjusted"])

            if dt in df.index:
                return float(df.loc[dt, "Close_Adjusted"])

            idx = df.index.get_indexer([dt], method="pad")[0]
            if idx != -1:
                return float(df.iloc[idx]["Close_Adjusted"])

            # should not hit if dt > min, but keep fallback
            return float(df.iloc[0]["Close_Adjusted"])
        except Exception:
            return 0.0

    def get_price_asof(self, symbol, date):
        """
        Return (price, used_trading_date) with SAFE early-date behavior.
        """
        dt = pd.to_datetime(date).tz_localize(None).normalize()
        if symbol not in self.market_data:
            return 0.0, dt
        try:
            df = self.market_data[symbol]
            if df is None or df.empty:
                return 0.0, dt

            if dt <= df.index.min():
                used = df.index.min()
                return float(df.iloc[0]["Close_Adjusted"]), used

            if dt in df.index:
                return float(df.loc[dt, "Close_Adjusted"]), dt

            idx = df.index.get_indexer([dt], method="pad")[0]
            if idx != -1:
                used = df.index[idx]
                return float(df.iloc[idx]["Close_Adjusted"]), used

            used = df.index.min()
            return float(df.iloc[0]["Close_Adjusted"]), used
        except Exception:
            return 0.0, dt

    def get_prev_trading_date(self, symbol, used_date):
        try:
            if symbol not in self.market_data:
                return pd.to_datetime(used_date).tz_localize(None).normalize()

            df = self.market_data[symbol]
            dt = pd.to_datetime(used_date).tz_localize(None).normalize()

            if df is None or df.empty:
                return dt

            if dt <= df.index.min():
                return df.index.min()

            if dt not in df.index:
                idx = df.index.get_indexer([dt], method="pad")[0]
                if idx == -1:
                    return df.index.min()
                dt = df.index[idx]

            idx2 = df.index.get_indexer([dt])[0]
            if idx2 <= 0:
                return dt
            return df.index[idx2 - 1]
        except Exception:
            return pd.to_datetime(used_date).tz_localize(None).normalize()

    def get_transaction_multiplier(self, symbol, date):
        if symbol not in self.market_data:
            return 1.0
        try:
            df = self.market_data[symbol]
            dt = pd.to_datetime(date).tz_localize(None).normalize()

            if df is None or df.empty:
                return 1.0

            if dt in df.index:
                return float(df.loc[dt, "Split_Factor"])
            if dt < df.index.min():
                return float(df.iloc[0]["Split_Factor"])
            return float(df.iloc[-1]["Split_Factor"])
        except Exception:
            return 1.0

    def get_dividend_adjustment_factor(self, symbol, date):
        return 1.0

    def get_dividend(self, symbol, date):
        if symbol not in self.market_data:
            return 0.0
        try:
            df = self.market_data[symbol]
            dt = pd.to_datetime(date).tz_localize(None).normalize()
            if df is None or df.empty:
                return 0.0
            if dt <= df.index.min():
                # no dividend before first bar (safe)
                return 0.0
            if dt in df.index and "Dividends" in df.columns:
                v = df.loc[dt, "Dividends"]
                return float(v) if pd.notna(v) else 0.0
        except Exception:
            pass
        return 0.0
