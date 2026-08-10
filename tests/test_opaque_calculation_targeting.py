import logging
import os
import sys

import pytest
import requests

from journal_engine.clients.api_client import CloudflareAPIError, CloudflareClient
import tools.run_portfolio_update as job_runner


JOB_ID = "job_ABCDEFGHIJKLMNOPQRSTUV"
TARGET_USER = "secret@example.com"
BENCHMARK = "0050.TW"
VERIFIED_CONTEXT = "CALCULATION_JOB_CONTEXT_VERIFIED"


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


def test_verified_job_benchmark_bypasses_live_user_settings(monkeypatch):
    monkeypatch.setenv(VERIFIED_CONTEXT, "1")
    monkeypatch.setenv("TARGET_USER_ID", TARGET_USER)
    monkeypatch.setenv("CUSTOM_BENCHMARK", BENCHMARK)

    def unexpected_get(*_args, **_kwargs):
        raise AssertionError("verified durable benchmark must not re-read user settings")

    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", unexpected_get)

    assert CloudflareClient().get_user_benchmark(TARGET_USER) == BENCHMARK


def test_verified_job_benchmark_rejects_owner_mismatch(monkeypatch):
    monkeypatch.setenv(VERIFIED_CONTEXT, "1")
    monkeypatch.setenv("TARGET_USER_ID", TARGET_USER)
    monkeypatch.setenv("CUSTOM_BENCHMARK", BENCHMARK)

    with pytest.raises(CloudflareAPIError, match="user mismatch"):
        CloudflareClient().get_user_benchmark("other@example.com")


def test_verified_job_benchmark_rejects_invalid_context_benchmark(monkeypatch):
    monkeypatch.setenv(VERIFIED_CONTEXT, "1")
    monkeypatch.setenv("TARGET_USER_ID", TARGET_USER)
    monkeypatch.setenv("CUSTOM_BENCHMARK", "bad benchmark")

    with pytest.raises(CloudflareAPIError, match="benchmark is invalid"):
        CloudflareClient().get_user_benchmark(TARGET_USER)


def test_unverified_user_benchmark_preserves_live_settings_lookup(monkeypatch):
    captured = {}
    monkeypatch.delenv(VERIFIED_CONTEXT, raising=False)

    def fake_get(url, *, headers, timeout):
        captured["url"] = url
        captured["headers"] = headers
        return FakeResponse(200, {"success": True, "benchmark": "QQQ"})

    monkeypatch.setattr("journal_engine.clients.api_client.API_KEY", "test-system-key")
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", fake_get)

    assert CloudflareClient().get_user_benchmark(TARGET_USER) == "QQQ"
    assert captured["url"].endswith("/api/user-settings")
    assert captured["headers"]["X-Target-User"] == TARGET_USER


def test_verified_job_privacy_filter_redacts_real_masked_and_exception_email():
    privacy_filter = job_runner.VerifiedJobPrivacyFilter()
    try:
        raise RuntimeError(f"failure for {TARGET_USER}")
    except RuntimeError:
        exc_info = sys.exc_info()

    record = logging.LogRecord(
        name="privacy-test",
        level=logging.ERROR,
        pathname=__file__,
        lineno=1,
        msg="owner=%s masked=%s",
        args=(TARGET_USER, "se***@example.com"),
        exc_info=exc_info,
    )

    assert privacy_filter.filter(record) is True
    message = record.getMessage()
    assert TARGET_USER not in message
    assert "example.com" not in message
    assert "@" not in message
    assert message == "owner=opaque-job-user masked=opaque-job-user"
    assert record.exc_text is not None
    assert TARGET_USER not in record.exc_text
    assert "example.com" not in record.exc_text
    assert job_runner.TENANT_LOG_LABEL in record.exc_text


def test_privacy_filter_is_installed_only_for_verified_job_context(monkeypatch):
    monkeypatch.delenv(VERIFIED_CONTEXT, raising=False)
    assert job_runner.install_verified_job_privacy_filter() is None

    monkeypatch.setenv(VERIFIED_CONTEXT, "1")
    privacy_filter = job_runner.install_verified_job_privacy_filter()
    try:
        assert isinstance(privacy_filter, job_runner.VerifiedJobPrivacyFilter)
        assert all(
            privacy_filter in handler.filters
            for handler in logging.getLogger().handlers
        )
    finally:
        job_runner.remove_verified_job_privacy_filter(privacy_filter)


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


def test_runner_scheduled_hosted_path_remains_all_user_and_clears_stale_provenance(monkeypatch):
    monkeypatch.delenv("CALCULATION_JOB_ID", raising=False)
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("TARGET_USER_ID", "stale@example.com")
    monkeypatch.setenv("CUSTOM_BENCHMARK", "SPY")
    monkeypatch.setenv(VERIFIED_CONTEXT, "1")

    target, benchmark = job_runner.configure_target_context_from_environment()

    assert target == ""
    assert benchmark == "SPY"
    assert os.environ["TARGET_USER_ID"] == ""
    assert os.environ["CUSTOM_BENCHMARK"] == "SPY"
    assert VERIFIED_CONTEXT not in os.environ


def test_runner_local_legacy_target_is_preserved(monkeypatch):
    monkeypatch.delenv("CALCULATION_JOB_ID", raising=False)
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    monkeypatch.setenv("TARGET_USER_ID", "legacy@example.com")
    monkeypatch.setenv("CUSTOM_BENCHMARK", "QQQ")
    monkeypatch.delenv(VERIFIED_CONTEXT, raising=False)

    target, benchmark = job_runner.configure_target_context_from_environment()

    assert target == "legacy@example.com"
    assert benchmark == "QQQ"
    assert VERIFIED_CONTEXT not in os.environ


def test_entrypoint_resolves_context_before_financial_runner(monkeypatch):
    observed = {}

    class FakeClient:
        def resolve_calculation_job_context(self, job_id):
            observed["job_id"] = job_id
            return TARGET_USER, BENCHMARK

    def fake_run_update():
        observed["target_user_id"] = os.environ.get("TARGET_USER_ID")
        observed["benchmark"] = os.environ.get("CUSTOM_BENCHMARK")
        observed["verified_context"] = os.environ.get(VERIFIED_CONTEXT)

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
        "verified_context": "1",
    }


def test_entrypoint_verified_job_logs_no_tenant_email(monkeypatch, caplog):
    class FakeClient:
        def resolve_calculation_job_context(self, job_id):
            assert job_id == JOB_ID
            return TARGET_USER, BENCHMARK

    def fake_run_update():
        logging.getLogger("main").info(
            "TargetUser=%s masked=%s",
            os.environ["TARGET_USER_ID"],
            "se***@example.com",
        )

    monkeypatch.setattr(job_runner, "CloudflareClient", FakeClient)
    monkeypatch.setattr(job_runner.runner, "setup_logging", lambda: None)
    monkeypatch.setattr(job_runner.runner, "run_update", fake_run_update)
    monkeypatch.setenv("CALCULATION_JOB_ID", JOB_ID)
    monkeypatch.setenv("CUSTOM_BENCHMARK", BENCHMARK)
    monkeypatch.setenv("GITHUB_ACTIONS", "true")

    with caplog.at_level(logging.INFO):
        assert job_runner.main() == 0

    assert TARGET_USER not in caplog.text
    assert "example.com" not in caplog.text
    assert "@" not in caplog.text
    assert "TargetUser=opaque-job-user masked=opaque-job-user" in caplog.text