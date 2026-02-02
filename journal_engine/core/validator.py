"""
PortfolioValidator - 投資組合驗證器（終局版）
"""

import logging
import math
import pandas as pd
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class PortfolioValidator:
    @staticmethod
    def validate_daily_balance(
        holdings: Dict[str, Any],
        invested_capital: float,
        market_value: float,
        tolerance: float = 0.001,
    ) -> bool:
        total_cost = sum(
            h["cost_basis_twd"] for h in holdings.values() if h.get("qty", 0) > 1e-6
        )

        deviation = abs(total_cost - invested_capital)
        threshold = max(invested_capital * tolerance, 100)

        if deviation > threshold:
            logger.error(
                f"Balance mismatch: Holdings cost={total_cost:.2f}, "
                f"Invested capital={invested_capital:.2f}, "
                f"Deviation={deviation:.2f} (threshold={threshold:.2f})"
            )
            return False
        return True

    @staticmethod
    def validate_twr_calculation(history_data: List[Dict[str, Any]]) -> bool:
        if len(history_data) < 2:
            return True

        suspicious_jumps = []
        for i in range(1, len(history_data)):
            prev_twr = history_data[i - 1].get("twr", 0)
            curr_twr = history_data[i].get("twr", 0)

            try:
                prev_twr = float(prev_twr)
                curr_twr = float(curr_twr)
            except Exception:
                continue

            if abs(curr_twr - prev_twr) > 50:
                suspicious_jumps.append(
                    {
                        "date": history_data[i].get("date"),
                        "prev_twr": prev_twr,
                        "curr_twr": curr_twr,
                        "jump": curr_twr - prev_twr,
                    }
                )

        if suspicious_jumps:
            for jump in suspicious_jumps:
                logger.warning(
                    f"Suspicious TWR jump: {jump['prev_twr']:.2f}% → {jump['curr_twr']:.2f}% "
                    f"on {jump['date']} (jump={jump['jump']:.2f}%)"
                )
            return False

        return True

    @staticmethod
    def validate_price_data(symbol: str, df: pd.DataFrame) -> bool:
        if "Close_Adjusted" not in df.columns:
            logger.error(f"[{symbol}] Missing Close_Adjusted column")
            return False

        if df["Close_Adjusted"].isna().any():
            nan_count = df["Close_Adjusted"].isna().sum()
            logger.error(f"[{symbol}] {nan_count} NaN prices detected")
            return False

        if (df["Close_Adjusted"] <= 0).any():
            zero_count = (df["Close_Adjusted"] <= 0).sum()
            logger.error(f"[{symbol}] {zero_count} zero or negative prices detected")
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
                    f"[{symbol}] {len(extreme_non_split)} days with >30% price moves (not split-related)"
                )
        return True

    @staticmethod
    def validate_finite_outputs(summary, history_data: List[Dict[str, Any]]) -> bool:
        """
        終局保證：任何輸出給 API 的數值必須是 JSON-safe (finite)。
        若發現 NaN/Inf，直接 log 路徑，方便你追根因。
        """
        ok = True

        def _is_bad(v):
            try:
                if v is None:
                    return False
                x = float(v)
                return math.isnan(x) or math.isinf(x)
            except Exception:
                return False

        # summary fields
        for k, v in summary.model_dump().items():
            if isinstance(v, dict):
                for kk, vv in v.items():
                    if _is_bad(vv):
                        logger.error(f"Non-finite summary.{k}.{kk} = {vv}")
                        ok = False
            else:
                if _is_bad(v):
                    logger.error(f"Non-finite summary.{k} = {v}")
                    ok = False

        # history fields
        for i, row in enumerate(history_data):
            for k, v in row.items():
                if _is_bad(v):
                    logger.error(f"Non-finite history[{i}].{k} (date={row.get('date')}) = {v}")
                    ok = False

        return ok
