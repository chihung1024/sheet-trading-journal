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


def test_current_documentation_authorities_exist() -> None:
    required = (
        "README.md",
        "to_do_update_list.md",
        "docs/README.md",
        "docs/DEPLOYMENT.md",
        "docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md",
    )
    for relative_path in required:
        assert (ROOT / relative_path).is_file(), f"missing current documentation authority: {relative_path}"


def test_superseded_standalone_root_docs_stay_removed() -> None:
    obsolete = (
        "AUDIT_TRADING_CALC_REVIEW.md",
        "TRADING_CALC_OPTIMIZATION_PLAN.md",
    )
    for relative_path in obsolete:
        assert not (ROOT / relative_path).exists(), f"superseded root document returned: {relative_path}"
