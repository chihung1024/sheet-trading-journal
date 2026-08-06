"""Fail-closed verification for the repository's measured Python coverage baseline."""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path
from typing import Any


SHA_RE = re.compile(r"^[0-9a-f]{40}$")
COUNT_KEYS = (
    "num_statements",
    "covered_lines",
    "missing_lines",
    "num_branches",
    "covered_branches",
    "missing_branches",
)
TOTAL_KEYS = (*COUNT_KEYS, "percent_covered")
ALLOWED_RUNTIME_CHANGES = {
    "none",
    "non_finite_fx_fail_safe_only",
}


class CoveragePolicyError(ValueError):
    """Raised when the report or policy fails closed."""


def _read_object(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise CoveragePolicyError(f"cannot read {label}: {exc}") from exc
    if not isinstance(value, dict):
        raise CoveragePolicyError(f"{label} must be a JSON object")
    return value


def _finite_number(value: Any, label: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise CoveragePolicyError(f"{label} must be numeric")
    numeric = float(value)
    if not math.isfinite(numeric) or numeric < 0:
        raise CoveragePolicyError(f"{label} must be finite and non-negative")
    return numeric


def _count(value: Any, label: str) -> int:
    numeric = _finite_number(value, label)
    if not numeric.is_integer():
        raise CoveragePolicyError(f"{label} must be an integer")
    return int(numeric)


def _exact_sha(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SHA_RE.fullmatch(value):
        raise CoveragePolicyError(f"{label} must be an exact commit SHA")
    return value


def sanitize_totals(raw_totals: Any, label: str = "coverage totals") -> dict[str, int | float]:
    if not isinstance(raw_totals, dict):
        raise CoveragePolicyError(f"{label} must be an object")

    totals: dict[str, int | float] = {
        key: _count(raw_totals.get(key), f"{label}.{key}") for key in COUNT_KEYS
    }
    totals["percent_covered"] = _finite_number(
        raw_totals.get("percent_covered"), f"{label}.percent_covered"
    )

    if totals["covered_lines"] + totals["missing_lines"] != totals["num_statements"]:
        raise CoveragePolicyError(f"{label} line counts do not reconcile")
    if totals["covered_branches"] + totals["missing_branches"] != totals["num_branches"]:
        raise CoveragePolicyError(f"{label} branch counts do not reconcile")

    denominator = totals["num_statements"] + totals["num_branches"]
    if denominator <= 0:
        raise CoveragePolicyError(f"{label} denominator must be positive")
    calculated = (
        (totals["covered_lines"] + totals["covered_branches"]) / denominator * 100
    )
    if not math.isclose(
        float(totals["percent_covered"]), calculated, rel_tol=0, abs_tol=1e-9
    ):
        raise CoveragePolicyError(f"{label} percent does not reconcile with raw counts")
    return totals


def _sanitize_gates(raw_gates: Any, label: str = "baseline gates") -> dict[str, int | float]:
    if not isinstance(raw_gates, dict):
        raise CoveragePolicyError(f"{label} are missing")
    return {
        "minimum_percent_covered": _finite_number(
            raw_gates.get("minimum_percent_covered"),
            f"{label}.minimum_percent_covered",
        ),
        "minimum_covered_lines": _count(
            raw_gates.get("minimum_covered_lines"),
            f"{label}.minimum_covered_lines",
        ),
        "minimum_covered_branches": _count(
            raw_gates.get("minimum_covered_branches"),
            f"{label}.minimum_covered_branches",
        ),
        "maximum_missing_lines": _count(
            raw_gates.get("maximum_missing_lines"),
            f"{label}.maximum_missing_lines",
        ),
        "maximum_missing_branches": _count(
            raw_gates.get("maximum_missing_branches"),
            f"{label}.maximum_missing_branches",
        ),
    }


def _validate_revision(revision: Any) -> None:
    if not isinstance(revision, dict):
        raise CoveragePolicyError("current_revision must be an object")
    if not isinstance(revision.get("batch"), str) or not revision["batch"].startswith("PR-"):
        raise CoveragePolicyError("current_revision.batch is invalid")
    if not isinstance(revision.get("issue"), int) or isinstance(revision["issue"], bool) or revision["issue"] <= 0:
        raise CoveragePolicyError("current_revision.issue must be a positive integer")
    _exact_sha(revision.get("baseline_main_sha"), "current_revision.baseline_main_sha")
    if not isinstance(revision.get("captured_at_utc"), str) or not revision["captured_at_utc"]:
        raise CoveragePolicyError("current_revision.captured_at_utc is invalid")


def _validate_history(history: Any, current_gates: dict[str, int | float]) -> None:
    if history is None:
        return
    if not isinstance(history, list) or not history:
        raise CoveragePolicyError("baseline history must be a non-empty list")

    previous_gates: dict[str, int | float] | None = None
    for index, item in enumerate(history):
        label = f"history[{index}]"
        if not isinstance(item, dict):
            raise CoveragePolicyError(f"{label} must be an object")
        _exact_sha(item.get("baseline_main_sha"), f"{label}.baseline_main_sha")
        sanitize_totals(item.get("observed"), f"{label}.observed")
        previous_gates = _sanitize_gates(item.get("gates"), f"{label}.gates")

    assert previous_gates is not None
    weaker = []
    for key in (
        "minimum_percent_covered",
        "minimum_covered_lines",
        "minimum_covered_branches",
    ):
        if current_gates[key] < previous_gates[key]:
            weaker.append(key)
    for key in ("maximum_missing_lines", "maximum_missing_branches"):
        if current_gates[key] > previous_gates[key]:
            weaker.append(key)
    if weaker:
        raise CoveragePolicyError(
            "current coverage gates are weaker than retained history: " + ", ".join(weaker)
        )


def validate_baseline(baseline: dict[str, Any]) -> None:
    if baseline.get("schema_version") != 1:
        raise CoveragePolicyError("baseline schema_version must be 1")
    if baseline.get("batch") != "PR-10B3" or baseline.get("issue") != 82:
        raise CoveragePolicyError("baseline control-origin identity is invalid")
    _exact_sha(baseline.get("baseline_main_sha"), "baseline_main_sha")

    current_revision = baseline.get("current_revision")
    if current_revision is not None:
        _validate_revision(current_revision)

    policy = baseline.get("policy")
    if not isinstance(policy, dict):
        raise CoveragePolicyError("baseline policy is missing")
    if policy.get("cost_model") != "free-only":
        raise CoveragePolicyError("baseline cost policy is invalid")
    if policy.get("runtime_change") not in ALLOWED_RUNTIME_CHANGES:
        raise CoveragePolicyError("baseline runtime-change policy is invalid")
    if policy.get("baseline_update_requires_review") is not True:
        raise CoveragePolicyError("baseline updates must require review")

    scope = baseline.get("source_scope")
    if not isinstance(scope, dict) or scope.get("branch_coverage") is not True:
        raise CoveragePolicyError("branch coverage must remain enabled")
    exact_files = scope.get("exact_files")
    if (
        not isinstance(exact_files, list)
        or not exact_files
        or any(not isinstance(item, str) or not item for item in exact_files)
        or exact_files != sorted(set(exact_files))
    ):
        raise CoveragePolicyError("source_scope.exact_files must be sorted and unique")

    sanitize_totals(baseline.get("observed"), "baseline observed totals")
    gates = _sanitize_gates(baseline.get("gates"))
    _validate_history(baseline.get("history"), gates)


def verify_coverage(report: dict[str, Any], baseline: dict[str, Any]) -> dict[str, int | float]:
    validate_baseline(baseline)

    meta = report.get("meta")
    if not isinstance(meta, dict) or meta.get("branch_coverage") is not True:
        raise CoveragePolicyError("coverage report must contain branch coverage")

    report_files = report.get("files")
    if not isinstance(report_files, dict):
        raise CoveragePolicyError("coverage report files are missing")
    expected_files = baseline["source_scope"]["exact_files"]
    actual_files = sorted(report_files)
    if actual_files != expected_files:
        missing = sorted(set(expected_files) - set(actual_files))
        unexpected = sorted(set(actual_files) - set(expected_files))
        raise CoveragePolicyError(
            f"coverage source scope drifted; missing={missing}, unexpected={unexpected}"
        )

    totals = sanitize_totals(report.get("totals"))
    gates = baseline["gates"]
    checks = (
        (totals["percent_covered"] >= gates["minimum_percent_covered"], "coverage percent"),
        (totals["covered_lines"] >= gates["minimum_covered_lines"], "covered lines"),
        (totals["covered_branches"] >= gates["minimum_covered_branches"], "covered branches"),
        (totals["missing_lines"] <= gates["maximum_missing_lines"], "missing lines"),
        (totals["missing_branches"] <= gates["maximum_missing_branches"], "missing branches"),
    )
    failed = [label for passed, label in checks if not passed]
    if failed:
        raise CoveragePolicyError("coverage regression: " + ", ".join(failed))
    return totals


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(
            "usage: verify_python_coverage.py <coverage.json> <baseline.json>",
            file=sys.stderr,
        )
        return 2
    try:
        report = _read_object(Path(argv[1]), "coverage report")
        baseline = _read_object(Path(argv[2]), "coverage baseline")
        totals = verify_coverage(report, baseline)
    except CoveragePolicyError as exc:
        print(f"coverage policy failed: {exc}", file=sys.stderr)
        return 1
    print("COVERAGE_TOTALS=" + json.dumps(totals, sort_keys=True, separators=(",", ":")))
    print("Python coverage policy passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
