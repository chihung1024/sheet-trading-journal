from pathlib import Path

import yaml


def test_update_workflow_is_valid_yaml_and_has_job_callbacks():
    workflow_path = Path(".github/workflows/update.yml")
    workflow = yaml.load(workflow_path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)

    assert isinstance(workflow, dict)
    assert "on" in workflow
    assert "workflow_dispatch" in workflow["on"]
    inputs = workflow["on"]["workflow_dispatch"]["inputs"]
    assert "calculation_job_id" in inputs
    assert "transaction_integrity_audit_only" in inputs
    assert inputs["transaction_integrity_audit_only"]["default"] == "false"
    assert inputs["transaction_integrity_audit_only"]["type"] == "boolean"

    job = workflow["jobs"]["run-and-upload"]
    steps = {step["name"]: step for step in job["steps"]}

    callback_guard = steps["Reject audit mode calculation callbacks"]
    assert "transaction_integrity_audit_only == 'true'" in callback_guard["if"]
    assert "calculation_job_id != ''" in callback_guard["if"]

    running = steps["Mark calculation job running"]
    assert set(running["env"]) >= {
        "API_KEY",
        "JOB_ID",
        "GITHUB_RUN_ID_VALUE",
        "GITHUB_RUN_ATTEMPT_VALUE",
        "WORKER_BASE_URL",
    }
    assert "transaction_integrity_audit_only != 'true'" in running["if"]
    assert "/api/calculation-jobs/status" in running["run"]

    audit = steps["Run transaction integrity read-only audit"]
    assert "transaction_integrity_audit_only == 'true'" in audit["if"]
    assert set(audit["env"]) == {"API_KEY", "TARGET_USER_ID"}
    assert audit["run"] == "python tools/audit_transaction_integrity.py"
    assert "CUSTOM_BENCHMARK" not in audit["env"]

    calculation = steps["Run calculation and upload to API"]
    assert calculation["id"] == "calculation"
    assert calculation["continue-on-error"] == "true"
    assert "transaction_integrity_audit_only != 'true'" in calculation["if"]
    assert calculation["run"] == "python tools/run_portfolio_update.py"

    result = steps["Report calculation job result"]
    assert "always()" in result["if"]
    assert "transaction_integrity_audit_only != 'true'" in result["if"]
    assert "/api/calculation-jobs/status" in result["run"]

    final_failure = steps["Fail workflow when calculation failed"]
    assert "transaction_integrity_audit_only != 'true'" in final_failure["if"]
    assert "steps.calculation.outcome" in final_failure["if"]


def test_production_identity_workflow_preserves_failed_collector_evidence():
    workflow_path = Path(".github/workflows/production-identity-evidence.yml")
    workflow = yaml.load(workflow_path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)

    assert isinstance(workflow, dict)
    job = workflow["jobs"]["production-readonly"]
    steps = {step.get("name"): step for step in job["steps"] if step.get("name")}

    collect = steps["Collect sanitized Cloudflare and live frontend evidence"]
    assert collect["id"] == "collect"

    upload = steps["Upload sanitized read-only evidence"]
    assert "always()" in upload["if"]
    assert "steps.collect.outcome != 'skipped'" in upload["if"]
    assert upload["with"]["if-no-files-found"] == "error"
