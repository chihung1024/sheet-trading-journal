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
        """Validate open quantities against BUY minus SELL transactions."""
        for symbol, holding in holdings.items():
            symbol_txns = transactions_df[transactions_df["Symbol"] == symbol]
            buy_qty = symbol_txns[symbol_txns["Type"] == "BUY"]["Qty"].sum()
            sell_qty = symbol_txns[symbol_txns["Type"] == "SELL"]["Qty"].sum()
            expected_qty = buy_qty - sell_qty
            actual_qty = holding.get("qty", 0)

            if abs(actual_qty - expected_qty) > tolerance:
                logger.error(
                    "[%s] Holdings quantity mismatch: Expected=%.4f, Actual=%.4f",
                    symbol,
                    expected_qty,
                    actual_qty,
                )
                return False

        return True

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
            if not cls.validate_xirr_value(summary.xirr):
                logger.error("%s summary contains invalid XIRR", label)
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
        if holdings and not cls.validate_holdings_consistency(holdings, transactions_df):
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
