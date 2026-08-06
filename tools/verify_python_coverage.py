"""Sanitize Python coverage JSON totals for measured baseline capture."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path


TOTAL_KEYS = (
    "num_statements",
    "covered_lines",
    "missing_lines",
    "num_branches",
    "covered_branches",
    "missing_branches",
    "percent_covered",
)


def load_sanitized_totals(report_path: Path) -> dict[str, int | float]:
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    totals = payload.get("totals")
    if not isinstance(totals, dict):
        raise ValueError("coverage report is missing totals")

    sanitized: dict[str, int | float] = {}
    for key in TOTAL_KEYS:
        value = totals.get(key)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"coverage total {key} is missing or non-numeric")
        if not math.isfinite(float(value)) or value < 0:
            raise ValueError(f"coverage total {key} is invalid")
        sanitized[key] = value

    if sanitized["covered_lines"] + sanitized["missing_lines"] != sanitized["num_statements"]:
        raise ValueError("line coverage totals do not reconcile")
    if sanitized["covered_branches"] + sanitized["missing_branches"] != sanitized["num_branches"]:
        raise ValueError("branch coverage totals do not reconcile")
    return sanitized


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: verify_python_coverage.py <coverage.json>", file=sys.stderr)
        return 2
    try:
        totals = load_sanitized_totals(Path(argv[1]))
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"coverage summary failed: {exc}", file=sys.stderr)
        return 1
    print("COVERAGE_TOTALS=" + json.dumps(totals, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
