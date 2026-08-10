import os

import pytest
import requests

from journal_engine.clients.api_client import CloudflareAPIError, CloudflareClient
import tools.run_portfolio_update as job_runner


JOB_ID = "job_ABCDEFGHIJKLMNOPQRSTUV"
TARGET_USER = "secret@example.com"


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_system_client_resolves_calculation_job_target_without_caller_tenant(monkeypatch):
    captured = {}

    def fake_get(url, *, headers, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["timeout"] = timeout
        return FakeResponse(
            200,
            {
                "success": True,
                "job": {
                    "id": JOB_ID,
                    "target_user_id": TARGET_USER,
                    "benchmark": "SPY",
                    "status": "queued",
                },
            },
        )

    monkeypatch.setattr("journal_engine.clients.api_client.API_KEY", "test-system-key")
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", fake_get)
    client = CloudflareClient()

    target = client.resolve_calculation_job_target(JOB_ID)

    assert target == TARGET_USER
    assert captured["url"].endswith(f"/api/calculation-jobs/{JOB_ID}")
    assert captured["headers"].get("X-API-KEY") == "test-system-key"
    assert "X-Target-User" not in captured["headers"]


@pytest.mark.parametrize(
    ("status_code", "payload"),
    [
        (404, {"success": False}),
        (200, {"success": False}),
        (200, {"success": True, "job": None}),
        (200, {"success": True, "job": {"id": JOB_ID, "target_user_id": ""}}),
        (200, {"success": True, "job": {"id": JOB_ID, "target_user_id": None}}),
    ],
)
def test_system_client_job_target_lookup_fails_closed(monkeypatch, status_code, payload):
    monkeypatch.setattr("journal_engine.clients.api_client.API_KEY", "test-system-key")
    monkeypatch.setattr(
        "journal_engine.clients.api_client.requests.get",
        lambda *_args, **_kwargs: FakeResponse(status_code, payload),
    )
    client = CloudflareClient()

    with pytest.raises(CloudflareAPIError):
        client.resolve_calculation_job_target(JOB_ID)


def test_system_client_job_target_rejects_blank_job_id():
    client = CloudflareClient()

    with pytest.raises(CloudflareAPIError, match="requires a job id"):
        client.resolve_calculation_job_target("   ")


def test_system_client_job_target_transport_failure_fails_closed(monkeypatch):
    def fail_get(*_args, **_kwargs):
        raise requests.RequestException("transport failure")

    monkeypatch.setattr("journal_engine.clients.api_client.API_KEY", "test-system-key")
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", fail_get)
    client = CloudflareClient()

    with pytest.raises(CloudflareAPIError, match="lookup failed"):
        client.resolve_calculation_job_target(JOB_ID)


def test_system_client_job_target_rejects_mismatched_job_id(monkeypatch):
    monkeypatch.setattr("journal_engine.clients.api_client.API_KEY", "test-system-key")
    monkeypatch.setattr(
        "journal_engine.clients.api_client.requests.get",
        lambda *_args, **_kwargs: FakeResponse(
            200,
            {
                "success": True,
                "job": {
                    "id": "job_1234567890123456789012",
                    "target_user_id": TARGET_USER,
                },
            },
        ),
    )
    client = CloudflareClient()

    with pytest.raises(CloudflareAPIError, match="mismatched job"):
        client.resolve_calculation_job_target(JOB_ID)


def test_entrypoint_opaque_job_target_overrides_legacy_target():
    class FakeClient:
        def resolve_calculation_job_target(self, job_id):
            assert job_id == JOB_ID
            return TARGET_USER

    target = job_runner.resolve_target_user(
        FakeClient(),
        calculation_job_id=JOB_ID,
        legacy_target_user_id="attacker@example.com",
    )

    assert target == TARGET_USER


def test_entrypoint_without_job_preserves_scheduled_all_user_path():
    class FakeClient:
        def resolve_calculation_job_target(self, _job_id):
            raise AssertionError("scheduled run must not resolve a calculation job")

    assert job_runner.resolve_target_user(
        FakeClient(),
        calculation_job_id="",
        legacy_target_user_id="",
    ) == ""


def test_entrypoint_legacy_target_remains_available_outside_normal_workflow():
    class FakeClient:
        def resolve_calculation_job_target(self, _job_id):
            raise AssertionError("legacy path must not resolve a calculation job")

    assert job_runner.resolve_target_user(
        FakeClient(),
        calculation_job_id="",
        legacy_target_user_id="legacy@example.com",
    ) == "legacy@example.com"


def test_entrypoint_resolves_job_before_financial_runner(monkeypatch):
    observed = {}

    class FakeClient:
        def resolve_calculation_job_target(self, job_id):
            observed["job_id"] = job_id
            return TARGET_USER

    def fake_run_update():
        observed["target_user_id"] = os.environ.get("TARGET_USER_ID")

    monkeypatch.setattr(job_runner, "CloudflareClient", FakeClient)
    monkeypatch.setattr(job_runner.runner, "setup_logging", lambda: None)
    monkeypatch.setattr(job_runner.runner, "run_update", fake_run_update)
    monkeypatch.setenv("CALCULATION_JOB_ID", JOB_ID)
    monkeypatch.setenv("TARGET_USER_ID", "attacker@example.com")
    monkeypatch.setenv("GITHUB_ACTIONS", "true")

    assert job_runner.main() == 0
    assert observed == {"job_id": JOB_ID, "target_user_id": TARGET_USER}


def test_entrypoint_scheduled_run_clears_stale_target_env(monkeypatch):
    observed = {}

    def fake_run_update():
        observed["target_user_id"] = os.environ.get("TARGET_USER_ID", "<missing>")

    class FakeClient:
        def resolve_calculation_job_target(self, _job_id):
            raise AssertionError("scheduled run must not resolve a job")

    monkeypatch.setattr(job_runner, "CloudflareClient", FakeClient)
    monkeypatch.setattr(job_runner.runner, "setup_logging", lambda: None)
    monkeypatch.setattr(job_runner.runner, "run_update", fake_run_update)
    monkeypatch.delenv("CALCULATION_JOB_ID", raising=False)
    monkeypatch.setenv("TARGET_USER_ID", "stale@example.com")
    monkeypatch.setenv("GITHUB_ACTIONS", "true")

    assert job_runner.main() == 0
    assert observed["target_user_id"] == ""


def test_entrypoint_local_legacy_target_is_preserved(monkeypatch):
    observed = {}

    def fake_run_update():
        observed["target_user_id"] = os.environ.get("TARGET_USER_ID")

    monkeypatch.setattr(job_runner.runner, "setup_logging", lambda: None)
    monkeypatch.setattr(job_runner.runner, "run_update", fake_run_update)
    monkeypatch.delenv("CALCULATION_JOB_ID", raising=False)
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    monkeypatch.setenv("TARGET_USER_ID", "legacy@example.com")

    assert job_runner.main() == 0
    assert observed["target_user_id"] == "legacy@example.com"
