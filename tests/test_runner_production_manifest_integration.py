from datetime import datetime

import pandas as pd
import pytest

import main as runner
from journal_engine.models import PortfolioGroupData, PortfolioSnapshot, PortfolioSummary


def _records():
    return [
        {
            "id": 1,
            "user_id": "alpha@example.com",
            "txn_date": "2026-01-02",
            "symbol": "NVDA",
            "txn_type": "BUY",
            "qty": 1.0,
            "price": 100.0,
            "fee": 0.0,
            "tax": 0.0,
            "tag": "",
        }
    ]


def _snapshot():
    summary = PortfolioSummary(
        total_value=100.0,
        invested_capital=100.0,
        total_pnl=0.0,
        twr=0.0,
        xirr=0.0,
        realized_pnl=0.0,
        benchmark_twr=0.0,
        daily_pnl_twd=0.0,
        daily_pnl_breakdown={"tw_pnl_twd": 0.0, "us_pnl_twd": 0.0, "fx_pnl_twd": 0.0},
    )
    history = [{"date": "2026-01-02", "twr": 0.0}]
    group = PortfolioGroupData(summary=summary, holdings=[], history=history)
    return PortfolioSnapshot(
        updated_at="2026-01-02 12:00",
        base_currency="TWD",
        exchange_rate=32.0,
        summary=summary,
        holdings=[],
        history=history,
        groups={"all": group},
    )


def test_run_update_attaches_manifest_and_uses_one_taipei_clock(monkeypatch):
    observed = {
        "calendar_as_of": None,
        "calculator_now": None,
        "uploaded_manifest": None,
        "uploaded_user": None,
    }

    class FakeAPIClient:
        def fetch_records(self, target_user_id=None):
            return _records()

        def get_user_benchmark(self, user_id):
            return "SPY"

        def upload_portfolio(self, snapshot, target_user_id=None):
            observed["uploaded_manifest"] = snapshot.calculation_manifest
            observed["uploaded_user"] = target_user_id
            return True

    class FakeMarketClient:
        def __init__(self):
            self.market_data = {}
            self.fx_rates = pd.Series(dtype=float)
            self.fx_rates_by_currency = {}
            self.realtime_fx_rates_by_currency = {}
            self.price_metadata_by_symbol = {}
            self.realtime_overlay_symbols = set()

        def download_data(self, tickers, start_date):
            dates = pd.to_datetime(["2026-01-01", "2026-01-02", "2026-01-05"])
            self.market_data = {
                symbol: pd.DataFrame(
                    {
                        "Close_Adjusted": [99.0, 100.0, 101.0],
                        "Close_Raw": [99.0, 100.0, 101.0],
                        "Split_Factor": [1.0, 1.0, 1.0],
                        "Dividends": [0.0, 0.0, 0.0],
                        "Stock Splits": [0.0, 0.0, 0.0],
                    },
                    index=dates,
                )
                for symbol in tickers
            }
            self.fx_rates = pd.Series([31.5, 32.0, 32.5], index=dates)
            self.fx_rates_by_currency = {"USD": self.fx_rates}
            self.realtime_fx_rates_by_currency = {"USD": 32.5}
            self.price_metadata_by_symbol = {
                symbol: {
                    "price_source": "Close",
                    "selection_reason": "Scheme A: price-return valuation uses Close (split-adjusted)",
                }
                for symbol in tickers
            }
            self.realtime_overlay_symbols = {"NVDA"}
            return self.market_data, self.fx_rates

        def validate_required_fx_data(self, tickers):
            return []

        def get_transaction_multiplier(self, symbol, date):
            return 1.0

        def get_prev_trading_date(self, symbol, value_date):
            return pd.Timestamp("2026-01-01")

    class FakeCalculator:
        def __init__(
            self,
            user_df,
            market_client,
            benchmark_ticker="SPY",
            api_client=None,
            oversell_policy="CLAMP",
            calculation_now=None,
        ):
            self.df = user_df.copy(deep=True)
            observed["calculator_now"] = calculation_now

        def run(self):
            return _snapshot()

    original_calendar = runner.ensure_transaction_dates_in_market_calendar

    def capture_calendar(market_client, transactions_df, **kwargs):
        observed["calendar_as_of"] = kwargs.get("as_of_date")
        return original_calendar(market_client, transactions_df, **kwargs)

    monkeypatch.setattr(runner, "API_KEY", "secret")
    monkeypatch.setattr(runner, "CloudflareClient", FakeAPIClient)
    monkeypatch.setattr(runner, "MarketDataClient", FakeMarketClient)
    monkeypatch.setattr(runner, "PortfolioCalculator", FakeCalculator)
    monkeypatch.setattr(runner, "ensure_transaction_dates_in_market_calendar", capture_calendar)
    monkeypatch.setattr(runner, "reconcile_snapshot_daily_pnl", lambda *args, **kwargs: [])
    monkeypatch.setattr(runner, "validate_before_upload", lambda snapshot, user_df: None)
    monkeypatch.setenv("GITHUB_SHA", "a" * 40)
    monkeypatch.delenv("TARGET_USER_ID", raising=False)
    monkeypatch.setenv("CUSTOM_BENCHMARK", "SPY")

    runner.run_update()

    assert observed["uploaded_user"] == "alpha@example.com"
    assert observed["uploaded_manifest"] is not None
    assert observed["uploaded_manifest"].deterministic_identity.engine_source_commit == "a" * 40

    calculation_now = observed["calculator_now"]
    assert isinstance(calculation_now, datetime)
    assert calculation_now.tzinfo is not None
    assert getattr(calculation_now.tzinfo, "zone", None) == "Asia/Taipei"
    assert observed["calendar_as_of"] == calculation_now
    assert observed["uploaded_manifest"].calculated_at == calculation_now.isoformat()


def test_run_update_fails_closed_without_exact_source_commit(monkeypatch):
    monkeypatch.setattr(runner, "API_KEY", "secret")
    monkeypatch.delenv("GITHUB_SHA", raising=False)

    with pytest.raises(Exception, match="Git commit SHA|source commit|40-character"):
        runner.run_update()
