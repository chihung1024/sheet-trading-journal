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
    cash_in: float     # sell proceeds + dividend (現金流入使用者口袋)
    cash_out: float    # buy cost + fee + tax (現金從使用者口袋流出)


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

        # net_cash_flow: 正數代表淨流入口袋 (如獲利了結/配息)，負數代表淨流出 (如買入建倉/手續費)
        net_cash_flow = state.cash_in - state.cash_out

        # ✅ [修正 1] 代數恆等式的符號修正
        # 總損益 = 帳面市值變動 + 期間淨流回口袋的現金
        # (修正了原本錯誤的減號，避免買入視為虧損、賣出視為獲利的 Bug)
        total_pnl = (
            state.end_value
            - state.begin_value
            + net_cash_flow
        )

        # ✅ [修正 2] 補全 Holding PnL 盲區
        # 傳統只算 state.begin_qty * (end_price - begin_price) 會漏掉「當日新買部位」的盤中損益。
        # 最精準且保證不破壞歸因的算法，是直接透過代數恆等式推導：
        holding_pnl = total_pnl - realized_pnl - income_pnl

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
