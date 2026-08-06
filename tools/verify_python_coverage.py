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


def validate_baseline(baseline: dict[str, Any]) -> None:
    if baseline.get("schema_version") != 1:
        raise CoveragePolicyError("baseline schema_version must be 1")
    if baseline.get("batch") != "PR-10B3" or baseline.get("issue") != 82:
        raise CoveragePolicyError("baseline batch identity is invalid")
    baseline_sha = baseline.get("baseline_main_sha")
    if not isinstance(baseline_sha, str) or not SHA_RE.fullmatch(baseline_sha):
        raise CoveragePolicyError("baseline_main_sha must be an exact commit SHA")

    policy = baseline.get("policy")
    if not isinstance(policy, dict):
        raise CoveragePolicyError("baseline policy is missing")
    if policy.get("cost_model") != "free-only" or policy.get("runtime_change") != "none":
        raise CoveragePolicyError("baseline cost/runtime policy is invalid")
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
    gates = baseline.get("gates")
    if not isinstance(gates, dict):
        raise CoveragePolicyError("baseline gates are missing")
    _finite_number(gates.get("minimum_percent_covered"), "minimum_percent_covered")
    for key in (
        "minimum_covered_lines",
        "minimum_covered_branches",
        "maximum_missing_lines",
        "maximum_missing_branches",
    ):
        _count(gates.get(key), key)


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
