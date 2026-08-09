# Product Integrity Audit & Execution Ledger

This is the **current operational ledger** for the post-D3D product-correctness program. It records current truth, protected boundaries, known residuals, and the next execution gates. Detailed historical rationale remains recoverable from the referenced PRs, commits, CI runs, recovery branches, and Git history.

## Current authoritative state

- Program audit baseline: `a1466e6733203c4a3ec9aa00b5b90edb52a1e045`.
- Current merged `main`: `33bd4301ec22ff86c392bf9731955a781da7d11e` — PR #147 launch-day transaction valuation bootstrap.
- Post-#147 main CI succeeded, and production `Update Portfolio Data` run #3212 completed successfully on the same main SHA.
- Active work: **Gate A / P6C — generation-safe pending calculation recovery**.
- Active PR: **#148**.
- Work branch: `pr-product-integrity-p6c-calculation-generation-storage`.
- Original P6C recovery: `backup-pre-product-integrity-p6c-2ee97e1`.
- Latest-main integration recovery: `backup-p6c-pre-latest-main-integration-a76a8b9`.
- D1 remains on the current Schema-2 line. Do not introduce Schema 3 as part of Gate A or Gate B.
- Production integrity remains fail-closed. Do not weaken validation, mutation ambiguity, market/FX, TWR/XIRR, recovery, or coverage gates to make a phase pass.

## Non-negotiable engineering rules

1. Preserve valid behavior unless a result is demonstrably wrong or misleading.
2. Fix the earliest trustworthy root boundary; UI messaging is not a substitute for data/contract correctness.
3. Do not retry or fallback through ambiguous financial/data failures.
4. Financial-semantic changes require regression/golden evidence before merge.
5. Every gate uses: pre-change recovery → scoped PR → CI → second diff review → review/thread check → exact-head merge → post-main CI/Pages → post-change recovery.
6. Never lower coverage or validation gates merely to make a change pass.
7. Do not deploy a production Worker merely because repository source changed.
8. Treat monetary values as dimensioned quantities; numeric finiteness alone is insufficient when currency/quote scale is wrong.
9. Distinguish unavailable/undefined metrics from genuine numeric zero.
10. Keep this ledger concise; preserve detailed rationale in PR/Git/recovery evidence rather than duplicating it here.
11. Do not open a new broad optimization phase while the current gate has unresolved acceptance criteria.

## Completed product-integrity line

| Phase | Status | Primary evidence |
|---|---|---|
| P1 — source-record and required market-data integrity | completed | PR #133 |
| P2 — dividend semantic unification | completed | PR #134 |
| P3 — currency-aware valuation / FX dimensional integrity | completed | PR #135 |
| P4A — XIRR validity / precision / valuation-date semantics | completed | PR #136 |
| P4B — Modified Dietz / linked-TWR reliability | completed | PR #137 |
| P5A — `fetchAll()` single-flight / truthful load contract | completed | PR #138 |
| P5B — stale/read reliability UX and structured anomalies | completed | PR #139 |
| P5C1 — committed / rejected / ambiguous mutation outcomes | completed | PR #140 |
| P5C2 — GroupManager partial mutation truth | completed | PR #141 |
| P5C3A — HTTP 5xx mutation ambiguity truth | completed | PR #142 |
| Calculation failure observability | completed | PR #143 |
| P6A — cross-tab authentication generation sync | completed | PR #144 |
| P6B — non-destructive pending calculation reads | completed | PR #145 |
| P6D — tenant/job-scoped cross-tab poll claims | completed | PR #146 |
| Launch-day market bootstrap | completed | PR #147 |

### Current confirmed residuals from the completed line

- **P5C3B remains open:** Worker `DELETE /api/records` can delete the source record before the remaining-record count / last-record snapshot cleanup completes. Browser ambiguity semantics are already correct; server-side atomicity is not yet proven.
- **P4B residual remains:** history persists net daily cash flow, so a zero-start day with offsetting intraday flows cannot be reconstructed as gross/order-aware Modified Dietz timing from published history alone.
- Schema 2 does not provide first-class external execution identity (`source`, `external_order_id`, `executed_at`, `import_key`); current external-import provenance therefore remains metadata rather than a calculation-field contract.

## Gate A — P6C generation-safe calculation recovery

Status: **active**.

### Scope

Close the remaining old-generation-vs-new-generation browser recovery race without changing Worker, D1/schema, financial calculations, market data, authentication protocol, workflow semantics, or deployment activation.

P6C storage model:

- live generation: `pending_calculation_request.v2.live.<createdAt>.<idempotencyKey>`;
- tombstone: `pending_calculation_request.v2.cleared.<createdAt>.<idempotencyKey>`;
- the fixed `pending_calculation_request` key is compatibility-only and is never cleanup authority.

The generation identity (`createdAt + idempotencyKey`) is stable. The live payload may be monotonically enriched with the assigned `jobId`; cleanup is represented independently by a tombstone so delayed live writes cannot erase completion evidence.

### Required safety properties

- old and new generations may coexist;
- newest valid same-owner live generation is authoritative;
- exact cleanup is by `{ jobId }` or `{ key }` only;
- unscoped cleanup is a no-op;
- terminal completion clears only its exact job generation;
- job 404 clears only the requested job generation;
- definite trigger rejection / no-job response clears only the attempted idempotency generation;
- an old tab cannot clear a newer sibling generation;
- a newer tombstone prevents older live/legacy resurrection;
- a tombstoned key cannot be revived by delayed `remember()`;
- malformed, expired, or cross-owner V2 state fails closed;
- logout removes all `pending_calculation_request.v2.*` sensitive state while preserving unrelated origin keys;
- the legacy fixed key remains read-compatible during the transition but is not destructively cleared by generation lifecycle code.

### Gate A merge qualification

1. PR #148 is based on latest reviewed main.
2. `portfolio.js` uses exact generation identity for every production clear path.
3. Store/source regressions lock terminal, 404, no-job, and definite-rejection exact cleanup semantics.
4. No unscoped production clear remains.
5. Full CI succeeds on the final exact head.
6. Unified diff is re-reviewed after any large-file write.
7. Review submissions / inline threads are clear.
8. `main` has not drifted from the reviewed qualification base immediately before merge.
9. Exact-head merge succeeds.
10. Post-main CI and Pages succeed.
11. A real portfolio-update smoke run succeeds or surfaces a different integrity failure without bypass.
12. Create a post-Gate-A recovery ref.

Gate A is not complete until all twelve conditions hold.

## Gate B — P5C3B Worker DELETE atomicity

Status: **queued; do not start before Gate A closes**.

Scope is deliberately narrow: make source-record deletion and last-record snapshot cleanup share one verified server-side atomic boundary while preserving missing-record 404 semantics.

Required evidence:

- missing record → definite 404 and zero mutation;
- non-last record → source record removed, snapshots preserved;
- last record → source record and snapshots removed together;
- injected failure in post-delete cleanup cannot leave a half-committed state;
- transport failure may remain client-ambiguous, but server-side relational consistency must hold;
- no POST idempotency, Schema-3, financial, or frontend redesign is mixed into Gate B.

## Gate C — Schema-2 transaction integrity preflight

Status: **queued; conditional on Gate B closeout**.

First audit, then enforce. Do not change the D1 schema in the initial slice.

Planned scope:

- deterministic ledger preflight by user → symbol → date → stable sequence;
- running `BUY - SELL` quantity must not become negative beyond tolerance;
- repeat the same prefix-integrity check for each active tag group;
- audit duplicate external `import_key` / order provenance for structured external imports without making `note` a financial-calculation dependency;
- verify current production data has zero unexplained prefix violations before switching production calculator oversell policy from compatibility `CLAMP` to fail-closed `ERROR`;
- integrity/data exceptions in secondary transaction analysis must not be converted into apparently valid all-zero snapshots.

Schema 3 is not authorized by Gate C. It requires a fresh post-Gate-D review showing that Schema 2 cannot meet the verified execution-identity requirement safely.

## Gate D — Calculation reproducibility evidence

Status: **queued; conditional on Gate C closeout**.

Do not begin with a broad market-provider abstraction. First make one successful calculation explainable and replayable.

Minimum manifest candidates:

- engine commit SHA;
- records count / maximum record id / canonical input hash;
- benchmark/config hash;
- market-data and FX as-of provenance;
- synthetic valuation count/source;
- calculation timestamp.

Add a frozen golden replay fixture covering transactions, prices, FX, splits, dividends, holdings, realized P&L, daily P&L, TWR, and XIRR. The purpose is to distinguish record changes, vendor-data revisions, FX revisions, engine changes, and synthetic-valuation changes.

## Deferred candidates — not authorized work

The following remain candidates only and require a fresh review after Gate D:

- Schema-3 execution identity / server-side import idempotency;
- canonical lot-ledger consolidation across calculator / analyzer / Daily-P&L paths;
- broad market-data provider abstraction;
- broad coverage/dead-code/Pydantic cleanup.

Do not open these as parallel PRs merely because they appeared in earlier roadmaps.

## Current execution order

1. **Gate A / PR #148 — P6C generation-safe calculation recovery.**
2. **Gate B — P5C3B server-side atomic DELETE.**
3. **Gate C — Schema-2 transaction integrity preflight and strict oversell qualification.**
4. **Gate D — calculation manifest and deterministic golden replay.**
5. **Fresh architecture review before any Schema 3, canonical-ledger, provider-abstraction, or broad cleanup phase.**

Do not reopen D3D or Schema 3 as part of Gates A–D.
