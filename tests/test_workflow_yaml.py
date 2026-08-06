from pathlib import Path

import yaml


def load_workflow(name: str):
    workflow_path = Path(".github/workflows") / name
    workflow = yaml.load(workflow_path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    assert isinstance(workflow, dict)
    assert "on" in workflow
    return workflow


def test_update_workflow_is_valid_yaml_and_has_job_callbacks():
    workflow = load_workflow("update.yml")
    assert "workflow_dispatch" in workflow["on"]
    assert "calculation_job_id" in workflow["on"]["workflow_dispatch"]["inputs"]

    job = workflow["jobs"]["run-and-upload"]
    steps = {step["name"]: step for step in job["steps"]}

    running = steps["Mark calculation job running"]
    assert set(running["env"]) >= {
        "API_KEY",
        "JOB_ID",
        "GITHUB_RUN_ID_VALUE",
        "GITHUB_RUN_ATTEMPT_VALUE",
        "WORKER_BASE_URL",
    }
    assert "/api/calculation-jobs/status" in running["run"]

    calculation = steps["Run calculation and upload to API"]
    assert calculation["id"] == "calculation"
    assert calculation["continue-on-error"] == "true"

    result = steps["Report calculation job result"]
    assert "always()" in result["if"]
    assert "/api/calculation-jobs/status" in result["run"]

    final_failure = steps["Fail workflow when calculation failed"]
    assert "steps.calculation.outcome" in final_failure["if"]


def test_staging_deploy_workflow_is_valid_yaml_and_environment_protected():
    workflow = load_workflow("deploy-worker-staging.yml")
    dispatch = workflow["on"]["workflow_dispatch"]
    assert set(dispatch["inputs"]) == {"source_sha", "confirm_environment"}

    assert workflow["permissions"] == {"contents": "read"}
    job = workflow["jobs"]["deploy-staging"]
    assert job["environment"] == "staging"
    assert job["timeout-minutes"] == "30"

    steps = {step["name"]: step for step in job["steps"]}
    assert "Verify staging confirmation and exact main-reachable source" in steps
    assert "Verify protected staging inputs" in steps
    assert "Render isolated staging Wrangler config" in steps
    assert "Apply migrations to staging D1 only" in steps
    assert "Install isolated staging API secret" in steps
    assert "Deploy exact staging Worker source" in steps
    assert "Verify exact staging deployment readiness" in steps
