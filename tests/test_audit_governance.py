import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASELINE_SHA = "35e629ade1c3155ad5e44b839135d4406f9a4170"
REQUIRED_DOCS = (
    ROOT / "docs" / "audits" / "README.md",
    ROOT / "docs" / "audits" / "2026-08-06-three-round-independent-audit.md",
    ROOT / "docs" / "governance" / "risk-register.json",
    ROOT / "docs" / "MASTER_REMEDIATION_PLAN.md",
    ROOT / "docs" / "ZERO_DOWNTIME_CHANGE_POLICY.md",
    ROOT / "docs" / "PR10A_ACCEPTANCE.md",
)
EXPECTED_BATCHES = {f"B{number:02d}" for number in range(16)}
RISK_ID_RE = re.compile(r"^RISK-(\d{3})$")
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)


def load_register():
    register_path = ROOT / "docs" / "governance" / "risk-register.json"
    return json.loads(register_path.read_text(encoding="utf-8"))


def test_required_governance_files_exist():
    missing = [str(path.relative_to(ROOT)) for path in REQUIRED_DOCS if not path.is_file()]
    assert not missing, f"Missing governance files: {missing}"


def test_register_baseline_and_risk_identity_are_deterministic():
    register = load_register()
    assert register["schema_version"] == 1
    assert register["register_id"] == "STJ-AUDIT-2026-08"
    assert register["repository"] == "chihung1024/sheet-trading-journal"
    assert register["baseline"] == {
        "main_sha": BASELINE_SHA,
        "release_version": "4.07",
        "api_version": "2.60",
        "schema_version": 2,
        "review_date": "2026-08-06",
    }

    risks = register["risks"]
    assert len(risks) == 50

    ids = [risk["id"] for risk in risks]
    assert len(ids) == len(set(ids)), "Risk IDs must be unique"
    assert ids == [f"RISK-{number:03d}" for number in range(1, 51)]
    assert all(RISK_ID_RE.fullmatch(risk_id) for risk_id in ids)


def test_every_risk_has_governed_values_and_acceptance():
    register = load_register()
    allowed = register["allowed_values"]
    required_fields = {
        "id",
        "severity",
        "subsystem",
        "summary",
        "evidence",
        "impact",
        "target_batch",
        "migration_class",
        "rollback_class",
        "acceptance",
        "status",
    }

    for risk in register["risks"]:
        assert set(risk) == required_fields, f"Unexpected schema for {risk.get('id')}"
        assert risk["severity"] in allowed["severity"]
        assert risk["migration_class"] in allowed["migration_class"]
        assert risk["rollback_class"] in allowed["rollback_class"]
        assert risk["status"] in allowed["status"]
        assert risk["target_batch"] in EXPECTED_BATCHES
        assert isinstance(risk["evidence"], list) and risk["evidence"]
        for field in ("subsystem", "summary", "impact", "acceptance"):
            assert isinstance(risk[field], str) and risk[field].strip()


def test_master_plan_defines_every_batch_once():
    plan = (ROOT / "docs" / "MASTER_REMEDIATION_PLAN.md").read_text(encoding="utf-8")
    found = re.findall(r"^### (B\d{2})\b", plan, flags=re.MULTILINE)
    assert set(found) == EXPECTED_BATCHES
    assert len(found) == len(EXPECTED_BATCHES), "Each batch heading must be unique"

    register = load_register()
    assert {risk["target_batch"] for risk in register["risks"]} <= set(found)


def test_zero_downtime_policy_contains_required_lifecycle_and_compatibility_gates():
    policy = (ROOT / "docs" / "ZERO_DOWNTIME_CHANGE_POLICY.md").read_text(encoding="utf-8")
    for stage in (
        "Expand",
        "Backfill",
        "Dual-write",
        "Shadow-read or shadow-calculate",
        "Canary",
        "Cutover",
        "Contract",
    ):
        assert stage in policy

    for compatibility_phrase in (
        "Old frontend → new Worker",
        "Old Worker → expanded schema",
        "Pre-deployment queued jobs",
        "Old snapshots → new frontend",
        "Legacy service worker → new deployment",
    ):
        assert compatibility_phrase in policy


def test_archive_and_acceptance_reference_exact_baseline():
    for relative_path in (
        "docs/audits/README.md",
        "docs/audits/2026-08-06-three-round-independent-audit.md",
        "docs/MASTER_REMEDIATION_PLAN.md",
        "docs/PR10A_ACCEPTANCE.md",
    ):
        content = (ROOT / relative_path).read_text(encoding="utf-8")
        assert BASELINE_SHA in content, f"Missing exact baseline in {relative_path}"


def test_governance_documents_do_not_contain_full_email_addresses():
    violations = {}
    for path in REQUIRED_DOCS:
        content = path.read_text(encoding="utf-8")
        matches = EMAIL_RE.findall(content)
        if matches:
            violations[str(path.relative_to(ROOT))] = matches
    assert not violations, f"Full email addresses are forbidden in governance evidence: {violations}"
