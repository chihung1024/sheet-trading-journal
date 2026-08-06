from pathlib import Path

import yaml


def test_update_workflow_is_valid_yaml_and_has_job_callbacks():
    workflow_path = Path(".github/workflows/update.yml")
    workflow = yaml.load(workflow_path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)

    assert isinstance(workflow, dict)
    assert "on" in workflow
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
