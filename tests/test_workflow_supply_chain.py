"""Fail-closed supply-chain policy for tracked GitHub Actions workflows."""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_DIR = ROOT / ".github" / "workflows"
EVIDENCE_PATH = ROOT / "docs" / "governance" / "github-actions-pins.json"
USES_RE = re.compile(
    r"^\s*(?:-\s*)?uses:\s*"
    r"(?P<action>[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)"
    r"@(?P<sha>[0-9a-f]{40})\s+#\s+(?P<tag>v[0-9]+)\s*$"
)
ANY_USES_RE = re.compile(r"^\s*(?:-\s*)?uses:\s*(?P<ref>\S+)")


class WorkflowSupplyChainPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.evidence = json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))
        cls.pins = {
            item["action"]: (item["sha"], item["semantic_tag"])
            for item in cls.evidence["pins"]
        }
        cls.workflow_paths = sorted(WORKFLOW_DIR.glob("*.yml"))
        cls.declared_paths = {
            ROOT / relative_path for relative_path in cls.evidence["workflows"]
        }

    def test_evidence_inventory_matches_tracked_workflows(self) -> None:
        self.assertEqual(set(self.workflow_paths), self.declared_paths)
        self.assertEqual(self.evidence["policy"]["cost_model"], "free-only")
        self.assertEqual(self.evidence["policy"]["runtime_change"], "none")

    def test_every_action_is_allowlisted_and_pinned_to_exact_sha(self) -> None:
        observed: set[str] = set()

        for path in self.workflow_paths:
            for line_number, line in enumerate(
                path.read_text(encoding="utf-8").splitlines(), start=1
            ):
                generic = ANY_USES_RE.match(line)
                if not generic:
                    continue

                exact = USES_RE.match(line)
                self.assertIsNotNone(
                    exact,
                    f"{path}:{line_number} uses a mutable or undocumented action ref: "
                    f"{generic.group('ref')}",
                )
                action = exact.group("action")
                observed.add(action)
                self.assertIn(action, self.pins, f"{path}:{line_number} action is not allowlisted")
                expected_sha, expected_tag = self.pins[action]
                self.assertEqual(exact.group("sha"), expected_sha)
                self.assertEqual(exact.group("tag"), expected_tag)

        self.assertEqual(observed, set(self.pins))

    def test_every_checkout_disables_persisted_credentials(self) -> None:
        for path in self.workflow_paths:
            lines = path.read_text(encoding="utf-8").splitlines()
            for index, line in enumerate(lines):
                if "uses: actions/checkout@" not in line:
                    continue
                window = "\n".join(lines[index : index + 8])
                self.assertRegex(
                    window,
                    r"(?m)^\s+persist-credentials:\s+false\s*$",
                    f"{path}:{index + 1} checkout must set persist-credentials: false",
                )

    def test_workflow_permissions_remain_read_only(self) -> None:
        forbidden = re.compile(r"(?m)^\s+[A-Za-z0-9_-]+:\s+write\s*$")

        for path in self.workflow_paths:
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("write-all", text, f"{path} must not request write-all")
            self.assertIsNone(forbidden.search(text), f"{path} must not request write scope")
            self.assertRegex(
                text,
                r"(?m)^permissions:\s*\n\s{2}contents:\s+read\s*$",
                f"{path} must declare top-level contents: read",
            )

    def test_pin_evidence_is_well_formed(self) -> None:
        self.assertRegex(self.evidence["baseline_main_sha"], r"^[0-9a-f]{40}$")
        self.assertRegex(self.evidence["baseline_tree_sha"], r"^[0-9a-f]{40}$")
        for action, (sha, tag) in self.pins.items():
            self.assertRegex(action, r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
            self.assertRegex(sha, r"^[0-9a-f]{40}$")
            self.assertRegex(tag, r"^v[0-9]+$")


if __name__ == "__main__":
    unittest.main()
