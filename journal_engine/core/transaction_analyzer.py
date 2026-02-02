from dataclasses import dataclass
from typing import List


@dataclass
class Trade:
    side: str          # BUY / SELL
    qty: float
    price: float
    fee: float
    tax: float


@dataclass
class Lot:
    qty: float
    cost: float       # total cost (including fee)


class TransactionAnalyzer:
    """
    Lot-based FIFO engine.
    Responsibility:
    - Apply BUY / SELL to lots
    - Compute realized P&L from SELL
    """

    @staticmethod
    def apply_trades(
        begin_lots: List[Lot],
        trades: List[Trade],
    ):
        lots = [Lot(l.qty, l.cost) for l in begin_lots]
        realized_pnl = 0.0
        cash_in = 0.0
        cash_out = 0.0

        for t in trades:
            if t.side == "BUY":
                total_cost = t.qty * t.price + t.fee + t.tax
                lots.append(Lot(t.qty, total_cost))
                cash_out += total_cost

            elif t.side == "SELL":
                sell_qty = t.qty
                sell_proceeds = t.qty * t.price - t.fee - t.tax
                cash_in += sell_proceeds

                remaining = sell_qty
                while remaining > 0 and lots:
                    lot = lots[0]
                    take = min(lot.qty, remaining)
                    cost_basis = lot.cost * (take / lot.qty)

                    realized_pnl += (t.price * take) - cost_basis
                    lot.qty -= take
                    lot.cost -= cost_basis
                    remaining -= take

                    if lot.qty <= 1e-12:
                        lots.pop(0)

                if remaining > 1e-12:
                    raise ValueError(
                        f"Oversell detected: remaining={remaining}"
                    )

        end_qty = sum(l.qty for l in lots)
        end_cost = sum(l.cost for l in lots)

        return {
            "end_lots": lots,
            "end_qty": end_qty,
            "end_cost": end_cost,
            "realized_pnl": realized_pnl,
            "cash_in": cash_in,
            "cash_out": cash_out,
        }
