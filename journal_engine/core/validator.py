"""Portfolio result validation helpers."""

import logging
import math
from typing import Any, Dict, List

import pandas as pd

from ..models import PortfolioSnapshot


logger = logging.getLogger(__name__)


class PortfolioValidator:
    """Validate portfolio calculation and serialized snapshot consistency."""

    @staticmethod
    def validate_daily_balance(
        holdings: Dict[str, Any],
        invested_capital: float,
        current_holdings_cost_sum: float,
        tolerance: float = 0.001,
    ) -> bool:
        """Validate that open-lot cost agrees with invested capital."""
        total_cost = sum(
            holding["cost_basis_twd"]
            for holding in holdings.values()
            if holding.get("qty", 0) > 1e-6
        )

        deviation = abs(total_cost - invested_capital)
        threshold = max(abs(invested_capital) * tolerance, 100)

        if deviation > threshold:
            logger.error(
                "Balance mismatch: Holdings cost=%.2f, Invested capital=%.2f, "
                "Current holdings cost=%.2f, Deviation=%.2f (threshold=%.2f)",
                total_cost,
                invested_capital,
                current_holdings_cost_sum,
                deviation,
                threshold,
            )
            return False

        return True

    @staticmethod
    def validate_twr_calculation(history_data: List[Dict[str, Any]]) -> bool:
        """Flag unusually large single-period TWR movements."""
        if len(history_data) < 2:
            return True

        suspicious_jumps = []
        for index in range(1, len(history_data)):
            previous_twr = history_data[index - 1].get("twr", 0)
            current_twr = history_data[index].get("twr", 0)
            if abs(current_twr - previous_twr) > 50:
                suspicious_jumps.append(
                    {
                        "date": history_data[index].get("date"),
                        "prev_twr": previous_twr,
                        "curr_twr": current_twr,
                        "jump": current_twr - previous_twr,
                    }
                )

        if suspicious_jumps:
            for jump in suspicious_jumps:
                logger.warning(
                    "Suspicious TWR jump: %.2f%% -> %.2f%% on %s (jump=%.2f%%)",
                    jump["prev_twr"],
                    jump["curr_twr"],
                    jump["date"],
                    jump["jump"],
                )
            return False

        return True

    @staticmethod
    def validate_daily_pnl_breakdown(
        daily_pnl_total: float,
        tw_pnl: float,
        us_pnl: float,
        fx_pnl: float = 0.0,
        tolerance: float = 1.0,
    ) -> bool:
        """Validate that TW, US and FX components reconcile to total daily P&L."""
        expected = tw_pnl + us_pnl + fx_pnl
        deviation = abs(daily_pnl_total - expected)
        if deviation > tolerance:
            logger.error(
                "Daily PnL breakdown mismatch: Total=%.2f, "
                "TW=%.2f + US=%.2f + FX=%.2f = %.2f, Deviation=%.2f",
                daily_pnl_total,
                tw_pnl,
                us_pnl,
                fx_pnl,
                expected,
                deviation,
            )
            return False
        return True

    @staticmethod
    def validate_price_data(symbol: str, df: pd.DataFrame) -> bool:
        """Validate required price columns, finite values and positive prices."""
        if "Close_Adjusted" not in df.columns:
            logger.error("[%s] Missing Close_Adjusted column", symbol)
            return False

        if df["Close_Adjusted"].isna().any():
            logger.error(
                "[%s] %s NaN prices detected",
                symbol,
                int(df["Close_Adjusted"].isna().sum()),
            )
            return False

        if (df["Close_Adjusted"] <= 0).any():
            logger.error(
                "[%s] %s zero or negative prices detected",
                symbol,
                int((df["Close_Adjusted"] <= 0).sum()),
            )
            return False

        daily_return = df["Close_Adjusted"].pct_change()
        extreme_moves = daily_return[abs(daily_return) > 0.3]
        if len(extreme_moves) > 0:
            if "Stock Splits" in df.columns:
                split_dates = df[df["Stock Splits"] != 0].index
                extreme_non_split = extreme_moves[~extreme_moves.index.isin(split_dates)]
            else:
                extreme_non_split = extreme_moves

            if len(extreme_non_split) > 0:
                logger.warning(
                    "[%s] %s days with >30%% price moves (not split-related)",
                    symbol,
                    len(extreme_non_split),
                )

        return True

    @staticmethod
    def validate_holdings_consistency(
        holdings: Dict[str, Any],
        transactions_df: pd.DataFrame,
        tolerance: float = 0.011,
    ) -> bool:
        """Validate BUY minus SELL quantities for the union of ledger and holdings.

        Iterating only over serialized holdings misses the most dangerous failure mode:
        a newly purchased symbol can be skipped by the calculator and therefore be
        absent from the snapshot entirely.  This validator audits the union of symbols
        from both sides and treats an absent snapshot holding as quantity zero.
        """
        required_columns = {"Symbol", "Type", "Qty"}
        missing_columns = sorted(required_columns - set(transactions_df.columns))
        if missing_columns:
            logger.error(
                "Holdings validation missing required transaction columns: %s",
                ", ".join(missing_columns),
            )
            return False

        normalized = transactions_df.copy(deep=True)
        normalized["Symbol"] = normalized["Symbol"].astype(str).str.strip().str.upper()
        normalized["Type"] = normalized["Type"].astype(str).str.strip().str.upper()
        normalized["Qty"] = pd.to_numeric(normalized["Qty"], errors="coerce")

        if normalized["Qty"].isna().any() or not normalized["Qty"].map(math.isfinite).all():
            logger.error("Holdings validation contains a non-finite transaction quantity")
            return False

        normalized_holdings: Dict[str, Dict[str, Any]] = {}
        for raw_symbol, holding in holdings.items():
            symbol = str(raw_symbol).strip().upper()
            if not symbol:
                logger.error("Snapshot holdings contain an empty symbol")
                return False
            normalized_holdings[symbol] = holding

        transaction_symbols = set(normalized["Symbol"].dropna()) - {""}
        all_symbols = sorted(transaction_symbols | set(normalized_holdings))
        valid = True

        for symbol in all_symbols:
            symbol_txns = normalized[normalized["Symbol"] == symbol]
            buy_qty = float(
                symbol_txns[symbol_txns["Type"] == "BUY"]["Qty"].sum()
            )
            sell_qty = float(
                symbol_txns[symbol_txns["Type"] == "SELL"]["Qty"].sum()
            )
            expected_qty = buy_qty - sell_qty
            actual_qty = float(normalized_holdings.get(symbol, {}).get("qty", 0.0))

            if not math.isfinite(actual_qty):
                logger.error("[%s] Snapshot holding quantity is not finite", symbol)
                valid = False
                continue

            if abs(actual_qty - expected_qty) <= tolerance:
                continue

            if "Date" in symbol_txns.columns and not symbol_txns.empty:
                parsed_dates = pd.to_datetime(symbol_txns["Date"], errors="coerce").dropna()
                if not parsed_dates.empty:
                    date_range = (
                        f"{parsed_dates.min().strftime('%Y-%m-%d')}.."
                        f"{parsed_dates.max().strftime('%Y-%m-%d')}"
                    )
                else:
                    date_range = "unavailable"
            else:
                date_range = "unavailable"

            logger.error(
                "[%s] Holdings quantity mismatch: Buy=%.4f, Sell=%.4f, "
                "Expected=%.4f, Actual=%.4f, Rows=%s, Dates=%s",
                symbol,
                buy_qty,
                sell_qty,
                expected_qty,
                actual_qty,
                len(symbol_txns),
                date_range,
            )
            valid = False

        return valid

    @staticmethod
    def validate_xirr_value(value: Any) -> bool:
        """Reject non-finite or clearly corrupted serialized XIRR values."""
        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            logger.error("XIRR is not numeric")
            return False

        if not math.isfinite(numeric_value):
            logger.error("XIRR is not finite")
            return False

        if abs(numeric_value) > 1_000_000:
            logger.error("XIRR is outside the supported safety range: %.2f%%", numeric_value)
            return False

        return True

    @classmethod
    def validate_xirr_metadata(cls, summary: Any) -> bool:
        """Validate additive XIRR status/provenance while accepting legacy snapshots."""
        status = getattr(summary, "xirr_status", None)
        if status is None:
            return cls.validate_xirr_value(summary.xirr)

        if status not in {"ok", "not_applicable", "undefined"}:
            logger.error("XIRR status is invalid: %s", status)
            return False
        if not cls.validate_xirr_value(summary.xirr):
            return False

        reason = getattr(summary, "xirr_reason", None)
        conventional = getattr(summary, "xirr_cashflow_conventional", None)
        if conventional is not None and not isinstance(conventional, bool):
            logger.error("XIRR cash-flow conventional flag is not boolean")
            return False

        if status == "ok":
            if reason not in (None, ""):
                logger.error("Successful XIRR must not carry an error reason")
                return False
            asof_date = getattr(summary, "xirr_asof_date", None)
            if not asof_date:
                logger.error("Successful XIRR is missing its valuation as-of date")
                return False
            try:
                if pd.isna(pd.Timestamp(asof_date)):
                    raise ValueError("NaT")
            except Exception:
                logger.error("Successful XIRR has an invalid as-of date")
                return False
            return True

        try:
            numeric_value = float(summary.xirr)
        except (TypeError, ValueError):
            numeric_value = math.nan
        if not math.isfinite(numeric_value) or abs(numeric_value) > 1e-12:
            logger.error("Unavailable XIRR must use the legacy numeric 0.0 sentinel")
            return False
        if not isinstance(reason, str) or not reason.strip():
            logger.error("Unavailable XIRR is missing a machine-readable reason")
            return False
        return True

    @classmethod
    def validate_snapshot_for_upload(
        cls,
        snapshot: PortfolioSnapshot,
        transactions_df: pd.DataFrame,
    ) -> bool:
        """Run blocking checks immediately before a snapshot upload."""
        valid = True

        if snapshot is None:
            logger.error("Snapshot is missing")
            return False

        if "all" not in snapshot.groups:
            logger.error("Snapshot is missing the required 'all' group")
            valid = False

        if not snapshot.updated_at:
            logger.error("Snapshot updated_at is empty")
            valid = False

        if not math.isfinite(float(snapshot.exchange_rate)) or snapshot.exchange_rate <= 0:
            logger.error("Snapshot exchange rate is invalid")
            valid = False

        summaries = [("root", snapshot.summary)]
        summaries.extend(
            (f"group:{group_name}", group_data.summary)
            for group_name, group_data in snapshot.groups.items()
        )
        numeric_fields = (
            "total_value",
            "invested_capital",
            "total_pnl",
            "twr",
            "xirr",
            "realized_pnl",
            "benchmark_twr",
            "daily_pnl_twd",
        )

        for label, summary in summaries:
            for field_name in numeric_fields:
                value = getattr(summary, field_name)
                try:
                    is_finite = math.isfinite(float(value))
                except (TypeError, ValueError):
                    is_finite = False
                if not is_finite:
                    logger.error("%s summary field %s is not finite", label, field_name)
                    valid = False
            if not cls.validate_xirr_metadata(summary):
                logger.error("%s summary contains inconsistent XIRR metadata", label)
                valid = False

        if not transactions_df.empty and not snapshot.history:
            logger.error("Non-empty transactions produced an empty history")
            valid = False

        breakdown = snapshot.summary.daily_pnl_breakdown or {}
        if breakdown and not cls.validate_daily_pnl_breakdown(
            snapshot.summary.daily_pnl_twd,
            float(breakdown.get("tw_pnl_twd", 0.0)),
            float(breakdown.get("us_pnl_twd", 0.0)),
            float(breakdown.get("fx_pnl_twd", 0.0)),
            tolerance=2.0,
        ):
            valid = False

        holdings = {holding.symbol: holding.model_dump() for holding in snapshot.holdings}
        if not cls.validate_holdings_consistency(holdings, transactions_df):
            valid = False

        for holding in snapshot.holdings:
            values = (
                holding.qty,
                holding.market_value_twd,
                holding.pnl_twd,
                holding.pnl_percent,
                holding.current_price_origin,
            )
            if not all(math.isfinite(float(value)) for value in values):
                logger.error("[%s] Holding contains a non-finite value", holding.symbol)
                valid = False
            if holding.qty < -0.011:
                logger.error("[%s] Holding quantity is negative", holding.symbol)
                valid = False

        return valid
