# Gate C / C5b — Production Read-Only Transaction Integrity Audit

Date: **2026-08-09**

## Purpose

Qualify current production Schema-2 transaction data with the merged read-only transaction-integrity audit before enabling any blocking pre-calculator enforcement.

This evidence is intentionally **counts-only**. It does not expose user ids, symbols, tags, record ids, quantities, prices, free-form notes, raw broker identifiers, or hashed broker identifiers.

## Workflow Evidence

- Repository: `chihung1024/sheet-trading-journal`
- Workflow: `Update Portfolio Data`
- Run: **#3215**
- Run id: `31298163263`
- Trigger: `workflow_dispatch`
- Source/main SHA: `5942f67dddec2a6b6406221067dea210cf6104c0`
- Job: `run-and-upload`
- Workflow conclusion: **success**
- Audit mode: `read_only`
- Qualification: **clear**

## Execution Isolation

The audit-only path executed as designed:

| Step | Result |
|---|---|
| Run transaction integrity read-only audit | SUCCESS |
| Run calculation and upload to API | SKIPPED |
| Mark calculation job running | SKIPPED |
| Report calculation job result | SKIPPED |
| Fail workflow when calculation failed | SKIPPED |

Therefore this run did not use the normal portfolio-calculation/upload path and did not bind calculation-job callbacks.

## Counts-Only Result

The workflow emitted one machine-readable `GATE_C_TRANSACTION_INTEGRITY_AUDIT=<json>` result with:

| Metric | Result |
|---|---:|
| users | 2 |
| rows | 168 |
| scopes | 5 |
| symbol_scopes | 89 |
| prefix_violations | **0** |
| users_with_prefix_violations | **0** |
| all_scope_prefix_violations | **0** |
| tag_scope_prefix_violations | **0** |
| duplicate_import_key_groups | **0** |
| duplicate_import_key_rows | **0** |
| duplicate_trade_id_groups | **0** |
| duplicate_trade_id_rows | **0** |
| repeated_order_id_groups | **0** |
| repeated_order_id_rows | **0** |
| nonempty_notes | 115 |
| import_key tokens | 108 |
| order_id tokens | 96 |
| executed_at_utc tokens | 52 |
| executed_at_taipei tokens | 96 |

## Acceptance Assessment

- [x] Executed from the intended merged main SHA.
- [x] Audit-only path executed.
- [x] All production users were included (`target_user_id` blank).
- [x] All active audit scopes completed.
- [x] Market/split data dependency completed without fail-open fallback.
- [x] Counts-only machine-readable evidence was produced.
- [x] Prefix violations = 0.
- [x] Users with prefix violations = 0.
- [x] All-scope prefix violations = 0.
- [x] Tag-scope prefix violations = 0.
- [x] Duplicate `import_key` groups/rows = 0.
- [x] Duplicate `trade_id` groups/rows = 0.
- [x] Repeated `order_id` groups/rows = 0.
- [x] Normal calculation/upload step was skipped.
- [x] Calculation-job callbacks were skipped.
- [x] Qualification = `clear`.

## Decision

**C5b is qualified and may close.**

Production Schema-2 data is clear for a separate C6 enforcement decision. The next approved implementation is a narrowly scoped **blocking pre-calculator prefix-integrity gate** using the already-merged `journal_engine/core/ledger_integrity.py` contract.

This result does **not** automatically authorize changing the calculator oversell policy from `CLAMP` to `ERROR`. That remains a separate post-C6a decision because changing downstream defensive semantics in the same change would unnecessarily widen regression scope.

## Next

1. Persist this evidence and the updated `to_do_update_list.md` through a docs-only PR.
2. After that PR is merged and post-main CI passes, create a pre-C6a recovery point.
3. Start a fresh scoped C6a branch/PR.
4. Restore the previously tested pre-calculator blocking gate against current main.
5. Add/restore focused runner regressions proving a prefix-integrity failure prevents calculator execution and snapshot upload.
6. Keep calculator `CLAMP` unchanged in C6a.
7. Run full CI/coverage, independent review, exact-head merge qualification, post-main CI, production calculation smoke, recovery, and handoff update.
