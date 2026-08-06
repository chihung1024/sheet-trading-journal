import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_EVIDENCE_ROOTS = (
    ROOT / "docs",
    ROOT / ".github" / "workflows",
)
PUBLIC_ROOT_FILES = (
    ROOT / "docs" / "MASTER_REMEDIATION_PLAN.md",
    ROOT / "docs" / "ZERO_DOWNTIME_CHANGE_POLICY.md",
    ROOT / "docs" / "PR10A_ACCEPTANCE.md",
    ROOT / "docs" / "PR10B_ACCEPTANCE.md",
)
TEXT_SUFFIXES = {".md", ".json", ".yml", ".yaml", ".txt"}
SENSITIVE_PATTERNS = {
    "full email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    "GitHub classic token": re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"),
    "GitHub fine-grained token": re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}


def iter_public_evidence_files():
    seen = set()
    for root in PUBLIC_EVIDENCE_ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
                resolved = path.resolve()
                if resolved not in seen:
                    seen.add(resolved)
                    yield path
    for path in PUBLIC_ROOT_FILES:
        if path.is_file():
            resolved = path.resolve()
            if resolved not in seen:
                seen.add(resolved)
                yield path


def test_public_evidence_contains_no_personal_identifier_or_secret_material():
    violations = []
    for path in iter_public_evidence_files():
        content = path.read_text(encoding="utf-8")
        for label, pattern in SENSITIVE_PATTERNS.items():
            if pattern.search(content):
                violations.append(f"{path.relative_to(ROOT)}:{label}")
    assert not violations, f"Sensitive material found in public evidence: {violations}"


def test_public_evidence_scanner_has_nonempty_scope():
    files = list(iter_public_evidence_files())
    relative = {str(path.relative_to(ROOT)) for path in files}
    assert "docs/governance/risk-register.json" in relative
    assert "docs/audits/2026-08-06-three-round-independent-audit.md" in relative
    assert ".github/workflows/ci.yml" in relative
    assert len(files) >= 10
