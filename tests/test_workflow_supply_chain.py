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
WRITE_PERMISSION_RE = re.compile(
    r"(?m)^\s{2}(?P<scope>[A-Za-z0-9_-]+):\s+write\s*$"
)
AUTONOMOUS_WRITE_WORKFLOWS = {
    ROOT / ".github" / "workflows" / "production-deployment-dispatch.yml",
    ROOT
    / ".github"
    / "workflows"
    / "production-legacy-reconciliation-scheduler-recovery.yml",
}
PERMITTED_WRITE_SCOPES = {"actions"}


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
        cls.write_allowlist = {
            ROOT / relative_path: set(scopes)
            for relative_path, scopes in cls.evidence["policy"]
            .get("workflow_write_permission_allowlist", {})
            .items()
        }

    def test_evidence_inventory_matches_tracked_workflows(self) -> None:
        self.assertEqual(set(self.workflow_paths), self.declared_paths)
        self.assertEqual(self.evidence["policy"]["cost_model"], "free-only")
        self.assertEqual(self.evidence["policy"]["runtime_change"], "none")
        self.assertEqual(set(self.write_allowlist), AUTONOMOUS_WRITE_WORKFLOWS)
        self.assertTrue(set(self.write_allowlist).issubset(self.declared_paths))
        for path, scopes in self.write_allowlist.items():
            self.assertTrue(scopes, f"{path} write allowlist must not be empty")
            self.assertTrue(
                scopes.issubset(PERMITTED_WRITE_SCOPES),
                f"{path} requests an unsupported write scope in governance evidence",
            )

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

    def test_workflow_permissions_follow_explicit_write_allowlist(self) -> None:
        for path in self.workflow_paths:
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("write-all", text, f"{path} must not request write-all")
            observed_write_scopes = {
                match.group("scope") for match in WRITE_PERMISSION_RE.finditer(text)
            }
            expected_write_scopes = self.write_allowlist.get(path, set())
            self.assertEqual(
                observed_write_scopes,
                expected_write_scopes,
                f"{path} write permissions must exactly match governance evidence",
            )
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
