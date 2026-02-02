def validate_daily_pnl(pnl):
    if abs(
        pnl.total_pnl
        - (pnl.realized_pnl + pnl.holding_pnl + pnl.income_pnl)
    ) > 1e-6:
        raise AssertionError(
            f"P&L validation failed on {pnl.date} {pnl.symbol}"
        )
