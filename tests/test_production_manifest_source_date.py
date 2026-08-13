import pandas as pd

from journal_engine.core.production_manifest import (
    _realtime_fx_currencies_used_by_calculation,
)


def _frame(index_date, source_date=None):
    data = {"Close_Adjusted": [100.0]}
    if source_date is not None:
        data["Valuation_Source_Date"] = [source_date]
    return pd.DataFrame(data, index=pd.to_datetime([index_date]))


def test_carry_forward_user_row_creates_asof_pass_but_does_not_claim_realtime_fx_for_itself():
    as_of = pd.Timestamp("2026-01-05")
    market_window = {
        "AAPL": _frame("2026-01-05", "2026-01-02"),
    }

    currencies = _realtime_fx_currencies_used_by_calculation(
        user_symbols={"AAPL"},
        required_symbols=["AAPL"],
        market_window=market_window,
        calculation_as_of=as_of,
    )

    assert currencies == set()


def test_asof_pass_can_use_realtime_fx_for_another_same_day_symbol():
    as_of = pd.Timestamp("2026-01-05")
    market_window = {
        "2330.TW": _frame("2026-01-05", "2026-01-02"),
        "SPY": _frame("2026-01-05", "2026-01-05"),
    }

    currencies = _realtime_fx_currencies_used_by_calculation(
        user_symbols={"2330.TW"},
        required_symbols=["2330.TW", "SPY"],
        market_window=market_window,
        calculation_as_of=as_of,
    )

    assert currencies == {"USD"}


def test_same_day_required_symbol_does_not_create_pass_without_user_symbol_date():
    as_of = pd.Timestamp("2026-01-05")
    market_window = {
        "AAPL": _frame("2026-01-02", "2026-01-02"),
        "SPY": _frame("2026-01-05", "2026-01-05"),
    }

    currencies = _realtime_fx_currencies_used_by_calculation(
        user_symbols={"AAPL"},
        required_symbols=["AAPL", "SPY"],
        market_window=market_window,
        calculation_as_of=as_of,
    )

    assert currencies == set()


def test_legacy_market_row_without_source_date_keeps_same_day_behavior():
    as_of = pd.Timestamp("2026-01-05")
    market_window = {
        "AAPL": _frame("2026-01-05"),
    }

    currencies = _realtime_fx_currencies_used_by_calculation(
        user_symbols={"AAPL"},
        required_symbols=["AAPL"],
        market_window=market_window,
        calculation_as_of=as_of,
    )

    assert currencies == {"USD"}
