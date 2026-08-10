"""Repository-level governance/documentation integrity guards."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLAYBOOK = ROOT / "AI_PROJECT_PLAYBOOK.md"


def test_playbook_is_complete_locked_v3_governance_baseline() -> None:
    text = PLAYBOOK.read_text(encoding="utf-8")

    # Regression guard for PR #175, where a small final-patch document accidentally
    # replaced the complete constitution. This intentionally checks durable semantic
    # anchors rather than an exact byte-for-byte snapshot.
    assert len(text) >= 25_000
    required_markers = (
        "# AI 協作開發最高規範 V3.0",
        "# 4. Risk-Proportional Governance",
        "## Docs Risk Escalation Rule",
        "### Final Risk Reclassification",
        "# 20. Independent Review Gate",
        "## Same-AI Independent Review Isolation Protocol",
        "### Reviewer / Implementer Role Separation",
        "## Governance Transition / Non-Retroactive Rule",
        "### Grandfather Anti-Bypass",
        "# V3.0 Governance Lock",
        "GOVERNANCE BASELINE LOCKED",
    )

    for marker in required_markers:
        assert marker in text, f"governance playbook is missing required marker: {marker}"

    assert text.index("# 0. 文件定位") < text.index("# V3.0 Governance Lock")


def test_playbook_final_patch_is_integrated_not_standalone_replacement() -> None:
    text = PLAYBOOK.read_text(encoding="utf-8").lstrip()
    assert text.startswith("# AI\\_PROJECT\\_PLAYBOOK.md")
    assert not text.startswith("## V3.0 Final Hardening — Final Patch")
