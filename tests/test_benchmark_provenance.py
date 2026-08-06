from pathlib import Path

from journal_engine.models import PortfolioSnapshot


ROOT = Path(__file__).resolve().parents[1]


def _snapshot_payload():
    return {
        "updated_at": "2026-08-06T00:00:00+00:00",
        "base_currency": "TWD",
        "exchange_rate": 32.0,
        "summary": {
            "total_value": 100000.0,
            "invested_capital": 90000.0,
            "total_pnl": 10000.0,
            "twr": 11.11,
            "xirr": 10.0,
            "realized_pnl": 2000.0,
            "benchmark_twr": 8.5,
        },
        "holdings": [],
        "history": [
            {
                "date": "2026-08-06",
                "total_value": 100000.0,
                "benchmark_twr": 8.5,
                "twr": 11.11,
            }
        ],
        "groups": {},
    }


def test_legacy_snapshot_without_benchmark_identity_remains_valid():
    snapshot = PortfolioSnapshot.model_validate(_snapshot_payload())
    assert snapshot.benchmark_symbol is None
    assert "benchmark_symbol" in snapshot.model_dump()


def test_new_snapshot_round_trips_published_benchmark_identity():
    payload = _snapshot_payload()
    payload["benchmark_symbol"] = "SPY"
    snapshot = PortfolioSnapshot.model_validate(payload)
    assert snapshot.benchmark_symbol == "SPY"
    assert snapshot.model_dump()["benchmark_symbol"] == "SPY"


def test_production_runner_stamps_identity_before_validation_and_upload():
    source = (ROOT / "main.py").read_text(encoding="utf-8")

    calculation_index = source.index("snapshot = calculator.run()")
    none_check_index = source.index("if snapshot is None:", calculation_index)
    stamp_index = source.index("snapshot.benchmark_symbol = benchmark", none_check_index)
    reconcile_index = source.index("reconcile_snapshot_daily_pnl(", stamp_index)
    validate_index = source.index("validate_before_upload(snapshot, validation_df)", reconcile_index)
    upload_index = source.index("api_client.upload_portfolio(snapshot", validate_index)

    assert calculation_index < none_check_index < stamp_index
    assert stamp_index < reconcile_index < validate_index < upload_index


def test_runner_normalizes_environment_benchmark_and_defaults_to_spy(monkeypatch):
    import main

    monkeypatch.delenv("CUSTOM_BENCHMARK", raising=False)
    monkeypatch.delenv("TARGET_USER_ID", raising=False)
    assert main.get_benchmark_from_env() == ("SPY", "")

    monkeypatch.setenv("CUSTOM_BENCHMARK", " qqq ")
    monkeypatch.setenv("TARGET_USER_ID", " user@example.com ")
    assert main.get_benchmark_from_env() == ("QQQ", "user@example.com")
