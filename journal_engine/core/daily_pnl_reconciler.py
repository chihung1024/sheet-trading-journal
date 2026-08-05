"""Canonical Daily P&L reconciliation for portfolio snapshots.

The calculator historically maintained a history formula and a separate
per-symbol aggregation. This module makes the per-symbol component ledger the
canonical result and verifies it against the history identity before upload.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd


logger = logging.getLogger(__name__)

RECONCILIATION_TOLERANCE_TWD = 2.0
QTY_EPSILON = 1e-9


class DailyPnLReconciliationError(RuntimeError):
    """Raised when canonical Daily P&L cannot reconcile to portfolio history."""


@dataclass(frozen=True)
class SymbolDailyPnL:
    symbol: str
    market: str
    begin_qty: float
    end_qty: float
    begin_price: float
    end_price: float
    begin_fx: float
    end_fx: float
    buy_cost_twd: float
    sell_proceeds_twd: float
    dividend_income_twd: float
    fee_tax_pnl_twd: float
    price_pnl_twd: float
    fx_pnl_twd: float
    execution_pnl_twd: float
    total_pnl_twd: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "market": self.market,
            "begin_qty": self.begin_qty,
            "end_qty": self.end_qty,
            "begin_price": self.begin_price,
            "end_price": self.end_price,
            "begin_fx": self.begin_fx,
            "end_fx": self.end_fx,
            "buy_cost_twd": self.buy_cost_twd,
            "sell_proceeds_twd": self.sell_proceeds_twd,
            "dividend_income_twd": self.dividend_income_twd,
            "fee_tax_pnl_twd": self.fee_tax_pnl_twd,
            "price_pnl_twd": self.price_pnl_twd,
            "fx_pnl_twd": self.fx_pnl_twd,
            "execution_pnl_twd": self.execution_pnl_twd,
            "total_pnl_twd": self.total_pnl_twd,
        }


def _group_transactions(df: pd.DataFrame, group_name: str) -> pd.DataFrame:
    if group_name == "all":
        return df.copy(deep=True)

    def contains_group(value: Any) -> bool:
        tags = [
            part.strip()
            for part in str(value or "").replace(";", ",").split(",")
        ]
        return group_name in [tag for tag in tags if tag]

    return df[df["Tag"].apply(contains_group)].copy(deep=True)


def _ordered_transactions(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df.copy(deep=True)
    ordered = df.copy(deep=True)
    priority = {"BUY": 1, "DIV": 2, "SELL": 3}
    ordered["_priority"] = ordered["Type"].map(priority).fillna(99)
    sort_columns = ["Date"]
    if "Timestamp" in ordered.columns:
        sort_columns.append("Timestamp")
    if "Sequence" in ordered.columns:
        sort_columns.append("Sequence")
    elif "id" in ordered.columns:
        sort_columns.append("id")
    sort_columns.append("_priority")
    return ordered.sort_values(sort_columns, kind="stable").drop(
        columns=["_priority"]
    )


def _history_formula(
    group_data: Any,
) -> Tuple[Optional[float], Optional[date], Optional[date]]:
    history = list(group_data.history or [])
    if not history:
        return None, None, None
    last = history[-1]
    base_date = pd.to_datetime(last["date"]).date()
    prev_date = (
        pd.to_datetime(history[-2]["date"]).date()
        if len(history) >= 2
        else None
    )
    if len(history) < 2:
        return None, base_date, prev_date
    previous = history[-2]
    total = (
        float(last.get("_raw_total_value", last.get("total_value", 0.0)))
        - float(
            previous.get(
                "_raw_total_value",
                previous.get("total_value", 0.0),
            )
        )
        + float(
            last.get(
                "_raw_net_cashflow_twd",
                last.get("net_cashflow_twd", 0.0),
            )
        )
    )
    return total, base_date, prev_date


def _price_and_fx(
    calculator: Any,
    symbol: str,
    value_date: date,
) -> Tuple[float, float]:
    current_fx = (
        float(getattr(calculator.market, "realtime_fx_rate", 0.0) or 0.0)
        or float(
            getattr(calculator, "_canonical_reconciliation_fx", 0.0) or 0.0
        )
        or float(getattr(calculator, "current_fx", 0.0) or 0.0)
        or 1.0
    )
    price, fx = calculator._get_asset_effective_price_and_fx(
        symbol,
        value_date,
        current_fx,
    )
    price = float(price)
    fx = float(fx)
    if not math.isfinite(price) or price < 0:
        raise DailyPnLReconciliationError(
            f"Invalid price for {symbol} on {value_date}"
        )
    if not math.isfinite(fx) or fx <= 0:
        raise DailyPnLReconciliationError(
            f"Invalid FX for {symbol} on {value_date}"
        )
    return price, fx


def _replay_symbol(
    symbol_df: pd.DataFrame,
    base_date: date,
) -> Tuple[float, float, List[Tuple[pd.Series, float]]]:
    """Return begin qty, end qty and executed base-date transaction rows."""
    qty = 0.0
    begin_qty: Optional[float] = None
    executed_rows: List[Tuple[pd.Series, float]] = []

    for _, row in _ordered_transactions(symbol_df).iterrows():
        row_date = pd.to_datetime(row["Date"]).date()
        if row_date > base_date:
            continue
        if row_date == base_date and begin_qty is None:
            begin_qty = qty

        txn_type = str(row["Type"]).upper()
        requested_qty = float(row["Qty"])
        executed_qty = requested_qty
        if txn_type == "BUY":
            qty += requested_qty
        elif txn_type == "SELL":
            executed_qty = min(max(qty, 0.0), requested_qty)
            qty -= executed_qty
            if abs(qty) < QTY_EPSILON:
                qty = 0.0
        elif txn_type != "DIV":
            raise DailyPnLReconciliationError(
                f"Unsupported transaction type {txn_type}"
            )

        if row_date == base_date:
            executed_rows.append((row, executed_qty))

    if begin_qty is None:
        begin_qty = qty
    return float(begin_qty), float(qty), executed_rows


def _confirmed_dividend_keys(df: pd.DataFrame) -> set[str]:
    keys: set[str] = set()
    div_rows = df[df["Type"] == "DIV"]
    for _, row in div_rows.iterrows():
        row_date = pd.to_datetime(row["Date"]).strftime("%Y-%m-%d")
        keys.add(f"{row['Symbol']}_{row_date}")
    return keys


def _symbol_component(
    calculator: Any,
    symbol_df: pd.DataFrame,
    symbol: str,
    base_date: date,
    prev_date: date,
    confirmed_dividends: set[str],
) -> SymbolDailyPnL:
    begin_qty, end_qty, executed_rows = _replay_symbol(symbol_df, base_date)
    end_price, end_fx = _price_and_fx(calculator, symbol, base_date)
    begin_price, begin_fx = _price_and_fx(calculator, symbol, prev_date)

    buy_cost_twd = 0.0
    sell_proceeds_twd = 0.0
    dividend_income_twd = 0.0
    fee_tax_total_twd = 0.0

    for row, executed_qty in executed_rows:
        txn_type = str(row["Type"]).upper()
        requested_qty = float(row["Qty"])
        fee = abs(float(row.get("Commission", 0.0) or 0.0))
        tax = abs(float(row.get("Tax", 0.0) or 0.0))
        if txn_type == "BUY":
            buy_cost_twd += (
                requested_qty * float(row["Price"]) + fee + tax
            ) * end_fx
            fee_tax_total_twd += (fee + tax) * end_fx
        elif txn_type == "SELL":
            ratio = executed_qty / requested_qty if requested_qty > 0 else 0.0
            executed_fee = fee * ratio
            executed_tax = tax * ratio
            sell_proceeds_twd += (
                executed_qty * float(row["Price"])
                - executed_fee
                - executed_tax
            ) * end_fx
            fee_tax_total_twd += (executed_fee + executed_tax) * end_fx
        elif txn_type == "DIV":
            dividend_income_twd += (
                requested_qty * float(row["Price"]) * end_fx
            )

    dividend_key = f"{symbol}_{base_date.isoformat()}"
    market_dividend = float(
        calculator.market.get_dividend(symbol, pd.Timestamp(base_date))
    )
    if (
        market_dividend > 0
        and dividend_key not in confirmed_dividends
        and begin_qty > 0
    ):
        split_factor = float(
            calculator.market.get_transaction_multiplier(
                symbol,
                pd.Timestamp(base_date),
            )
        )
        if not math.isfinite(split_factor) or split_factor <= 0:
            raise DailyPnLReconciliationError(
                f"Invalid split factor for {symbol} on {base_date}"
            )
        shares_at_ex = begin_qty / split_factor
        dividend_income_twd += shares_at_ex * market_dividend * 0.7 * end_fx

    begin_value = begin_qty * begin_price * begin_fx
    end_value = end_qty * end_price * end_fx
    total_pnl = (
        end_value
        - begin_value
        - buy_cost_twd
        + sell_proceeds_twd
        + dividend_income_twd
    )

    fx_pnl = 0.0
    if not calculator._is_taiwan_stock(symbol) and begin_qty > 0:
        fx_pnl = begin_qty * begin_price * (end_fx - begin_fx)
    price_pnl = begin_qty * (end_price - begin_price) * end_fx
    fee_tax_pnl = -fee_tax_total_twd
    execution_pnl = (
        total_pnl
        - price_pnl
        - fx_pnl
        - dividend_income_twd
        - fee_tax_pnl
    )

    values = (
        begin_qty,
        end_qty,
        begin_price,
        end_price,
        begin_fx,
        end_fx,
        buy_cost_twd,
        sell_proceeds_twd,
        dividend_income_twd,
        fee_tax_pnl,
        price_pnl,
        fx_pnl,
        execution_pnl,
        total_pnl,
    )
    if not all(math.isfinite(float(value)) for value in values):
        raise DailyPnLReconciliationError(
            f"Non-finite Daily PnL component for {symbol}"
        )

    return SymbolDailyPnL(
        symbol=symbol,
        market="TW" if calculator._is_taiwan_stock(symbol) else "US",
        begin_qty=begin_qty,
        end_qty=end_qty,
        begin_price=begin_price,
        end_price=end_price,
        begin_fx=begin_fx,
        end_fx=end_fx,
        buy_cost_twd=buy_cost_twd,
        sell_proceeds_twd=sell_proceeds_twd,
        dividend_income_twd=dividend_income_twd,
        fee_tax_pnl_twd=fee_tax_pnl,
        price_pnl_twd=price_pnl,
        fx_pnl_twd=fx_pnl,
        execution_pnl_twd=execution_pnl,
        total_pnl_twd=total_pnl,
    )


def _rounded_breakdown(
    total: float,
    tw: float,
    us: float,
    fx: float,
) -> Dict[str, float]:
    rounded_total = float(round(total, 0))
    rounded = {
        "tw_pnl_twd": float(round(tw, 0)),
        "us_pnl_twd": float(round(us, 0)),
        "fx_pnl_twd": float(round(fx, 0)),
    }
    residual = rounded_total - sum(rounded.values())
    if residual:
        target = "tw_pnl_twd" if abs(tw) >= abs(us) else "us_pnl_twd"
        rounded[target] += residual
    return rounded


def reconcile_group_daily_pnl(
    group_name: str,
    group_data: Any,
    adjusted_df: pd.DataFrame,
    calculator: Any,
    tolerance_twd: float = RECONCILIATION_TOLERANCE_TWD,
) -> Dict[str, Any]:
    formula_total, base_date, prev_date = _history_formula(group_data)
    if base_date is None or prev_date is None or formula_total is None:
        group_data.day_ledger = []
        return {"group": group_name, "status": "insufficient-history"}

    group_df = _group_transactions(adjusted_df, group_name)
    if group_df.empty:
        group_data.day_ledger = []
        return {"group": group_name, "status": "empty"}

    confirmed_dividends = _confirmed_dividend_keys(group_df)
    symbols = sorted(set(group_df["Symbol"].astype(str).str.upper()))
    components: List[SymbolDailyPnL] = []
    for symbol in symbols:
        symbol_df = group_df[group_df["Symbol"] == symbol]
        component = _symbol_component(
            calculator,
            symbol_df,
            symbol,
            base_date,
            prev_date,
            confirmed_dividends,
        )
        if (
            abs(component.begin_qty) > QTY_EPSILON
            or abs(component.end_qty) > QTY_EPSILON
            or abs(component.total_pnl_twd) > 0.005
            or not symbol_df[
                symbol_df["Date"].dt.date == base_date
            ].empty
        ):
            components.append(component)

    canonical_total = sum(item.total_pnl_twd for item in components)
    deviation = canonical_total - formula_total
    if abs(deviation) > tolerance_twd:
        raise DailyPnLReconciliationError(
            f"[{group_name}] Daily PnL canonical reconciliation failed: "
            f"formula={formula_total:.2f}, "
            f"components={canonical_total:.2f}, "
            f"deviation={deviation:.2f}"
        )

    fx_total = sum(item.fx_pnl_twd for item in components)
    tw_total = sum(
        item.total_pnl_twd
        for item in components
        if item.market == "TW"
    )
    us_total = sum(
        item.total_pnl_twd - item.fx_pnl_twd
        for item in components
        if item.market == "US"
    )

    breakdown = _rounded_breakdown(
        canonical_total,
        tw_total,
        us_total,
        fx_total,
    )
    rounded_total = float(round(canonical_total, 0))
    if abs(rounded_total - sum(breakdown.values())) > 0.001:
        raise DailyPnLReconciliationError(
            f"[{group_name}] Rounded Daily PnL breakdown does not reconcile"
        )

    group_data.summary.daily_pnl_twd = rounded_total
    group_data.summary.daily_pnl_breakdown = breakdown
    base_value = group_data.summary.daily_pnl_base_value
    if base_value and float(base_value) > 0:
        group_data.summary.daily_pnl_roi_percent = round(
            canonical_total / float(base_value) * 100,
            2,
        )
    group_data.day_ledger = [item.to_dict() for item in components]

    logger.info(
        "[%s] Canonical Daily PnL reconciled: "
        "formula=%.2f, components=%.2f, symbols=%s",
        group_name,
        formula_total,
        canonical_total,
        len(components),
    )
    return {
        "group": group_name,
        "status": "reconciled",
        "formula_total_twd": formula_total,
        "canonical_total_twd": canonical_total,
        "deviation_twd": deviation,
        "symbol_count": len(components),
    }


def reconcile_snapshot_daily_pnl(
    snapshot: Any,
    adjusted_df: pd.DataFrame,
    calculator: Any,
    tolerance_twd: float = RECONCILIATION_TOLERANCE_TWD,
) -> List[Dict[str, Any]]:
    """Reconcile every group and synchronize root compatibility fields."""
    if snapshot is None or not getattr(snapshot, "groups", None):
        raise DailyPnLReconciliationError("Snapshot groups are unavailable")
    if "all" not in snapshot.groups:
        raise DailyPnLReconciliationError("Snapshot is missing the all group")

    results = []
    calculator._canonical_reconciliation_fx = float(
        getattr(snapshot, "exchange_rate", 0.0) or 0.0
    )
    for group_name, group_data in snapshot.groups.items():
        results.append(
            reconcile_group_daily_pnl(
                group_name,
                group_data,
                adjusted_df,
                calculator,
                tolerance_twd=tolerance_twd,
            )
        )

    all_group = snapshot.groups["all"]
    snapshot.summary = all_group.summary
    snapshot.holdings = all_group.holdings
    snapshot.history = all_group.history
    snapshot.pending_dividends = all_group.pending_dividends

    root_breakdown = snapshot.summary.daily_pnl_breakdown
    if not root_breakdown:
        raise DailyPnLReconciliationError(
            "Canonical root Daily PnL breakdown is missing"
        )
    component_sum = sum(float(value) for value in root_breakdown.values())
    if abs(float(snapshot.summary.daily_pnl_twd) - component_sum) > 0.001:
        raise DailyPnLReconciliationError(
            "Canonical root Daily PnL breakdown mismatch"
        )
    return results
