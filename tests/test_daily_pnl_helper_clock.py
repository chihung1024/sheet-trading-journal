from datetime import datetime
from unittest.mock import patch

from journal_engine.core.daily_pnl_helper import DailyPnLHelper


def _tw_datetime(helper: DailyPnLHelper, year: int, month: int, day: int, hour: int, minute: int = 0):
    """Create an aware Taipei datetime for deterministic market-clock tests."""
    return helper.tz_tw.localize(datetime(year, month, day, hour, minute))


def _freeze_helper_now(helper: DailyPnLHelper, value):
    """Patch only this module's datetime provider; production code is unchanged."""
    patched = patch("journal_engine.core.daily_pnl_helper.datetime")
    mocked_datetime = patched.start()
    mocked_datetime.now.return_value = value
    return patched


def test_price_strategy_legacy_contract_is_deterministic():
    helper = DailyPnLHelper()
    assert helper.get_price_strategy("ANY", True) == ("TODAY", "Default Strategy")
    assert helper.get_price_strategy("ANY", False) == ("TODAY", "Default Strategy")


def test_effective_display_date_tw_before_and_after_open():
    helper = DailyPnLHelper()

    before_open = _tw_datetime(helper, 2026, 8, 7, 8, 0)
    patcher = _freeze_helper_now(helper, before_open)
    try:
        assert helper.get_effective_display_date(True).isoformat() == "2026-08-06"
    finally:
        patcher.stop()

    after_open = _tw_datetime(helper, 2026, 8, 7, 10, 0)
    patcher = _freeze_helper_now(helper, after_open)
    try:
        assert helper.get_effective_display_date(True).isoformat() == "2026-08-07"
    finally:
        patcher.stop()


def test_effective_display_date_us_before_and_after_0930_eastern():
    helper = DailyPnLHelper()

    # 20:00 Taipei on 2026-08-07 is 08:00 US/Eastern (DST), before 09:30.
    before_us_open = _tw_datetime(helper, 2026, 8, 7, 20, 0)
    patcher = _freeze_helper_now(helper, before_us_open)
    try:
        assert helper.get_effective_display_date(False).isoformat() == "2026-08-06"
    finally:
        patcher.stop()

    # 22:00 Taipei is 10:00 US/Eastern, after 09:30.
    after_us_open = _tw_datetime(helper, 2026, 8, 7, 22, 0)
    patcher = _freeze_helper_now(helper, after_us_open)
    try:
        assert helper.get_effective_display_date(False).isoformat() == "2026-08-07"
    finally:
        patcher.stop()


def test_is_market_open_covers_tw_us_weekend_and_unknown_market():
    helper = DailyPnLHelper()

    tw_session = _tw_datetime(helper, 2026, 8, 7, 10, 0)
    patcher = _freeze_helper_now(helper, tw_session)
    try:
        assert helper.is_market_open("TW") is True
        assert helper.is_market_open("US") is False
        assert helper.is_market_open("JP") is False
    finally:
        patcher.stop()

    us_session = _tw_datetime(helper, 2026, 8, 7, 22, 0)
    patcher = _freeze_helper_now(helper, us_session)
    try:
        assert helper.is_market_open("US") is True
        assert helper.is_market_open("TW") is False
    finally:
        patcher.stop()

    saturday = _tw_datetime(helper, 2026, 8, 8, 10, 0)
    patcher = _freeze_helper_now(helper, saturday)
    try:
        assert helper.is_market_open("TW") is False
        assert helper.is_market_open("US") is False
        assert helper.is_market_open("JP") is False
    finally:
        patcher.stop()


def test_get_market_stage_covers_tw_us_and_closed_paths_with_fixed_clock():
    helper = DailyPnLHelper()

    tw_session = _tw_datetime(helper, 2026, 8, 7, 10, 0)
    patcher = _freeze_helper_now(helper, tw_session)
    try:
        assert helper.get_market_stage() == (helper.STAGE_MARKET_OPEN, "TW Market Open")
    finally:
        patcher.stop()

    us_session = _tw_datetime(helper, 2026, 8, 7, 22, 0)
    patcher = _freeze_helper_now(helper, us_session)
    try:
        assert helper.get_market_stage() == (helper.STAGE_MARKET_OPEN, "US Market Open")
    finally:
        patcher.stop()

    both_closed = _tw_datetime(helper, 2026, 8, 7, 15, 0)
    patcher = _freeze_helper_now(helper, both_closed)
    try:
        assert helper.get_market_stage() == (helper.STAGE_CLOSED, "Markets Closed")
    finally:
        patcher.stop()
