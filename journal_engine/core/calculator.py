from collections import defaultdict
from datetime import date

from journal_engine.core.transaction_analyzer import (
    TransactionAnalyzer,
    Lot,
    Trade,
)
from journal_engine.core.daily_pnl_engine import (
    DailyPositionState,
    DailyPnLEngine,
)
from journal_engine.clients.market_data import MarketDataClient


class PortfolioCalculator:
    def __init__(self, transactions, market_client: MarketDataClient):
        self.transactions = transactions
        self.market = market_client

    def calculate(self):
        results = []
        tx_by_symbol_date = defaultdict(list)

        for t in self.transactions:
            tx_by_symbol_date[(t["symbol"], t["date"])].append(t)

        for symbol in sorted({t["symbol"] for t in self.transactions}):
            lots = []
            prev_date = None
            prev_price = None

            all_dates = sorted(
                {t["date"] for t in self.transactions if t["symbol"] == symbol}
            )

            for d in all_dates:
                begin_qty = sum(l.qty for l in lots)
                begin_price = (
                    prev_price
                    if prev_price is not None
                    else self.market.get_prev_close(symbol, d)
                )
                begin_value = begin_qty * begin_price

                trades = []
                income_pnl = 0.0

                for t in tx_by_symbol_date[(symbol, d)]:
                    if t["type"] == "DIV":
                        income_pnl += t["amount"]
                    else:
                        trades.append(
                            Trade(
                                side=t["type"],
                                qty=t["qty"],
                                price=t["price"],
                                fee=t.get("fee", 0.0),
                                tax=t.get("tax", 0.0),
                            )
                        )

                r = TransactionAnalyzer.apply_trades(lots, trades)
                lots = r["end_lots"]

                end_qty = r["end_qty"]
                end_price = self.market.get_price(symbol, d)
                end_value = end_qty * end_price

                state = DailyPositionState(
                    date=d,
                    symbol=symbol,
                    begin_qty=begin_qty,
                    begin_price=begin_price,
                    begin_value=begin_value,
                    trades=[],
                    end_qty=end_qty,
                    end_price=end_price,
                    end_value=end_value,
                    cash_in=r["cash_in"] + income_pnl,
                    cash_out=r["cash_out"],
                )

                daily_pnl = DailyPnLEngine.compute(
                    state=state,
                    realized_pnl=r["realized_pnl"],
                    income_pnl=income_pnl,
                )

                results.append(daily_pnl)

                prev_date = d
                prev_price = end_price

        return results
