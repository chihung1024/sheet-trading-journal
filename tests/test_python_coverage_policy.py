"""Regression tests for the measured Python coverage policy."""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from tools.verify_python_coverage import (
    CoveragePolicyError,
    sanitize_totals,
    validate_baseline,
    verify_coverage,
)


ROOT = Path(__file__).resolve().parents[1]
REAL_BASELINE = ROOT / "docs" / "governance" / "python-coverage-baseline.json"


def totals(
    *,
    statements: int = 10,
    covered_lines: int = 7,
    branches: int = 4,
    covered_branches: int = 2,
) -> dict[str, int | float]:
    covered = covered_lines + covered_branches
    denominator = statements + branches
    return {
        "num_statements": statements,
        "covered_lines": covered_lines,
        "missing_lines": statements - covered_lines,
        "num_branches": branches,
        "covered_branches": covered_branches,
        "missing_branches": branches - covered_branches,
        "percent_covered": covered / denominator * 100,
    }


def baseline() -> dict:
    observed = totals()
    return {
        "schema_version": 1,
        "batch": "PR-10B3",
        "issue": 82,
        "baseline_main_sha": "a" * 40,
        "policy": {
            "cost_model": "free-only",
            "runtime_change": "none",
            "baseline_update_requires_review": True,
        },
        "source_scope": {
            "branch_coverage": True,
            "exact_files": ["main.py"],
        },
        "observed": observed,
        "gates": {
            "minimum_percent_covered": 64.0,
            "minimum_covered_lines": 7,
            "minimum_covered_branches": 2,
            "maximum_missing_lines": 3,
            "maximum_missing_branches": 2,
        },
    }


def report(report_totals: dict | None = None, files: dict | None = None) -> dict:
    return {
        "meta": {"branch_coverage": True},
        "files": files if files is not None else {"main.py": {}},
        "totals": report_totals if report_totals is not None else totals(),
    }


class CoveragePolicyTests(unittest.TestCase):
    def test_real_baseline_identity_and_measurement_are_retained(self) -> None:
        payload = json.loads(REAL_BASELINE.read_text(encoding="utf-8"))
        validate_baseline(payload)
        self.assertEqual(
            payload["baseline_main_sha"],
            "a32562471849f1f35cd25da327ea5fa32835ebb7",
        )
        self.assertEqual(payload["measurement"]["run_id"], 31075638834)
        self.assertEqual(payload["observed"]["covered_lines"], 1431)
        self.assertEqual(payload["observed"]["covered_branches"], 404)
        self.assertEqual(payload["gates"]["minimum_percent_covered"], 64.13)

    def test_exact_baseline_passes(self) -> None:
        self.assertEqual(verify_coverage(report(), baseline()), totals())

    def test_below_percent_and_count_floor_fails(self) -> None:
        degraded = totals(covered_lines=6, covered_branches=2)
        with self.assertRaisesRegex(CoveragePolicyError, "coverage regression"):
            verify_coverage(report(degraded), baseline())

    def test_missing_count_ceiling_fails_even_with_valid_json(self) -> None:
        degraded = totals(statements=11, covered_lines=7, branches=4, covered_branches=2)
        with self.assertRaisesRegex(CoveragePolicyError, "missing lines"):
            verify_coverage(report(degraded), baseline())

    def test_source_scope_drift_fails_closed(self) -> None:
        with self.assertRaisesRegex(CoveragePolicyError, "source scope drifted"):
            verify_coverage(report(files={"main.py": {}, "new_module.py": {}}), baseline())

    def test_branch_mode_is_required(self) -> None:
        payload = report()
        payload["meta"]["branch_coverage"] = False
        with self.assertRaisesRegex(CoveragePolicyError, "branch coverage"):
            verify_coverage(payload, baseline())

    def test_inconsistent_raw_counts_are_rejected(self) -> None:
        invalid = totals()
        invalid["missing_branches"] = 99
        with self.assertRaisesRegex(CoveragePolicyError, "branch counts do not reconcile"):
            sanitize_totals(invalid)

    def test_inconsistent_percentage_is_rejected(self) -> None:
        invalid = totals()
        invalid["percent_covered"] = 99.0
        with self.assertRaisesRegex(CoveragePolicyError, "percent does not reconcile"):
            sanitize_totals(invalid)

    def test_unsorted_or_duplicate_baseline_scope_is_rejected(self) -> None:
        payload = baseline()
        payload["source_scope"]["exact_files"] = ["z.py", "a.py", "z.py"]
        with self.assertRaisesRegex(CoveragePolicyError, "sorted and unique"):
            validate_baseline(payload)

    def test_invalid_baseline_sha_is_rejected(self) -> None:
        payload = baseline()
        payload["baseline_main_sha"] = "main"
        with self.assertRaisesRegex(CoveragePolicyError, "exact commit SHA"):
            validate_baseline(payload)

    def test_json_round_trip_preserves_numbers(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "coverage.json"
            path.write_text(json.dumps(report()), encoding="utf-8")
            loaded = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(verify_coverage(loaded, copy.deepcopy(baseline())), totals())


if __name__ == "__main__":
    unittest.main()
