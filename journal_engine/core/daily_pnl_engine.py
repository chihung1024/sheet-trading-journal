from dataclasses import dataclass
from datetime import date
from typing import List


@dataclass
class Trade:
    date: date
    symbol: str
    side: str          # "BUY", "SELL", "DIV"
    qty: float
    price: float
    fee: float = 0.0
    tax: float = 0.0
    cash_amount: float = 0.0  # for dividend


@dataclass
class DailyPositionState:
    date: date
    symbol: str

    # ----- begin of day -----
    begin_qty: float
    begin_price: float
    begin_value: float

    # ----- trades -----
    trades: List[Trade]

    # ----- end of day -----
    end_qty: float
    end_price: float
    end_value: float

    # ----- cash flow -----
    cash_in: float     # sell proceeds + dividend
    cash_out: float    # buy cost + fee + tax


@dataclass
class DailyPnLResult:
    date: date
    symbol: str

    total_pnl: float

    realized_pnl: float
    holding_pnl: float
    income_pnl: float

    begin_value: float
    end_value: float
    net_cash_flow: float


class DailyPnLEngine:
    """
    Single source of truth for Daily P&L.
    """

    @staticmethod
    def compute(
        state: DailyPositionState,
        realized_pnl: float,
        income_pnl: float,
    ) -> DailyPnLResult:

        net_cash_flow = state.cash_in - state.cash_out

        total_pnl = (
            state.end_value
            - state.begin_value
            - net_cash_flow
        )

        holding_pnl = (
            state.begin_qty
            * (state.end_price - state.begin_price)
        )

        attribution_sum = realized_pnl + holding_pnl + income_pnl
        residual = total_pnl - attribution_sum

        if abs(residual) > 1e-6:
            raise ValueError(
                f"[DailyPnLEngine] Attribution mismatch: "
                f"total={total_pnl:.6f}, "
                f"sum={attribution_sum:.6f}, "
                f"residual={residual:.6f}"
            )

        return DailyPnLResult(
            date=state.date,
            symbol=state.symbol,
            total_pnl=total_pnl,
            realized_pnl=realized_pnl,
            holding_pnl=holding_pnl,
            income_pnl=income_pnl,
            begin_value=state.begin_value,
            end_value=state.end_value,
            net_cash_flow=net_cash_flow,
        )
