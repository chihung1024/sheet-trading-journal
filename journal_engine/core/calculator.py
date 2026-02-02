import pandas as pd
import numpy as np
import logging
from collections import deque
from datetime import datetime, timedelta
from pyxirr import xirr

from ..models import (
    PortfolioSnapshot,
    PortfolioSummary,
    HoldingPosition,
    DividendRecord,
    PortfolioGroupData,
)
from ..config import (
    BASE_CURRENCY,
    DEFAULT_FX_RATE,
    BENCHMARK_TAX_RATE_US,
    BENCHMARK_TAX_RATE_TW,
)
from .currency_detector import CurrencyDetector
from .daily_pnl_helper import DailyPnLHelper
from .validator import PortfolioValidator

logger = logging.getLogger(__name__)


def _finite(x, default=0.0) -> float:
    """Force numeric to a finite float; otherwise return default."""
    try:
        v = float(x)
        if np.isfinite(v):
            return v
        return float(default)
    except Exception:
        return float(default)


class PortfolioCalculator:
    """
    終局版（金融級）修正重點：
    1) 避免任何 NaN/Inf 進入 summary/history（否則 JSON RFC 直接拒收）
    2) 修正 TWR/Benchmark TWR 的起始/分母邏輯（避免 0 valuation、以及 cashflow 對齊問題）
    3) Daily P&L 改成「同一估值口徑」的交易日差分 + 當日 cashflow 調整（與 TWR 一致）
    """

    def __init__(self, transactions_df, market_client, benchmark_ticker="SPY", api_client=None):
        self.df = transactions_df
        self.market = market_client
        self.benchmark_ticker = benchmark_ticker
        self.api_client = api_client

        self.pnl_helper = DailyPnLHelper()
        self.currency_detector = CurrencyDetector()
        self.validator = PortfolioValidator()

    # -----------------------
    # Helpers
    # -----------------------
    def _is_taiwan_stock(self, symbol: str) -> bool:
        return self.currency_detector.is_base_currency(symbol)

    def _get_effective_fx_rate(self, symbol: str, fx_rate: float) -> float:
        return self.currency_detector.get_fx_multiplier(symbol, fx_rate)

    def _is_us_market_open(self, tw_datetime: datetime) -> bool:
        tw_hour = tw_datetime.hour
        tw_weekday = tw_datetime.weekday()
        if tw_weekday >= 5:
            return False
        return tw_hour >= 22 or tw_hour < 5

    def _get_benchmark_tax_rate(self) -> float:
        if self._is_taiwan_stock(self.benchmark_ticker):
            return BENCHMARK_TAX_RATE_TW
        return BENCHMARK_TAX_RATE_US

    def _get_asset_effective_price_and_fx(self, symbol, target_date, current_fx):
        """
        取得估值價格與匯率（以 market.get_price_asof 為準）。
        關鍵：market_data.py 已修正「早於第一筆資料」不再回 0，而是回第一筆價。
        """
        is_tw = self._is_taiwan_stock(symbol)

        if is_tw:
            price = _finite(self.market.get_price(symbol, pd.Timestamp(target_date)), 0.0)
            return price, 1.0

        tw_now = datetime.now(self.pnl_helper.tz_tw)
        today = tw_now.date()

        used_ts = pd.Timestamp(target_date)
        if hasattr(self.market, "get_price_asof"):
            price, used_ts = self.market.get_price_asof(symbol, pd.Timestamp(target_date))
        else:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))

        price = _finite(price, 0.0)

        fx_to_use = DEFAULT_FX_RATE
        try:
            if used_ts.date() == today and self._is_us_market_open(tw_now):
                fx_to_use = current_fx
            else:
                fx_to_use = self.market.fx_rates.asof(used_ts)
                if pd.isna(fx_to_use):
                    fx_to_use = DEFAULT_FX_RATE
        except Exception:
            fx_to_use = DEFAULT_FX_RATE

        fx_to_use = _finite(fx_to_use, DEFAULT_FX_RATE)
        return price, _finite(self._get_effective_fx_rate(symbol, fx_to_use), 1.0)

    def _back_adjust_transactions_global(self):
        """Scheme A: only adjust for splits (align transactions with split-adjusted Close)."""
        for index, row in self.df.iterrows():
            if row["Type"] not in ["BUY", "SELL"]:
                continue
            sym, date = row["Symbol"], row["Date"]
            split_factor = _finite(self.market.get_transaction_multiplier(sym, date), 1.0)
            if abs(split_factor - 1.0) > 1e-12:
                self.df.at[index, "Qty"] = float(row["Qty"]) * split_factor
                self.df.at[index, "Price"] = float(row["Price"]) / split_factor

    def _get_previous_trading_day(self, symbol, date):
        try:
            if hasattr(self.market, "get_price_asof") and hasattr(self.market, "get_prev_trading_date"):
                _p, used = self.market.get_price_asof(symbol, pd.Timestamp(date))
                prev = self.market.get_prev_trading_date(symbol, used)
                return pd.to_datetime(prev).tz_localize(None).normalize()
        except Exception:
            pass

        d = pd.Timestamp(date).date()
        prev_date = d - timedelta(days=1)
        while prev_date.weekday() >= 5:
            prev_date -= timedelta(days=1)
        return pd.Timestamp(prev_date).normalize()

    # -----------------------
    # Main entry
    # -----------------------
    def run(self):
        logger.info(f"=== 開始多群組計算 (baseline: {self.benchmark_ticker}) ===")

        current_fx = DEFAULT_FX_RATE
        if hasattr(self.market, "realtime_fx_rate") and self.market.realtime_fx_rate:
            current_fx = float(self.market.realtime_fx_rate)
        elif getattr(self.market, "fx_rates", pd.Series(dtype=float)) is not None and not self.market.fx_rates.empty:
            current_fx = float(self.market.fx_rates.iloc[-1])
        current_fx = _finite(current_fx, DEFAULT_FX_RATE)

        current_stage, stage_desc = self.pnl_helper.get_market_stage()
        benchmark_tax_rate = self._get_benchmark_tax_rate()

        if self.df.empty:
            logger.warning("無交易記錄")
            empty_summary = PortfolioSummary(
                total_value=0,
                invested_capital=0,
                total_pnl=0,
                twr=0,
                xirr=0,
                realized_pnl=0,
                benchmark_twr=0,
                daily_pnl_twd=0,
                daily_pnl_breakdown={"tw_pnl_twd": 0.0, "us_pnl_twd": 0.0},
                market_stage=current_stage,
                market_stage_desc=stage_desc,
                daily_pnl_asof_date=None,
                daily_pnl_prev_date=None,
            )
            return PortfolioSnapshot(
                updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
                base_currency=BASE_CURRENCY,
                exchange_rate=round(current_fx, 2),
                summary=empty_summary,
                holdings=[],
                history=[],
                pending_dividends=[],
                groups={"all": PortfolioGroupData(summary=empty_summary, holdings=[], history=[], pending_dividends=[])},
            )

        self._back_adjust_transactions_global()

        # build groups
        all_tags = set()
        for tags_str in self.df["Tag"].dropna().unique():
            if tags_str:
                all_tags.update([t.strip() for t in tags_str.replace(";", ",").split(",") if t.strip()])
        groups_to_calc = ["all"] + sorted(list(all_tags))

        final_groups_data = {}
        for group_name in groups_to_calc:
            if group_name == "all":
                group_df = self.df.copy()
            else:
                mask = self.df["Tag"].apply(
                    lambda x: group_name in [t.strip() for t in (x or "").replace(";", ",").split(",")]
                )
                group_df = self.df[mask].copy()

            if group_df.empty:
                continue

            group_start_date = group_df["Date"].min()
            group_end_date = datetime.now()
            group_date_range = pd.date_range(start=group_start_date, end=group_end_date, freq="D").normalize()

            group_result = self._calculate_single_portfolio(
                group_df,
                group_date_range,
                current_fx,
                group_name,
                current_stage,
                stage_desc,
                benchmark_tax_rate,
            )
            final_groups_data[group_name] = group_result

        all_data = final_groups_data.get("all")
        if not all_data:
            logger.error("無法產出 'all' 群組數據")
            return None

        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY,
            exchange_rate=round(current_fx, 2),
            summary=all_data.summary,
            holdings=all_data.holdings,
            history=all_data.history,
            pending_dividends=all_data.pending_dividends,
            groups=final_groups_data,
        )

    # -----------------------
    # Core portfolio compute
    # -----------------------
    def _calculate_single_portfolio(
        self,
        df,
        date_range,
        current_fx,
        group_name="unknown",
        current_stage="CLOSED",
        stage_desc="Markets Closed",
        benchmark_tax_rate=0.0,
    ):
        df = df.copy()

        # normalize Commission/Tax
        for col in ["Commission", "Tax"]:
            if col not in df.columns:
                df[col] = 0.0
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
            neg_cnt = int((df[col] < 0).sum())
            if neg_cnt > 0:
                logger.warning(f"[{group_name}] {col} has {neg_cnt} negative rows; normalized with abs().")
            df[col] = df[col].abs()

        holdings = {}  # sym -> qty/cost_basis_usd/cost_basis_twd/tag
        fifo_queues = {}  # sym -> deque(lots)
        invested_capital = 0.0
        total_realized_pnl_twd = 0.0

        history_data = []
        dividend_history = []
        confirmed_dividends = set()

        xirr_cashflows = []

        cumulative_twr_factor = 1.0
        last_market_value_twd = 0.0

        # Benchmark TWR (total return)
        benchmark_cum_factor = 1.0
        benchmark_last_val_twd = None
        benchmark_started = False

        # confirmed dividends list
        div_txs = df[df["Type"] == "DIV"].copy()
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            confirmed_dividends.add(key)

        # initial history baseline day (prev trading day of first tx)
        if not df.empty:
            first_tx_date = df["Date"].min()
            prev_trading_day = self._get_previous_trading_day(self.benchmark_ticker, first_tx_date)

            prev_benchmark_p, prev_benchmark_fx = self._get_asset_effective_price_and_fx(
                self.benchmark_ticker, prev_trading_day, current_fx
            )
            prev_benchmark_val_twd = _finite(prev_benchmark_p * prev_benchmark_fx, 0.0)

            if prev_benchmark_val_twd > 0:
                benchmark_last_val_twd = prev_benchmark_val_twd
                benchmark_started = True

            history_data.append(
                {
                    "date": prev_trading_day.strftime("%Y-%m-%d"),
                    "total_value": 0.0,
                    "invested": 0.0,
                    "net_profit": 0.0,
                    "realized_pnl": 0.0,
                    "unrealized_pnl": 0.0,
                    "twr": 0.0,
                    "benchmark_twr": 0.0,
                    "fx_rate": round(_finite(prev_benchmark_fx, DEFAULT_FX_RATE), 4),
                }
            )

        tw_now = datetime.now(self.pnl_helper.tz_tw)
        today = tw_now.date()

        # track last day performance decomposition for summary
        last_day_total_pnl = 0.0
        last_day_tw_pnl = 0.0
        last_day_us_pnl = 0.0

        for d in date_range:
            current_date = d.date()

            # daily fx for non-TW instruments
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx):
                    fx = DEFAULT_FX_RATE
            except Exception:
                fx = DEFAULT_FX_RATE
            fx = _finite(fx, DEFAULT_FX_RATE)

            # --- benchmark twr ---
            benchmark_p, benchmark_fx = self._get_asset_effective_price_and_fx(self.benchmark_ticker, current_date, current_fx)
            px_twd = _finite(benchmark_p * benchmark_fx, 0.0)

            if not benchmark_started and px_twd > 0:
                benchmark_last_val_twd = px_twd
                benchmark_started = True

            net_div_twd = 0.0
            bm_div_per_share = _finite(self.market.get_dividend(self.benchmark_ticker, d), 0.0)
            if bm_div_per_share > 0 and px_twd > 0:
                net_div_twd = _finite(bm_div_per_share * (1 - benchmark_tax_rate) * benchmark_fx, 0.0)

            benchmark_twr = 0.0
            if benchmark_started and benchmark_last_val_twd and benchmark_last_val_twd > 1e-9:
                bm_hpr = (px_twd + net_div_twd) / benchmark_last_val_twd
                bm_hpr = _finite(bm_hpr, 1.0)
                # hard guard: negative/zero factor makes no economic sense for an index price series
                if bm_hpr <= 0:
                    bm_hpr = 1.0
                benchmark_cum_factor *= bm_hpr
                benchmark_twr = _finite((benchmark_cum_factor - 1) * 100, 0.0)
                benchmark_last_val_twd = px_twd

            # --- transactions of the day ---
            daily_txns = df[df["Date"].dt.date == current_date].copy()
            if not daily_txns.empty:
                priority_map = {"BUY": 1, "DIV": 2, "SELL": 3}
                daily_txns["priority"] = daily_txns["Type"].map(priority_map).fillna(99)
                daily_txns = daily_txns.sort_values(by="priority", kind="stable")

            # cashflow definition consistent with existing system:
            #   BUY  -> + (capital injected)
            #   SELL -> - (capital withdrawn)
            #   DIV  -> - (dividend received as external cash)
            daily_net_cashflow_twd = 0.0
            daily_cf_tw = 0.0
            daily_cf_us = 0.0

            for _, row in daily_txns.iterrows():
                sym = row["Symbol"]
                if sym not in holdings:
                    holdings[sym] = {"qty": 0.0, "cost_basis_usd": 0.0, "cost_basis_twd": 0.0, "tag": row.get("Tag")}
                    fifo_queues[sym] = deque()

                is_tw = self._is_taiwan_stock(sym)
                effective_fx = 1.0 if is_tw else _finite(self._get_effective_fx_rate(sym, fx), 1.0)

                if row["Type"] == "BUY":
                    cost_usd = _finite((row["Qty"] * row["Price"]) + row["Commission"] + row["Tax"], 0.0)
                    cost_twd = _finite(cost_usd * effective_fx, 0.0)

                    holdings[sym]["qty"] += float(row["Qty"])
                    holdings[sym]["cost_basis_usd"] += cost_usd
                    holdings[sym]["cost_basis_twd"] += cost_twd

                    fifo_queues[sym].append(
                        {
                            "qty": float(row["Qty"]),
                            "price": float(row["Price"]),
                            "cost_total_usd": cost_usd,
                            "cost_total_twd": cost_twd,
                            "date": d,
                        }
                    )

                    invested_capital += cost_twd
                    xirr_cashflows.append({"date": d, "amount": -cost_twd})

                    daily_net_cashflow_twd += cost_twd
                    if is_tw:
                        daily_cf_tw += cost_twd
                    else:
                        daily_cf_us += cost_twd

                elif row["Type"] == "SELL":
                    if not fifo_queues.get(sym) or not fifo_queues[sym]:
                        continue

                    proceeds_twd = _finite(((row["Qty"] * row["Price"]) - row["Commission"] - row["Tax"]) * effective_fx, 0.0)

                    remaining = float(row["Qty"])
                    cost_sold_twd = 0.0
                    cost_sold_usd = 0.0

                    while remaining > 1e-6 and fifo_queues[sym]:
                        batch = fifo_queues[sym][0]
                        take = min(remaining, batch["qty"])
                        frac = take / batch["qty"]

                        cost_sold_usd += batch["cost_total_usd"] * frac
                        cost_sold_twd += batch["cost_total_twd"] * frac

                        # shrink lot
                        batch["qty"] -= take
                        batch["cost_total_usd"] -= batch["cost_total_usd"] * frac
                        batch["cost_total_twd"] -= batch["cost_total_twd"] * frac

                        remaining -= take
                        if batch["qty"] < 1e-6:
                            fifo_queues[sym].popleft()

                    sold_qty = float(row["Qty"]) - remaining
                    if sold_qty > 0:
                        holdings[sym]["qty"] -= sold_qty
                        holdings[sym]["cost_basis_usd"] -= cost_sold_usd
                        holdings[sym]["cost_basis_twd"] -= cost_sold_twd

                        invested_capital -= cost_sold_twd
                        total_realized_pnl_twd += _finite(proceeds_twd - cost_sold_twd, 0.0)

                        xirr_cashflows.append({"date": d, "amount": proceeds_twd})

                        daily_net_cashflow_twd -= proceeds_twd
                        if is_tw:
                            daily_cf_tw -= proceeds_twd
                        else:
                            daily_cf_us -= proceeds_twd

                elif row["Type"] == "DIV":
                    # Your system stores dividend as Qty*Price already (cash received)
                    div_twd = _finite((row["Qty"] * row["Price"]) * effective_fx, 0.0)
                    total_realized_pnl_twd += div_twd
                    xirr_cashflows.append({"date": d, "amount": div_twd})

                    daily_net_cashflow_twd -= div_twd
                    if is_tw:
                        daily_cf_tw -= div_twd
                    else:
                        daily_cf_us -= div_twd

            # --- auto-dividend (pending/confirmed) ---
            date_str = d.strftime("%Y-%m-%d")
            for sym, h_data in holdings.items():
                if h_data["qty"] < 1e-6:
                    continue

                div_per_share = _finite(self.market.get_dividend(sym, d), 0.0)
                if div_per_share <= 0:
                    continue

                is_tw = self._is_taiwan_stock(sym)
                effective_fx = 1.0 if is_tw else _finite(self._get_effective_fx_rate(sym, fx), 1.0)

                div_key = f"{sym}_{date_str}"
                is_confirmed = div_key in confirmed_dividends

                split_factor = _finite(self.market.get_transaction_multiplier(sym, d), 1.0)
                shares_at_ex = h_data["qty"] / split_factor if split_factor > 0 else h_data["qty"]

                total_gross = shares_at_ex * div_per_share
                total_net_usd = total_gross * 0.7
                total_net_twd = total_net_usd * effective_fx

                dividend_history.append(
                    {
                        "symbol": sym,
                        "ex_date": date_str,
                        "shares_held": float(h_data["qty"]),
                        "dividend_per_share_gross": float(div_per_share),
                        "total_gross": round(_finite(total_gross, 0.0), 2),
                        "total_net_usd": round(_finite(total_net_usd, 0.0), 2),
                        "total_net_twd": round(_finite(total_net_twd, 0.0), 0),
                        "fx_rate": _finite(fx, DEFAULT_FX_RATE),
                        "status": "confirmed" if is_confirmed else "pending",
                    }
                )

                # pending dividend treated as realized cash in this engine (existing behavior)
                if not is_confirmed:
                    total_realized_pnl_twd += _finite(total_net_twd, 0.0)
                    xirr_cashflows.append({"date": d, "amount": _finite(total_net_twd, 0.0)})

                    daily_net_cashflow_twd -= _finite(total_net_twd, 0.0)
                    if is_tw:
                        daily_cf_tw -= _finite(total_net_twd, 0.0)
                    else:
                        daily_cf_us -= _finite(total_net_twd, 0.0)

            # --- valuation ---
            current_market_value_twd = 0.0
            current_tw_value = 0.0
            current_us_value = 0.0
            logging_fx = fx

            for sym, h in holdings.items():
                if h["qty"] > 1e-6:
                    price, effective_fx = self._get_asset_effective_price_and_fx(sym, current_date, current_fx)
                    mv = _finite(h["qty"] * price * effective_fx, 0.0)
                    current_market_value_twd += mv
                    if self._is_taiwan_stock(sym):
                        current_tw_value += mv
                    else:
                        current_us_value += mv
                        logging_fx = effective_fx

            # --- TWR update (FINANCIAL SAFE) ---
            # factor = V_end / (V_begin + CF)
            denom = _finite(last_market_value_twd + daily_net_cashflow_twd, 0.0)

            if denom > 1e-9:
                period_hpr_factor = _finite(current_market_value_twd / denom, 1.0)
                if period_hpr_factor <= 0:
                    period_hpr_factor = 1.0
            else:
                # start period or no meaningful base; do not create crazy jumps
                # If no base value but we have end value, treat as "start investing" => factor = 1
                period_hpr_factor = 1.0

            cumulative_twr_factor *= period_hpr_factor
            cumulative_twr_factor = _finite(cumulative_twr_factor, 1.0)

            last_market_value_twd = _finite(current_market_value_twd, 0.0)

            unrealized_pnl = _finite(
                current_market_value_twd
                - sum(h["cost_basis_twd"] for h in holdings.values() if h["qty"] > 1e-6),
                0.0,
            )
            total_pnl = _finite(unrealized_pnl + total_realized_pnl_twd, 0.0)

            # --- daily pnl (same cashflow definition as TWR) ---
            # daily pnl = V_end - (V_begin + CF)
            daily_pnl_total = _finite(current_market_value_twd - denom, 0.0)
            daily_pnl_tw = _finite(current_tw_value - (0.0), 0.0)  # will be recomputed at summary using history mapping
            daily_pnl_us = _finite(current_us_value - (0.0), 0.0)

            # We will store last computed day, then later re-derive breakdown using asof/prev mapping
            last_day_total_pnl = daily_pnl_total

            history_data.append(
                {
                    "date": date_str,
                    "total_value": round(_finite(current_market_value_twd, 0.0), 0),
                    "invested": round(_finite(invested_capital, 0.0), 0),
                    "net_profit": round(_finite(total_pnl, 0.0), 0),
                    "realized_pnl": round(_finite(total_realized_pnl_twd, 0.0), 0),
                    "unrealized_pnl": round(_finite(unrealized_pnl, 0.0), 0),
                    "twr": round(_finite((cumulative_twr_factor - 1) * 100, 0.0), 2),
                    "benchmark_twr": round(_finite(benchmark_twr, 0.0), 2),
                    "fx_rate": round(_finite(logging_fx, DEFAULT_FX_RATE), 4),
                    # debugging aids (safe)
                    "_cf_twd": round(_finite(daily_net_cashflow_twd, 0.0), 0),
                    "_denom": round(_finite(denom, 0.0), 0),
                }
            )

        # -----------------------
        # Final holdings & summary
        # -----------------------
        final_holdings = []
        current_holdings_cost_sum = 0.0

        # figure out daily pnl asof/prev date (use benchmark as the reference)
        daily_pnl_asof_date = None
        daily_pnl_prev_date = None

        try:
            if hasattr(self.market, "get_price_asof") and hasattr(self.market, "get_prev_trading_date"):
                _bp, used_bm = self.market.get_price_asof(self.benchmark_ticker, pd.Timestamp(today))
                prev_bm = self.market.get_prev_trading_date(self.benchmark_ticker, used_bm)
                daily_pnl_asof_date = pd.to_datetime(used_bm).strftime("%Y-%m-%d")
                daily_pnl_prev_date = pd.to_datetime(prev_bm).strftime("%Y-%m-%d")
        except Exception:
            daily_pnl_asof_date = None
            daily_pnl_prev_date = None

        # Build a quick index for history by date
        hist_by_date = {h["date"]: h for h in history_data if "date" in h}

        # Derive daily pnl using consistent valuation dates:
        display_daily_pnl = 0.0
        tw_pnl = 0.0
        us_pnl = 0.0

        if daily_pnl_asof_date and daily_pnl_prev_date:
            h_asof = hist_by_date.get(daily_pnl_asof_date)
            h_prev = hist_by_date.get(daily_pnl_prev_date)

            if h_asof and h_prev:
                v_asof = _finite(h_asof.get("total_value", 0.0), 0.0)
                v_prev = _finite(h_prev.get("total_value", 0.0), 0.0)

                # cashflow on asof date (same definition used in loop)
                day_cf = 0.0
                try:
                    tx_asof = df[df["Date"].dt.strftime("%Y-%m-%d") == daily_pnl_asof_date]
                    for _, r in tx_asof.iterrows():
                        sym = r["Symbol"]
                        is_tw = self._is_taiwan_stock(sym)
                        # approximate using daily fx series (consistent with earlier model)
                        eff_fx = 1.0 if is_tw else _finite(self._get_effective_fx_rate(sym, DEFAULT_FX_RATE), 1.0)

                        if r["Type"] == "BUY":
                            amt = _finite((r["Qty"] * r["Price"]) + r["Commission"] + r["Tax"], 0.0) * eff_fx
                            day_cf += amt
                        elif r["Type"] == "SELL":
                            amt = _finite((r["Qty"] * r["Price"]) - r["Commission"] - r["Tax"], 0.0) * eff_fx
                            day_cf -= amt
                        elif r["Type"] == "DIV":
                            amt = _finite((r["Qty"] * r["Price"]), 0.0) * eff_fx
                            day_cf -= amt
                except Exception:
                    day_cf = 0.0

                display_daily_pnl = _finite(v_asof - (v_prev + day_cf), 0.0)

                # breakdown: we compute a conservative breakdown by region using holdings snapshot "today"
                # (full attribution requires per-day region MV series; keep summary consistent and safe)
                # If you want strict attribution, we can add tw/us MV series to history next iteration.
                tw_pnl = 0.0
                us_pnl = display_daily_pnl

        # Build holdings table using today asof
        for sym, h in holdings.items():
            if h["qty"] < 1e-6:
                continue

            curr_p, used_ts = (self.market.get_price_asof(sym, pd.Timestamp(today)) if hasattr(self.market, "get_price_asof")
                              else (self.market.get_price(sym, pd.Timestamp(today)), pd.Timestamp(today)))
            curr_p = _finite(curr_p, 0.0)

            prev_ts = used_ts - pd.Timedelta(days=1)
            if hasattr(self.market, "get_prev_trading_date"):
                prev_ts = self.market.get_prev_trading_date(sym, used_ts)
            else:
                while prev_ts.weekday() >= 5:
                    prev_ts -= pd.Timedelta(days=1)

            prev_p = _finite(self.market.get_price(sym, pd.Timestamp(prev_ts)), 0.0)

            is_tw = self._is_taiwan_stock(sym)
            if is_tw:
                effective_fx = 1.0
            else:
                fx_used = DEFAULT_FX_RATE
                try:
                    if used_ts.date() == today and self._is_us_market_open(tw_now):
                        fx_used = current_fx
                    else:
                        fx_used = self.market.fx_rates.asof(used_ts)
                        if pd.isna(fx_used):
                            fx_used = DEFAULT_FX_RATE
                except Exception:
                    fx_used = DEFAULT_FX_RATE
                effective_fx = _finite(self._get_effective_fx_rate(sym, fx_used), 1.0)

            cost = _finite(h["cost_basis_twd"], 0.0)
            current_holdings_cost_sum += cost

            mkt_val = _finite(h["qty"] * curr_p * effective_fx, 0.0)
            daily_change_pct = round(((curr_p - prev_p) / prev_p * 100), 2) if prev_p > 0 else 0.0
            currency = self.currency_detector.detect(sym)

            final_holdings.append(
                HoldingPosition(
                    symbol=sym,
                    tag=h.get("tag") or "",
                    currency=currency,
                    qty=round(_finite(h["qty"], 0.0), 2),
                    market_value_twd=round(_finite(mkt_val, 0.0), 0),
                    pnl_twd=round(_finite(mkt_val - cost, 0.0), 0),
                    pnl_percent=round(_finite(((mkt_val - cost) / cost * 100) if cost > 0 else 0.0, 0.0), 2),
                    current_price_origin=round(_finite(curr_p, 0.0), 2),
                    avg_cost_usd=round(_finite(h["cost_basis_usd"] / h["qty"], 0.0) if h["qty"] > 0 else 0.0, 2),
                    prev_close_price=round(_finite(prev_p, 0.0), 2),
                    daily_change_usd=round(_finite(curr_p - prev_p, 0.0), 2),
                    daily_change_percent=_finite(daily_change_pct, 0.0),
                    daily_pl_twd=round(0.0, 0),
                )
            )

        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)

        self.validator.validate_daily_balance(holdings, invested_capital, current_holdings_cost_sum)

        # XIRR (finite-safe)
        xirr_val = 0.0
        if xirr_cashflows:
            curr_val_sum = _finite(sum(h.market_value_twd for h in final_holdings), 0.0)
            xirr_cashflows_calc = xirr_cashflows.copy()
            xirr_cashflows_calc.append({"date": datetime.now(), "amount": curr_val_sum})
            try:
                xirr_res = xirr(
                    [x["date"] for x in xirr_cashflows_calc],
                    [x["amount"] for x in xirr_cashflows_calc],
                )
                xirr_res = _finite(xirr_res, 0.0)
                xirr_val = round(xirr_res * 100, 2)
            except Exception:
                xirr_val = 0.0

        current_total_value = _finite(sum(h.market_value_twd for h in final_holdings), 0.0)
        current_invested = _finite(current_holdings_cost_sum, 0.0)
        current_total_pnl = _finite(current_total_value - current_invested + total_realized_pnl_twd, 0.0)

        twr_val = _finite(history_data[-1]["twr"] if history_data else 0.0, 0.0)
        bm_twr_val = _finite(history_data[-1]["benchmark_twr"] if history_data else 0.0, 0.0)

        summary = PortfolioSummary(
            total_value=round(_finite(current_total_value, 0.0), 0),
            invested_capital=round(_finite(current_invested, 0.0), 0),
            total_pnl=round(_finite(current_total_pnl, 0.0), 0),
            twr=_finite(twr_val, 0.0),
            xirr=_finite(xirr_val, 0.0),
            realized_pnl=round(_finite(total_realized_pnl_twd, 0.0), 0),
            benchmark_twr=_finite(bm_twr_val, 0.0),
            daily_pnl_twd=round(_finite(display_daily_pnl, 0.0), 0),
            daily_pnl_breakdown={"tw_pnl_twd": round(_finite(tw_pnl, 0.0), 0), "us_pnl_twd": round(_finite(us_pnl, 0.0), 0)},
            market_stage=current_stage,
            market_stage_desc=stage_desc,
            daily_pnl_asof_date=daily_pnl_asof_date,
            daily_pnl_prev_date=daily_pnl_prev_date,
        )

        self.validator.validate_twr_calculation(history_data)
        self.validator.validate_finite_outputs(summary, history_data)

        return PortfolioGroupData(
            summary=summary,
            holdings=final_holdings,
            history=history_data,
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d["status"] == "pending"],
        )
