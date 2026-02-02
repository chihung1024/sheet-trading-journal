import pytest
from datetime import date

from journal_engine.core.calculator import PortfolioCalculator


class FakeMarketDataClient:
    """
    Minimal market data stub for unit tests.

    Required by PortfolioCalculator:
      - get_prev_close(symbol, d)
      - get_price(symbol, d)
    """

    def __init__(self, prev_close_map, price_map):
        # keys: (symbol, date) -> price
        self._prev_close_map = prev_close_map
        self._price_map = price_map

    def get_prev_close(self, symbol, d):
        k = (symbol, d)
        if k not in self._prev_close_map:
            raise KeyError(f"Missing prev_close for {k}")
        return float(self._prev_close_map[k])

    def get_price(self, symbol, d):
        k = (symbol, d)
        if k not in self._price_map:
            raise KeyError(f"Missing price for {k}")
        return float(self._price_map[k])


def _assert_invariant(pnl):
    # Total must equal attribution sum
    assert abs(
        pnl.total_pnl - (pnl.realized_pnl + pnl.holding_pnl + pnl.income_pnl)
    ) < 1e-6


def _find(results, d, symbol):
    for r in results:
        if r.date == d and r.symbol == symbol:
            return r
    raise AssertionError(f"Missing result for {symbol} on {d}")


def test_1_no_trades_price_move_zero_pnl():
    """
    Extreme Case #1:
      - No trades at all
      - Price changes
    Expect:
      - No position, so P&L must be 0 (even if price moves)
    """
    sym = "AAA"
    d1 = date(2026, 1, 2)

    market = FakeMarketDataClient(
        prev_close_map={(sym, d1): 100.0},
        price_map={(sym, d1): 110.0},
    )

    # No transactions
    calc = PortfolioCalculator(transactions=[], market_client=market)
    results = calc.calculate()

    # No symbol in transactions -> calculator returns empty results by design
    assert results == []


def test_2_buy_only_price_up_negative_then_holding_pnl_next_day():
    """
    Extreme Case #2:
      Day1: Buy 10 @ 100, close 100 => total_pnl should be 0 (cash out equals position created)
      Day2: No trade, prev_close 100, close 110 => holding_pnl = 10*(110-100)=100
    """
    sym = "AAA"
    d1 = date(2026, 1, 2)
    d2 = date(2026, 1, 3)

    market = FakeMarketDataClient(
        prev_close_map={
            (sym, d1): 100.0,
            (sym, d2): 100.0,  # yesterday close
        },
        price_map={
            (sym, d1): 100.0,
            (sym, d2): 110.0,
        },
    )

    tx = [
        {"symbol": sym, "date": d1, "type": "BUY", "qty": 10.0, "price": 100.0, "fee": 0.0, "tax": 0.0},
        # Note: no tx on d2
        # The calculator iterates only over dates that appear in tx,
        # so to force d2 evaluation we add a no-op dividend with amount=0 (keeps cash flow neutral).
        {"symbol": sym, "date": d2, "type": "DIV", "amount": 0.0},
    ]

    calc = PortfolioCalculator(transactions=tx, market_client=market)
    results = calc.calculate()

    r1 = _find(results, d1, sym)
    _assert_invariant(r1)
    assert abs(r1.total_pnl - 0.0) < 1e-6
    assert abs(r1.realized_pnl - 0.0) < 1e-6
    assert abs(r1.holding_pnl - 0.0) < 1e-6
    assert abs(r1.income_pnl - 0.0) < 1e-6

    r2 = _find(results, d2, sym)
    _assert_invariant(r2)
    assert abs(r2.realized_pnl - 0.0) < 1e-6
    assert abs(r2.income_pnl - 0.0) < 1e-6
    assert abs(r2.holding_pnl - 100.0) < 1e-6
    assert abs(r2.total_pnl - 100.0) < 1e-6


def test_3_partial_sell_fifo_with_fees_realized_pnl():
    """
    Extreme Case #3:
      Day1: Buy 10 @ 100 (fee/tax 0), close 100 => pnl 0
      Day2: Sell 4 @ 120 with fee 2, tax 0; close 120
    Expectations:
      - realized_pnl = (120*4 - fee2 - tax0) - cost_basis(4*100) = (480-2)-400 = 78
      - holding_pnl = begin_qty(10) * (120-100) = 200
      - total_pnl = realized + holding + income (income 0) must hold

    NOTE:
      This test is about accounting invariants, not broker cash balances.
    """
    sym = "AAA"
    d1 = date(2026, 1, 2)
    d2 = date(2026, 1, 3)

    market = FakeMarketDataClient(
        prev_close_map={
            (sym, d1): 100.0,
            (sym, d2): 100.0,
        },
        price_map={
            (sym, d1): 100.0,
            (sym, d2): 120.0,
        },
    )

    tx = [
        {"symbol": sym, "date": d1, "type": "BUY", "qty": 10.0, "price": 100.0, "fee": 0.0, "tax": 0.0},
        {"symbol": sym, "date": d2, "type": "SELL", "qty": 4.0, "price": 120.0, "fee": 2.0, "tax": 0.0},
    ]

    calc = PortfolioCalculator(transactions=tx, market_client=market)
    results = calc.calculate()

    r1 = _find(results, d1, sym)
    _assert_invariant(r1)
    assert abs(r1.total_pnl - 0.0) < 1e-6

    r2 = _find(results, d2, sym)
    _assert_invariant(r2)

    assert abs(r2.realized_pnl - 78.0) < 1e-6
    assert abs(r2.holding_pnl - 200.0) < 1e-6
    assert abs(r2.income_pnl - 0.0) < 1e-6
    assert abs(r2.total_pnl - (78.0 + 200.0)) < 1e-6


def test_4_dividend_income_pnl_only():
    """
    Extreme Case #4:
      Day1: Buy 10 @ 100, close 100 => pnl 0
      Day2: Dividend 5.0, no price change (prev_close 100, close 100)
    Expect:
      - income_pnl = 5.0
      - holding_pnl = 0
      - realized_pnl = 0
      - total_pnl = 5.0
    """
    sym = "AAA"
    d1 = date(2026, 1, 2)
    d2 = date(2026, 1, 3)

    market = FakeMarketDataClient(
        prev_close_map={
            (sym, d1): 100.0,
            (sym, d2): 100.0,
        },
        price_map={
            (sym, d1): 100.0,
            (sym, d2): 100.0,
        },
    )

    tx = [
        {"symbol": sym, "date": d1, "type": "BUY", "qty": 10.0, "price": 100.0, "fee": 0.0, "tax": 0.0},
        {"symbol": sym, "date": d2, "type": "DIV", "amount": 5.0},
    ]

    calc = PortfolioCalculator(transactions=tx, market_client=market)
    results = calc.calculate()

    r2 = _find(results, d2, sym)
    _assert_invariant(r2)

    assert abs(r2.realized_pnl - 0.0) < 1e-6
    assert abs(r2.holding_pnl - 0.0) < 1e-6
    assert abs(r2.income_pnl - 5.0) < 1e-6
    assert abs(r2.total_pnl - 5.0) < 1e-6


def test_5_oversell_raises():
    """
    Extreme Case #5:
      Oversell must raise.
      Day1: Buy 1 @ 100
      Day2: Sell 2 @ 110 -> oversell
    """
    sym = "AAA"
    d1 = date(2026, 1, 2)
    d2 = date(2026, 1, 3)

    market = FakeMarketDataClient(
        prev_close_map={
            (sym, d1): 100.0,
            (sym, d2): 100.0,
        },
        price_map={
            (sym, d1): 100.0,
            (sym, d2): 110.0,
        },
    )

    tx = [
        {"symbol": sym, "date": d1, "type": "BUY", "qty": 1.0, "price": 100.0, "fee": 0.0, "tax": 0.0},
        {"symbol": sym, "date": d2, "type": "SELL", "qty": 2.0, "price": 110.0, "fee": 0.0, "tax": 0.0},
    ]

    calc = PortfolioCalculator(transactions=tx, market_client=market)

    with pytest.raises(ValueError):
        _ = calc.calculate()
