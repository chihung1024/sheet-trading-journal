import os

import pytest

import main as runner
from journal_engine.clients.api_client import CloudflareAPIError, CloudflareClient


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

    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", fake_get)
    client = CloudflareClient()

    target = client.resolve_calculation_job_target(JOB_ID)

    assert target == TARGET_USER
    assert captured["url"].endswith(f"/api/calculation-jobs/{JOB_ID}")
    assert captured["headers"].get("X-API-KEY")
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
    monkeypatch.setattr(
        "journal_engine.clients.api_client.requests.get",
        lambda *_args, **_kwargs: FakeResponse(status_code, payload),
    )
    client = CloudflareClient()

    with pytest.raises(CloudflareAPIError):
        client.resolve_calculation_job_target(JOB_ID)


def test_runner_opaque_job_target_overrides_legacy_target():
    class FakeClient:
        def resolve_calculation_job_target(self, job_id):
            assert job_id == JOB_ID
            return TARGET_USER

    target = runner.resolve_target_user(
        FakeClient(),
        calculation_job_id=JOB_ID,
        legacy_target_user_id="attacker@example.com",
    )

    assert target == TARGET_USER


def test_runner_without_job_preserves_scheduled_all_user_path():
    class FakeClient:
        def resolve_calculation_job_target(self, _job_id):
            raise AssertionError("scheduled run must not resolve a calculation job")

    assert runner.resolve_target_user(
        FakeClient(),
        calculation_job_id="",
        legacy_target_user_id="",
    ) == ""


def test_runner_legacy_target_remains_available_outside_normal_workflow():
    class FakeClient:
        def resolve_calculation_job_target(self, _job_id):
            raise AssertionError("legacy path must not resolve a calculation job")

    assert runner.resolve_target_user(
        FakeClient(),
        calculation_job_id="",
        legacy_target_user_id="legacy@example.com",
    ) == "legacy@example.com"


def test_run_update_reads_opaque_job_id_instead_of_public_target_env(monkeypatch):
    observed = {}

    class FakeClient:
        def __init__(self):
            pass

        def resolve_calculation_job_target(self, job_id):
            observed["job_id"] = job_id
            return TARGET_USER

        def fetch_records(self, target_user_id=None):
            observed["target_user_id"] = target_user_id
            raise RuntimeError("stop-after-target-resolution")

    monkeypatch.setattr(runner, "CloudflareClient", FakeClient)
    monkeypatch.setattr(runner, "resolve_calculation_context", lambda: object())
    monkeypatch.setattr(runner, "resolve_engine_source_commit", lambda environ=None: "1" * 40)
    monkeypatch.setattr(runner, "MarketDataClient", lambda: object())
    monkeypatch.setenv("CALCULATION_JOB_ID", JOB_ID)
    monkeypatch.setenv("TARGET_USER_ID", "attacker@example.com")
    monkeypatch.setenv("CUSTOM_BENCHMARK", "SPY")

    with pytest.raises(RuntimeError, match="stop-after-target-resolution"):
        runner.run_update()

    assert observed == {"job_id": JOB_ID, "target_user_id": TARGET_USER}
