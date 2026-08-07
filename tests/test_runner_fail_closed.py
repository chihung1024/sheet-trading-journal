from datetime import datetime
from types import SimpleNamespace

import pandas as pd
import pytest
import requests

import main as runner
from journal_engine.clients import api_client as api_module
from journal_engine.clients.api_client import CloudflareAPIError, CloudflareClient
from journal_engine.core.validator import PortfolioValidator
from journal_engine.models import (
    PortfolioGroupData,
    PortfolioSnapshot,
    PortfolioSummary,
)


class FakeResponse:
    def __init__(self, status_code=200, payload=None, json_error=None):
        self.status_code = status_code
        self._payload = payload
        self._json_error = json_error

    def json(self):
        if self._json_error:
            raise self._json_error
        return self._payload


def make_records():
    return [
        {
            "id": 1,
            "user_id": "alpha@example.com",
            "txn_date": "2026-01-01",
            "symbol": "NVDA",
            "txn_type": "BUY",
            "qty": 1,
            "price": 100,
            "fee": 0,
            "tax": 0,
            "tag": "",
        },
        {
            "id": 2,
            "user_id": "beta@example.com",
            "txn_date": "2026-01-02",
            "symbol": "0050.TW",
            "txn_type": "BUY",
            "qty": 2,
            "price": 50,
            "fee": 0,
            "tax": 0,
            "tag": "",
        },
    ]


def make_snapshot(xirr=0.0):
    summary = PortfolioSummary(
        total_value=0,
        invested_capital=0,
        total_pnl=0,
        twr=0,
        xirr=xirr,
        realized_pnl=0,
        benchmark_twr=0,
        daily_pnl_twd=0,
        daily_pnl_breakdown={
            "tw_pnl_twd": 0,
            "us_pnl_twd": 0,
            "fx_pnl_twd": 0,
        },
    )
    group = PortfolioGroupData(
        summary=summary,
        holdings=[],
        history=[{"date": "2026-01-01", "twr": 0}],
    )
    return PortfolioSnapshot(
        updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
        base_currency="TWD",
        exchange_rate=32,
        summary=summary,
        holdings=[],
        history=group.history,
        groups={"all": group},
    )


def test_prepare_transactions_enforces_target_user_isolation():
    df, users = runner.prepare_transactions(make_records(), "beta@example.com")

    assert users == ["beta@example.com"]
    assert set(df["user_id"]) == {"beta@example.com"}
    assert set(df["Symbol"]) == {"0050.TW"}


def test_prepare_transactions_rejects_missing_target():
    with pytest.raises(runner.PortfolioUpdateError, match="找不到目標使用者"):
        runner.prepare_transactions(make_records(), "missing@example.com")


def test_prepare_transactions_rejects_empty_api_result():
    with pytest.raises(runner.PortfolioUpdateError, match="零筆資料"):
        runner.prepare_transactions([], "")


def test_prepare_transactions_rejects_non_positive_quantity():
    for quantity in (0, -1):
        records = make_records()[:1]
        records[0]["qty"] = quantity
        with pytest.raises(runner.PortfolioUpdateError, match="Qty 必須大於 0"):
            runner.prepare_transactions(records)


def test_prepare_transactions_rejects_negative_price_but_preserves_zero_compatibility():
    records = make_records()[:1]
    records[0]["price"] = -0.01
    with pytest.raises(runner.PortfolioUpdateError, match="Price 不得小於 0"):
        runner.prepare_transactions(records)

    records[0]["price"] = 0
    normalized, _ = runner.prepare_transactions(records)
    assert normalized.loc[0, "Price"] == 0


def test_required_market_data_accepts_positive_price_series():
    client = SimpleNamespace(
        market_data={
            "NVDA": pd.DataFrame(
                {"Close_Adjusted": [100.0, 101.0], "Stock Splits": [0.0, 0.0]},
                index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
            ),
            "SPY": pd.DataFrame(
                {"Close_Adjusted": [200.0, 202.0], "Stock Splits": [0.0, 0.0]},
                index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
            ),
        }
    )

    runner.validate_required_market_data(
        client,
        {"NVDA", "SPY"},
        required_dates_by_ticker={"NVDA": "2026-01-02", "SPY": "2026-01-01"},
    )


def test_required_market_data_rejects_missing_required_ticker():
    client = SimpleNamespace(market_data={})

    with pytest.raises(runner.PortfolioUpdateError, match="缺少資料: NVDA"):
        runner.validate_required_market_data(client, {"NVDA"})


def test_required_market_data_rejects_zero_or_negative_price_series():
    for price in (0.0, -1.0):
        client = SimpleNamespace(
            market_data={
                "NVDA": pd.DataFrame(
                    {"Close_Adjusted": [100.0, price]},
                    index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
                )
            }
        )
        with pytest.raises(runner.PortfolioUpdateError, match="價格資料無效: NVDA"):
            runner.validate_required_market_data(client, {"NVDA"})


def test_required_market_data_rejects_nan_price_series():
    client = SimpleNamespace(
        market_data={
            "NVDA": pd.DataFrame(
                {"Close_Adjusted": [100.0, float("nan")]},
                index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
            )
        }
    )

    with pytest.raises(runner.PortfolioUpdateError, match="價格資料無效: NVDA"):
        runner.validate_required_market_data(client, {"NVDA"})


def test_required_market_data_rejects_price_series_that_starts_after_required_date():
    client = SimpleNamespace(
        market_data={
            "SPY": pd.DataFrame(
                {"Close_Adjusted": [200.0]},
                index=pd.to_datetime(["2026-01-02"]),
            )
        }
    )

    with pytest.raises(runner.PortfolioUpdateError, match="價格歷史覆蓋不足: SPY@2026-01-01"):
        runner.validate_required_market_data(
            client,
            {"SPY"},
            required_dates_by_ticker={"SPY": "2026-01-01"},
        )


def test_required_market_data_rejects_missing_required_currency_fx():
    client = SimpleNamespace(
        market_data={
            "005930.KS": pd.DataFrame(
                {"Close_Adjusted": [100000.0, 101000.0]},
                index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
            )
        },
        validate_required_fx_data=lambda tickers: ["KRW"],
    )

    with pytest.raises(runner.PortfolioUpdateError, match="缺少匯率幣別: KRW"):
        runner.validate_required_market_data(client, {"005930.KS"})


def test_required_market_data_rejects_fx_series_that_starts_after_required_date():
    client = SimpleNamespace(
        market_data={
            "005930.KS": pd.DataFrame(
                {"Close_Adjusted": [100000.0, 101000.0]},
                index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
            )
        },
        validate_required_fx_data=lambda tickers: [],
        fx_rates_by_currency={
            "KRW": pd.Series([0.022], index=pd.to_datetime(["2026-01-02"]))
        },
    )

    with pytest.raises(
        runner.PortfolioUpdateError,
        match="匯率歷史覆蓋不足: 005930.KS/KRW@2026-01-01",
    ):
        runner.validate_required_market_data(
            client,
            {"005930.KS"},
            required_dates_by_ticker={"005930.KS": "2026-01-01"},
        )


def test_mask_user_id_hides_local_part():
    masked = runner.mask_user_id("chired@gmail.com")

    assert masked == "ch***@gmail.com"
    assert "chired" not in masked


def test_fetch_records_sends_target_header(monkeypatch):
    captured = {}

    def fake_get(url, **kwargs):
        captured.update(kwargs)
        return FakeResponse(200, {"success": True, "data": make_records()[:1]})

    monkeypatch.setattr(api_module.requests, "get", fake_get)
    records = CloudflareClient().fetch_records("alpha@example.com")

    assert len(records) == 1
    assert captured["headers"]["X-Target-User"] == "alpha@example.com"
    assert captured["timeout"] == api_module.REQUEST_TIMEOUT


def test_fetch_records_network_error_is_fatal(monkeypatch):
    def fake_get(*args, **kwargs):
        raise requests.Timeout("timeout")

    monkeypatch.setattr(api_module.requests, "get", fake_get)

    with pytest.raises(CloudflareAPIError, match="連線失敗"):
        CloudflareClient().fetch_records()


def test_fetch_records_rejects_success_false(monkeypatch):
    monkeypatch.setattr(
        api_module.requests,
        "get",
        lambda *args, **kwargs: FakeResponse(200, {"success": False, "data": []}),
    )

    with pytest.raises(CloudflareAPIError, match="success=true"):
        CloudflareClient().fetch_records()


def test_upload_requires_worker_confirmation(monkeypatch):
    monkeypatch.setattr(
        api_module.requests,
        "post",
        lambda *args, **kwargs: FakeResponse(200, {"success": False}),
    )
    snapshot = SimpleNamespace(model_dump=lambda: {"summary": {}})

    with pytest.raises(CloudflareAPIError, match="未確認上傳成功"):
        CloudflareClient().upload_portfolio(snapshot, "alpha@example.com")


def test_upload_returns_true_only_on_verified_success(monkeypatch):
    captured = {}

    def fake_post(url, **kwargs):
        captured.update(kwargs)
        return FakeResponse(200, {"success": True})

    monkeypatch.setattr(api_module.requests, "post", fake_post)
    snapshot = SimpleNamespace(model_dump=lambda: {"summary": {}})

    assert CloudflareClient().upload_portfolio(snapshot, "alpha@example.com") is True
    assert captured["timeout"] == api_module.REQUEST_TIMEOUT


def test_snapshot_validator_rejects_non_finite_xirr():
    snapshot = make_snapshot(xirr=float("nan"))
    transactions = pd.DataFrame()

    assert PortfolioValidator.validate_snapshot_for_upload(snapshot, transactions) is False


def test_main_returns_nonzero_when_update_fails(monkeypatch):
    def fail():
        raise runner.PortfolioUpdateError("expected failure")

    monkeypatch.setattr(runner, "run_update", fail)

    assert runner.main() == 1


def test_run_update_only_touches_requested_user(monkeypatch):
    observed = {
        "fetch_target": None,
        "benchmarks": [],
        "tickers": [],
        "uploads": [],
        "calculator_users": [],
    }

    class FakeAPIClient:
        def fetch_records(self, target_user_id=None):
            observed["fetch_target"] = target_user_id
            return make_records()

        def get_user_benchmark(self, user_id):
            observed["benchmarks"].append(user_id)
            return "0050.TW"

        def upload_portfolio(self, snapshot, target_user_id=None):
            observed["uploads"].append(target_user_id)
            return True

    class FakeMarketClient:
        def __init__(self):
            self.market_data = {}

        def download_data(self, tickers, start_date):
            observed["tickers"] = list(tickers)
            dates = pd.to_datetime(["2026-01-01", "2026-01-02"])
            self.market_data = {
                ticker: pd.DataFrame(
                    {
                        "Close_Adjusted": [49.0, 50.0],
                        "Close_Raw": [49.0, 50.0],
                        "Split_Factor": [1.0, 1.0],
                        "Dividends": [0.0, 0.0],
                        "Stock Splits": [0.0, 0.0],
                    },
                    index=dates,
                )
                for ticker in tickers
            }

        def get_transaction_multiplier(self, symbol, date):
            return 1.0

    class FakeCalculator:
        def __init__(self, user_df, market_client, benchmark_ticker, api_client):
            self.df = user_df.copy(deep=True)
            observed["calculator_users"].extend(user_df["user_id"].unique().tolist())

        def run(self):
            return make_snapshot()

    monkeypatch.setattr(runner, "API_KEY", "secret")
    monkeypatch.setattr(runner, "CloudflareClient", FakeAPIClient)
    monkeypatch.setattr(runner, "MarketDataClient", FakeMarketClient)
    monkeypatch.setattr(runner, "PortfolioCalculator", FakeCalculator)
    monkeypatch.setattr(runner, "validate_before_upload", lambda snapshot, user_df: None)
    monkeypatch.setenv("TARGET_USER_ID", "beta@example.com")
    monkeypatch.setenv("CUSTOM_BENCHMARK", "SPY")

    runner.run_update()

    assert observed["fetch_target"] == "beta@example.com"
    assert observed["benchmarks"] == ["beta@example.com"]
    assert observed["uploads"] == ["beta@example.com"]
    assert observed["calculator_users"] == ["beta@example.com"]
    assert set(observed["tickers"]) == {"0050.TW"}
