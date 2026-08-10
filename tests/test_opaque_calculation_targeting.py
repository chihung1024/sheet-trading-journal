import os

import pytest
import requests

from journal_engine.clients.api_client import CloudflareAPIError, CloudflareClient
import tools.run_portfolio_update as job_runner


JOB_ID = "job_ABCDEFGHIJKLMNOPQRSTUV"
TARGET_USER = "secret@example.com"
BENCHMARK = "0050.TW"


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def job_payload(**overrides):
    job = {
        "id": JOB_ID,
        "target_user_id": TARGET_USER,
        "benchmark": BENCHMARK,
        "status": "running",
    }
    job.update(overrides)
    return {"success": True, "job": job}


def test_system_client_resolves_running_job_owner_and_durable_benchmark(monkeypatch):
    captured = {}

    def fake_get(url, *, headers, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["timeout"] = timeout
        return FakeResponse(200, job_payload())

    monkeypatch.setattr("journal_engine.clients.api_client.API_KEY", "test-system-key")
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", fake_get)
    client = CloudflareClient()

    target, benchmark = client.resolve_calculation_job_context(JOB_ID)

    assert target == TARGET_USER
    assert benchmark == BENCHMARK
    assert captured["url"].endswith(f"/api/calculation-jobs/{JOB_ID}")
    assert captured["headers"] == {"X-API-KEY": "test-system-key"}
    assert "X-Target-User" not in captured["headers"]


@pytest.mark.parametrize("status", ["", "queued", "succeeded", "failed"])
def test_system_client_rejects_non_running_job_context(monkeypatch, status):
    monkeypatch.setattr("journal_engine.clients.api_client.API_KEY", "test-system-key")
    monkeypatch.setattr(
        "journal_engine.clients.api_client.requests.get",
        lambda *_args, **_kwargs: FakeResponse(200, job_payload(status=status)),
    )

    with pytest.raises(CloudflareAPIError, match="not runnable"):
        CloudflareClient().resolve_calculation_job_context(JOB_ID)


@pytest.mark.parametrize(
    ("status_code", "payload", "message"),
    [
        (404, {"success": False}, "lookup failed"),
        (200, {"success": False}, "success=true"),
        (200, {"success": True, "job": None}, "invalid job"),
        (200, job_payload(id="job_1234567890123456789012"), "mismatched job"),
        (200, job_payload(target_user_id=""), "valid owner"),
        (200, job_payload(benchmark="bad benchmark"), "invalid benchmark"),
    ],
)
def test_system_client_job_context_fails_closed(monkeypatch, status_code, payload, message):
    monkeypatch.setattr("journal_engine.clients.api_client.API_KEY", "test-system-key")
    monkeypatch.setattr(
        "journal_engine.clients.api_client.requests.get",
        lambda *_args, **_kwargs: FakeResponse(status_code, payload),
    )

    with pytest.raises(CloudflareAPIError, match=message):
        CloudflareClient().resolve_calculation_job_context(JOB_ID)


def test_system_client_job_context_transport_failure_fails_closed(monkeypatch):
    def fail_get(*_args, **_kwargs):
        raise requests.RequestException("transport failure")

    monkeypatch.setattr("journal_engine.clients.api_client.API_KEY", "test-system-key")
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", fail_get)

    with pytest.raises(CloudflareAPIError, match="lookup failed"):
        CloudflareClient().resolve_calculation_job_context(JOB_ID)


def test_runner_uses_durable_owner_and_benchmark_when_job_context_matches_dispatch():
    class FakeClient:
        def resolve_calculation_job_context(self, job_id):
            assert job_id == JOB_ID
            return TARGET_USER, BENCHMARK

    target, benchmark = job_runner.resolve_target_context(
        FakeClient(),
        calculation_job_id=JOB_ID,
        legacy_target_user_id="attacker@example.com",
        requested_benchmark=BENCHMARK,
    )

    assert target == TARGET_USER
    assert benchmark == BENCHMARK


def test_runner_fails_closed_when_dispatch_benchmark_diverges_from_durable_job():
    class FakeClient:
        def resolve_calculation_job_context(self, _job_id):
            return TARGET_USER, BENCHMARK

    with pytest.raises(CloudflareAPIError, match="benchmark mismatch"):
        job_runner.resolve_target_context(
            FakeClient(),
            calculation_job_id=JOB_ID,
            legacy_target_user_id="",
            requested_benchmark="SPY",
        )


def test_runner_scheduled_hosted_path_remains_all_user(monkeypatch):
    monkeypatch.delenv("CALCULATION_JOB_ID", raising=False)
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("TARGET_USER_ID", "stale@example.com")
    monkeypatch.setenv("CUSTOM_BENCHMARK", "SPY")

    target, benchmark = job_runner.configure_target_context_from_environment()

    assert target == ""
    assert benchmark == "SPY"
    assert os.environ["TARGET_USER_ID"] == ""
    assert os.environ["CUSTOM_BENCHMARK"] == "SPY"


def test_runner_local_legacy_target_is_preserved(monkeypatch):
    monkeypatch.delenv("CALCULATION_JOB_ID", raising=False)
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    monkeypatch.setenv("TARGET_USER_ID", "legacy@example.com")
    monkeypatch.setenv("CUSTOM_BENCHMARK", "QQQ")

    target, benchmark = job_runner.configure_target_context_from_environment()

    assert target == "legacy@example.com"
    assert benchmark == "QQQ"


def test_entrypoint_resolves_context_before_financial_runner(monkeypatch):
    observed = {}

    class FakeClient:
        def resolve_calculation_job_context(self, job_id):
            observed["job_id"] = job_id
            return TARGET_USER, BENCHMARK

    def fake_run_update():
        observed["target_user_id"] = os.environ.get("TARGET_USER_ID")
        observed["benchmark"] = os.environ.get("CUSTOM_BENCHMARK")

    monkeypatch.setattr(job_runner, "CloudflareClient", FakeClient)
    monkeypatch.setattr(job_runner.runner, "setup_logging", lambda: None)
    monkeypatch.setattr(job_runner.runner, "run_update", fake_run_update)
    monkeypatch.setenv("CALCULATION_JOB_ID", JOB_ID)
    monkeypatch.setenv("TARGET_USER_ID", "attacker@example.com")
    monkeypatch.setenv("CUSTOM_BENCHMARK", BENCHMARK)
    monkeypatch.setenv("GITHUB_ACTIONS", "true")

    assert job_runner.main() == 0
    assert observed == {
        "job_id": JOB_ID,
        "target_user_id": TARGET_USER,
        "benchmark": BENCHMARK,
    }
