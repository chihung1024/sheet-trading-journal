from types import SimpleNamespace

import pandas as pd
import pytest

import main as runner
from journal_engine.core.ledger_integrity import LedgerIntegrityError


def one_user_records():
    return [
        {
            "id": 1,
            "user_id": "alpha@example.com",
            "txn_date": "2026-01-01",
            "symbol": "AAA",
            "txn_type": "BUY",
            "qty": 1.0,
            "price": 100.0,
            "fee": 0.0,
            "tax": 0.0,
            "tag": "Core",
        }
    ]


def configure_runner(monkeypatch, events, *, preflight_error=None):
    validation_ledger = object()

    class FakeAPIClient:
        def fetch_records(self, target_user_id=None):
            events.append("fetch")
            return one_user_records()

        def get_user_benchmark(self, user_id):
            return "AAA"

        def upload_portfolio(self, snapshot, target_user_id=None):
            events.append("upload")
            return True

    class FakeMarketClient:
        def download_data(self, tickers, start_date):
            events.append("market")

    class FakeCalculator:
        def __init__(self, user_df, market_client, benchmark_ticker, api_client):
            events.append("calculator-init")
            self.df = user_df.copy(deep=True)

        def run(self):
            events.append("calculator-run")
            return SimpleNamespace(benchmark_symbol=None)

    def fake_build_split_ledger(raw_user_df, market_client):
        events.append("build-validation-ledger")
        assert list(raw_user_df["id"]) == [1]
        return validation_ledger

    def fake_preflight(ledger, *, user_label):
        events.append("prefix-preflight")
        assert ledger is validation_ledger
        assert user_label == "al***@example.com"
        if preflight_error is not None:
            raise preflight_error
        return SimpleNamespace(row_count=1, scope_count=2, symbol_scope_count=2)

    def fake_parity(calculator_df, ledger):
        events.append("parity")
        assert ledger is validation_ledger
        return True

    def fake_validate_before_upload(snapshot, ledger):
        events.append("snapshot-validation")
        assert ledger is validation_ledger

    monkeypatch.setattr(runner, "API_KEY", "secret")
    monkeypatch.setattr(runner, "CloudflareClient", FakeAPIClient)
    monkeypatch.setattr(runner, "MarketDataClient", FakeMarketClient)
    monkeypatch.setattr(
        runner,
        "ensure_transaction_dates_in_market_calendar",
        lambda *args, **kwargs: {},
    )
    monkeypatch.setattr(runner, "validate_required_market_data", lambda *args, **kwargs: None)
    monkeypatch.setattr(runner, "build_split_adjusted_validation_ledger", fake_build_split_ledger)
    monkeypatch.setattr(runner, "validate_transaction_prefix_integrity", fake_preflight)
    monkeypatch.setattr(runner, "PortfolioCalculator", FakeCalculator)
    monkeypatch.setattr(
        runner,
        "reconcile_snapshot_daily_pnl",
        lambda *args, **kwargs: events.append("reconcile") or [],
    )
    monkeypatch.setattr(runner, "validate_adjusted_ledger_parity", fake_parity)
    monkeypatch.setattr(runner, "validate_before_upload", fake_validate_before_upload)
    monkeypatch.setenv("TARGET_USER_ID", "alpha@example.com")
    monkeypatch.setenv("CUSTOM_BENCHMARK", "SPY")

    return validation_ledger


def test_prefix_preflight_runs_before_calculator_and_reuses_validation_ledger(monkeypatch):
    events = []
    configure_runner(monkeypatch, events)

    runner.run_update()

    assert events.index("build-validation-ledger") < events.index("prefix-preflight")
    assert events.index("prefix-preflight") < events.index("calculator-init")
    assert events.index("calculator-run") < events.index("parity")
    assert events.index("parity") < events.index("snapshot-validation")
    assert events.index("snapshot-validation") < events.index("upload")
    assert events.count("build-validation-ledger") == 1


def test_prefix_violation_blocks_calculator_and_upload(monkeypatch):
    events = []
    configure_runner(
        monkeypatch,
        events,
        preflight_error=LedgerIntegrityError(
            "Transaction prefix integrity violation [record_id=1]"
        ),
    )

    with pytest.raises(runner.PortfolioUpdateError, match="1 位使用者失敗"):
        runner.run_update()

    assert "prefix-preflight" in events
    assert "calculator-init" not in events
    assert "calculator-run" not in events
    assert "upload" not in events
