import pandas as pd
import yfinance as yf
import concurrent.futures
import pytz
from contextlib import contextmanager
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
        - realtime_quotes: 即時/延遲報價（不覆蓋日線收盤）
        - realtime_fx_rate: [兼容 calculator] 即時匯率（由 realtime_quotes[EXCHANGE_SYMBOL] 同步）

        NOTE:
        - v2.58+: 支援 per-user atomic realtime quote（持倉 + benchmark + FX）
          只要這組 required symbols 完整拿到「市場當日」的 P0，就使用該組 RT。
          否則整位 user 回退使用 EOD，避免快照內部資料不一致。
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
        """是否應使用即時/延遲報價。

        舊行為：嚴格僅在盤中。
        新行為（配合 per-user atomic）：
        - 只要 realtime_quotes 裡已經有該 symbol 的 quote，就允許 get_price/get_price_asof 嘗試使用。
          具體是否採用仍由 q.market_date == target_date 決定。
        - 若沒有 quote，則維持舊版「盤中」判斷。
        """
        symbol = (symbol or '').upper()

        # If already have a quote, allow using it even if not strictly "market hours".
        if symbol in self.realtime_quotes:
            return True

        if symbol == (EXCHANGE_SYMBOL or '').upper() or '=' in symbol:
            # FX: only try during TW or US market hours (background refresh)
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

    def _fetch_single_realtime(self, symbol: str, market_tz) -> RealtimeQuote | None:
        """逐檔查詢即時/延遲報價（用於小量補救）。

        成功率/請求量優先：
        1) fast_info
        2) history(period='5d', interval='5m')
        3) history(period='10d', interval='15m')

        NOTE:
        - 刻意不使用 1m，降低 GitHub Actions 在 Yahoo/yfinance 上被限流的風險。
        """
        if not symbol:
            return None

        sym = symbol.upper()
        today_market = datetime.now(market_tz).date()

        try:
            ticker = yf.Ticker(sym)

            # 1) fast_info
            try:
                info = ticker.fast_info
                price = info.get('last_price') or info.get('regularMarketPrice') or info.get('regular_market_price')
                if price and price > 0:
                    return RealtimeQuote(
                        symbol=sym,
                        price=float(price),
                        timestamp=pd.Timestamp.utcnow(),
                        market_date=pd.Timestamp(today_market),
                        source='single.fast_info'
                    )
            except Exception:
                pass

            # 2) 5m history
            try:
                hist_5m = ticker.history(period="5d", interval="5m", timeout=10)
                if hist_5m is not None and not hist_5m.empty and 'Close' in hist_5m.columns:
                    closes = hist_5m['Close'].dropna()
                    if not closes.empty:
                        last_price = float(closes.iloc[-1])
                        last_ts = closes.index[-1]

                        if getattr(last_ts, 'tzinfo', None) is None:
                            last_ts = pd.Timestamp(last_ts).tz_localize('UTC')
                        else:
                            last_ts = pd.Timestamp(last_ts)

                        market_date = last_ts.tz_convert(market_tz).date()
                        if market_date == today_market:
                            return RealtimeQuote(
                                symbol=sym,
                                price=last_price,
                                timestamp=last_ts,
                                market_date=pd.Timestamp(today_market),
                                source='single.history_5m'
                            )
            except Exception:
                pass

            # 3) 15m history
            try:
                hist_15m = ticker.history(period="10d", interval="15m", timeout=10)
                if hist_15m is not None and not hist_15m.empty and 'Close' in hist_15m.columns:
                    closes = hist_15m['Close'].dropna()
                    if not closes.empty:
                        last_price = float(closes.iloc[-1])
                        last_ts = closes.index[-1]

                        if getattr(last_ts, 'tzinfo', None) is None:
                            last_ts = pd.Timestamp(last_ts).tz_localize('UTC')
                        else:
                            last_ts = pd.Timestamp(last_ts)

                        market_date = last_ts.tz_convert(market_tz).date()
                        if market_date == today_market:
                            return RealtimeQuote(
                                symbol=sym,
                                price=last_price,
                                timestamp=last_ts,
                                market_date=pd.Timestamp(today_market),
                                source='single.history_15m'
                            )
            except Exception:
                pass

            return None

        except Exception as e:
            print(f"[{sym}] 逐檔查詢失敗: {e}")
            return None

    def _fetch_intraday_prices_batch(
        self,
        symbols: list[str],
        market_tz,
        name: str = "Intraday Batch",
        interval: str = "15m",
        period: str | None = None,
    ) -> dict[str, RealtimeQuote]:
        """批量抓取盤中/延遲最後價，並只保留『市場當日』的最新價。

        Note: 不覆蓋日線 EOD，只寫入 realtime_quotes。
        """
        symbols = [s for s in (symbols or []) if s]
        if not symbols:
            return {}

        interval = (interval or '15m').lower()

        # Default periods tuned for stability (允許延遲)
        if period is None:
            if interval == '5m':
                period = '5d'
            elif interval == '15m':
                period = '10d'
            else:
                period = '10d'

        def yf_intraday_func():
            return yf.download(
                tickers=symbols,
                period=period,
                interval=interval,
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
            print(f"[{name}] ⚠️ yfinance 沒有回傳任何盤中數據 (interval={interval}, period={period})")
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
                    source=f'yf.download-{interval}',
                )
            except Exception:
                continue

        return out

    def _fetch_intraday_prices_batch_multi(self, symbols: list[str], market_tz, name: str) -> dict[str, RealtimeQuote]:
        """穩健的 batch RT：先 15m 再 5m（避免 1m）。

        目標：降低失敗率與請求成本，允許延遲但要是「市場當日」的價格。
        """
        symbols = [s for s in (symbols or []) if s]
        if not symbols:
            return {}

        plan = [
            ('15m', '10d'),
            ('5m', '5d'),
        ]

        out: dict[str, RealtimeQuote] = {}
        remaining = [s.upper() for s in symbols]

        for interval, period in plan:
            if not remaining:
                break

            q = self._fetch_intraday_prices_batch(
                remaining,
                market_tz,
                name=f"{name} ({interval})",
                interval=interval,
                period=period,
            )

            # merge
            for k, v in q.items():
                old = out.get(k)
                if (old is None) or (v.timestamp > old.timestamp):
                    out[k] = v

            remaining = [s for s in remaining if s not in out]

            # early stop when already good enough
            rate = len(out) / len(symbols) if symbols else 0
            if rate >= 0.85:
                break

        return out

    def _fetch_fx_realtime_fallback(self) -> RealtimeQuote | None:
        """FX 專用 fallback：以較高成功率方式嘗試取得「當天」匯率。

        Order:
        1) fast_info
        2) history 5m (5d)
        3) history 15m (10d)

        Note:
        - 允許延遲（5m/15m），只要是台北當日即可。
        - 刻意不使用 1m，降低被限流風險。
        """
        sym = (EXCHANGE_SYMBOL or '').upper()
        if not sym:
            return None

        taipei_tz = pytz.timezone('Asia/Taipei')
        now_utc = pd.Timestamp.now(tz='UTC')
        today_tw_date = datetime.now(taipei_tz).date()

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
                        market_date=pd.Timestamp(today_tw_date),
                        source='fx.fast_info',
                    )
        except Exception:
            pass

        # 2-3) intraday history with interval fallback
        candidates = [
            ("5d", "5m", "fx.history-5m"),
            ("10d", "15m", "fx.history-15m"),
        ]

        for period, interval, src in candidates:
            try:
                intraday = fx.history(period=period, interval=interval, timeout=12)
                if intraday is not None and (not intraday.empty) and 'Close' in intraday.columns:
                    closes = intraday['Close'].dropna()
                    if closes.empty:
                        continue

                    last_price = self._normalize_twd_per_usd(float(closes.iloc[-1]))
                    last_ts = closes.index[-1]

                    if getattr(last_ts, 'tzinfo', None) is None:
                        last_ts = pd.Timestamp(last_ts).tz_localize('UTC')
                    else:
                        last_ts = pd.Timestamp(last_ts)

                    # Use Taipei date to decide "today"
                    market_date = last_ts.tz_convert(taipei_tz).date()
                    if market_date != today_tw_date:
                        continue

                    if last_price and last_price > 0:
                        return RealtimeQuote(
                            symbol=sym,
                            price=float(last_price),
                            timestamp=last_ts,
                            market_date=pd.Timestamp(market_date),
                            source=src,
                        )
            except Exception:
                continue

        return None

    def _fetch_taiwan_realtime_price(self, ticker_obj, symbol: str) -> float:
        """[Deprecated]"""
        print(f"[{symbol}] 警告: _fetch_taiwan_realtime_price 已棄用，請使用 _fetch_single_realtime")
        return None

    def _upsert_daily_row_with_price(self, hist: pd.DataFrame, target_date: pd.Timestamp, latest_price: float, symbol: str) -> pd.DataFrame:
        """[Deprecated]"""
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

    def fetch_realtime_quotes_atomic(self, required_symbols: list[str], label: str = "atomic", max_single_rescue: int = 6) -> tuple[bool, dict[str, RealtimeQuote], list[str]]:
        """Per-user atomic realtime quote fetch.

        Contract:
        - If success: return (True, quotes, []) where quotes contains EVERY required symbol.
        - If fail: return (False, partial_quotes, missing_symbols)

        Notes:
        - required_symbols should be small: holdings + benchmark + FX.
        - This function validates quote belongs to market "today" (market tz).
        - It uses low-request batch (15m -> 5m) and then limited single rescue.
        """
        required = [s.upper() for s in (required_symbols or []) if s]
        required = sorted(list(dict.fromkeys(required)))
        if not required:
            return True, {}, []

        tw_tz = pytz.timezone('Asia/Taipei')
        us_tz = pytz.timezone('America/New_York')

        tw_syms: list[str] = []
        us_syms: list[str] = []

        for s in required:
            if s == (EXCHANGE_SYMBOL or '').upper() or '=' in s or self._is_taiwan_stock(s):
                tw_syms.append(s)
            else:
                us_syms.append(s)

        quotes: dict[str, RealtimeQuote] = {}

        # Batch fetch
        if tw_syms:
            q = self._fetch_intraday_prices_batch_multi(tw_syms, tw_tz, name=f"{label} TW")
            quotes.update(q)

        if us_syms:
            q = self._fetch_intraday_prices_batch_multi(us_syms, us_tz, name=f"{label} US")
            for k, v in q.items():
                old = quotes.get(k)
                if (old is None) or (v.timestamp > old.timestamp):
                    quotes[k] = v

        missing = [s for s in required if s not in quotes]

        # Limited single rescue (only for missing)
        if missing and max_single_rescue > 0:
            rescue_list = missing[:max_single_rescue]
            for sym in rescue_list:
                tz = tw_tz if (sym == (EXCHANGE_SYMBOL or '').upper() or '=' in sym or self._is_taiwan_stock(sym)) else us_tz
                rt = self._fetch_single_realtime(sym, tz)
                if rt:
                    quotes[sym] = rt

            missing = [s for s in required if s not in quotes]

        # FX special fallback if still missing
        fx_sym = (EXCHANGE_SYMBOL or '').upper()
        if fx_sym and (fx_sym in required) and (fx_sym not in quotes):
            fx_fb = self._fetch_fx_realtime_fallback()
            if fx_fb and fx_fb.price and fx_fb.price > 0:
                quotes[fx_sym] = fx_fb

        missing = [s for s in required if s not in quotes]
        ok = len(missing) == 0
        return ok, quotes, missing

    @contextmanager
    def atomic_realtime_context(self, required_symbols: list[str], logger=None, label: str = "atomic"):
        """Context manager to temporarily apply atomic realtime quotes.

        Usage:
            with market.atomic_realtime_context(required, logger=logger, label='user:xxx') as ok:
                snapshot = calculator.run()

        - If ok=False: no realtime quotes/fx are applied (pure EOD).
        - If ok=True: self.realtime_quotes and self.realtime_fx_rate are temporarily overridden.
        """
        prev_quotes = dict(self.realtime_quotes)
        prev_fx = self.realtime_fx_rate

        def _log_info(msg):
            if logger:
                try:
                    logger.info(msg)
                    return
                except Exception:
                    pass
            print(msg)

        def _log_warn(msg):
            if logger:
                try:
                    logger.warning(msg)
                    return
                except Exception:
                    pass
            print(msg)

        # Only require US intraday quotes when US market is open; keep TW/FX realtime always.
        required = [s.upper() for s in (required_symbols or []) if s]
        required = sorted(list(dict.fromkeys(required)))

        fx_sym = (EXCHANGE_SYMBOL or '').upper()
        need_us_rt = self._is_us_market_hours()

        fetch_set: list[str] = []
        for s in required:
            is_tw_or_fx = (s == fx_sym) or ('=' in s) or self._is_taiwan_stock(s)
            if is_tw_or_fx:
                fetch_set.append(s)
            else:
                if need_us_rt:
                    fetch_set.append(s)

        fetch_set = sorted(list(dict.fromkeys(fetch_set)))
        ok, quotes, missing = self.fetch_realtime_quotes_atomic(fetch_set, label=label)

        if ok:
            self.realtime_quotes = dict(prev_quotes)
            self.realtime_quotes.update(quotes)

            fx_sym = (EXCHANGE_SYMBOL or '').upper()
            fx_q = self.realtime_quotes.get(fx_sym) if fx_sym else None
            if fx_q and fx_q.price and fx_q.price > 0:
                self.realtime_fx_rate = self._normalize_twd_per_usd(fx_q.price)
                _log_info(f"[{label}] ✅ atomic realtime ready: quotes={len(quotes)} fx={self.realtime_fx_rate:.4f} ({fx_q.source})")
            else:
                self.realtime_fx_rate = prev_fx
                _log_info(f"[{label}] ✅ atomic realtime ready: quotes={len(quotes)} (no fx override)")
        else:
            self.realtime_fx_rate = prev_fx
            _log_warn(f"[{label}] ⚠️ atomic realtime incomplete: missing={missing} => fallback to EOD")

        try:
            yield ok
        finally:
            self.realtime_quotes = prev_quotes
            self.realtime_fx_rate = prev_fx

    def download_data(self, tickers: list, start_date, enable_realtime: bool = True):
        """下載市場數據（股票價格 + 匯率）。

        - Always downloads EOD for all tickers.
        - When enable_realtime=False: skip global realtime stage (use per-user atomic instead).
        """
        print(f"正在下載市場數據，起始日期: {start_date}...")

        is_tw_trading = self._is_taiwan_market_hours()
        is_us_trading = self._is_us_market_hours()

        if enable_realtime:
            if is_tw_trading:
                print("✅ 目前為台股交易時間，將更新台股即時報價")
            if is_us_trading:
                print("✅ 目前為美股交易時間，將更新美股即時報價")
            if (not is_tw_trading) and (not is_us_trading):
                print("⚠️ 非台股/美股交易時間，將僅使用日線收盤資料")
        else:
            print("⏭️ 已停用全域即時報價：將改由 per-user atomic realtime 取得（持倉 + benchmark + FX）。")

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

        # ==================== 2. 全域即時報價（RT，不覆蓋日線） ====================
        if enable_realtime:
            try:
                all_tickers = list(set([t for t in (tickers or []) if t] + ['SPY']))
                tw_symbols = [t for t in all_tickers if self._is_taiwan_stock((t or '').upper())]
                us_symbols = [t for t in all_tickers if (t and not self._is_taiwan_stock((t or '').upper()))]

                # TW batch + multi-interval fallback
                if is_tw_trading and tw_symbols:
                    tw_tz = pytz.timezone('Asia/Taipei')
                    target_symbols = list(set(tw_symbols))
                    print(f"[TW RT] 嘗試批量查詢 {len(target_symbols)} 檔標的...")

                    q_tw = self._fetch_intraday_prices_batch_multi(target_symbols, tw_tz, name='TW Batch')
                    success_rate = len(q_tw) / len(target_symbols) if target_symbols else 0
                    print(f"[TW RT] 批量查詢成功率: {success_rate:.1%} ({len(q_tw)}/{len(target_symbols)})")

                    for k, v in q_tw.items():
                        self.realtime_quotes[k] = v

                    # 如果成功率仍偏低，才做少量逐檔補救（降低請求量）
                    if success_rate < 0.5:
                        failed_symbols = set(s.upper() for s in target_symbols) - set(q_tw.keys())
                        if failed_symbols:
                            retry_symbols = list(failed_symbols)[:8]  # 限制補救數量
                            print(f"[TW RT] 對 {len(retry_symbols)} 檔失敗標的進行逐檔補救...")
                            retry_count = 0
                            for sym in retry_symbols:
                                rt = self._fetch_single_realtime(sym, tw_tz)
                                if rt:
                                    self.realtime_quotes[sym] = rt
                                    retry_count += 1
                            print(f"[TW RT] 逐檔補救完成: {retry_count}/{len(retry_symbols)} 成功")

                # US batch + multi-interval fallback
                if is_us_trading and us_symbols:
                    us_tz = pytz.timezone('America/New_York')
                    target_symbols = list(set(us_symbols))
                    print(f"[US RT] 嘗試批量查詢 {len(target_symbols)} 檔標的...")

                    q_us = self._fetch_intraday_prices_batch_multi(target_symbols, us_tz, name='US Batch')
                    success_rate = len(q_us) / len(target_symbols) if target_symbols else 0
                    print(f"[US RT] 批量查詢成功率: {success_rate:.1%} ({len(q_us)}/{len(target_symbols)})")

                    for k, v in q_us.items():
                        old = self.realtime_quotes.get(k)
                        if (old is None) or (v.timestamp > old.timestamp):
                            self.realtime_quotes[k] = v

                    if success_rate < 0.5:
                        failed_symbols = set(s.upper() for s in target_symbols) - set(q_us.keys())
                        failed_symbols = failed_symbols - set(self.realtime_quotes.keys())

                        if failed_symbols:
                            retry_symbols = list(failed_symbols)[:8]
                            print(f"[US RT] 對 {len(retry_symbols)} 檔失敗標的進行逐檔補救...")
                            retry_count = 0
                            for sym in retry_symbols:
                                rt = self._fetch_single_realtime(sym, us_tz)
                                if rt:
                                    self.realtime_quotes[sym] = rt
                                    retry_count += 1
                            print(f"[US RT] 逐檔補救完成: {retry_count}/{len(retry_symbols)} 成功")

                # RT summary log
                try:
                    keys = sorted(list(self.realtime_quotes.keys()))
                    preview = ', '.join(keys[:10])
                    more = f" (+{len(keys) - 10} more)" if len(keys) > 10 else ""
                    print(f"[RT] ✅ realtime_quotes={len(keys)} symbols: {preview}{more}")
                except Exception:
                    print(f"[RT] ✅ realtime_quotes={len(self.realtime_quotes)}")

                # FX fallback + 同步 realtime_fx_rate
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

        # 降低平行度以減少對資料源的壓力，提高成功率
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
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

        - 若該 date == quote.market_date，且 realtime_quotes 有該 symbol：優先回傳 quote.price
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

        - 若有 realtime quote（且 quote date == date）：回 (RT price, date)
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
        - 若 used_date 不在 index（常見：atomic realtime 用 today），上一交易日應為 pad 後的那一天（昨日收盤）。
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
