# Product Integrity Audit & Execution Ledger

This is the **current operational ledger** for the post-D3D product-correctness program. It records current truth, protected boundaries, known residuals, and the next execution gates. Detailed historical rationale remains recoverable from the referenced PRs, commits, CI runs, recovery branches, and Git history.

## Current authoritative state

- Program audit baseline: `a1466e6733203c4a3ec9aa00b5b90edb52a1e045`.
- Current merged `main`: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf` — PR #148 / Gate A P6C generation-safe pending calculation recovery.
- Gate A final PR head: `80d417c125797020fab1b6be401084049f2e25e3`.
- Gate A exact-head CI #429 succeeded; post-main CI #430 succeeded.
- Current-main production calculation smoke: `Update Portfolio Data` #3213 / run `31295494999` succeeded on exact SHA `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`; 2 users succeeded, 0 failed, and portfolio snapshots uploaded successfully.
- Gate A post-change recovery: `backup-post-product-integrity-p6c-f3c55f4`.
- Active work: **Gate B / P5C3B — Worker record DELETE atomicity**.
- Gate B work branch: `pr-gate-b-atomic-record-delete`.
- Gate B pre-change recovery: `backup-pre-gate-b-atomic-delete-f3c55f4`.
- D1 remains on the current Schema-2 line. Gate B does not authorize Schema 3.
- Production Worker activation remains separately governed and fail-closed; ordinary product-integrity source changes do not imply a production Worker deployment.

### Legacy GitHub Pages closeout note

GitHub-managed legacy Pages run #1437 for `f3c55f4...` entered an inconsistent external state: the dynamic workflow reported failure while the Pages build API remained `building` with no error and no executed build steps. The repository's current production frontend is Cloudflare Pages (`sheet-trading-journal.pages.dev`); GitHub Pages is a legacy approved origin, not the authoritative production deployment chain. No application change is authorized merely to make that external legacy status turn green.

## Non-negotiable engineering rules

1. Preserve valid behavior unless a result is demonstrably wrong or misleading.
2. Fix the earliest trustworthy root boundary; UI messaging is not a substitute for data/contract correctness.
3. Do not retry or fallback through ambiguous financial/data failures.
4. Financial-semantic changes require regression/golden evidence before merge.
5. Every gate uses: pre-change recovery → scoped PR → CI → second diff review → review/thread check → exact-head merge → post-main CI → post-change recovery.
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
| Gate A / P6C — generation-safe calculation recovery | completed | PR #148 / merge `f3c55f4...` / smoke #3213 |

### Current confirmed residuals

- **P5C3B / Gate B active:** pre-Gate-B Worker `DELETE /api/records` deletes the source record before the remaining-record count / last-record snapshot cleanup completes. Browser ambiguity semantics are already correct; Gate B closes only the internal partial-server-state window.
- **P4B residual remains:** history persists net daily cash flow, so a zero-start day with offsetting intraday flows cannot be reconstructed as gross/order-aware Modified Dietz timing from published history alone.
- Schema 2 does not provide first-class external execution identity (`source`, `external_order_id`, `executed_at`, `import_key`); current external-import provenance therefore remains metadata rather than a calculation-field contract.

## Gate A — P6C generation-safe calculation recovery

Status: **completed**.

Evidence:

- PR #148 final exact head: `80d417c125797020fab1b6be401084049f2e25e3`.
- merge/main: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`.
- final PR CI #429: SUCCESS.
- post-main CI #430: SUCCESS.
- production calculation smoke #3213 / run `31295494999`: SUCCESS on exact merged SHA.
- recovery: `backup-post-product-integrity-p6c-f3c55f4`.

Gate A closed the old-generation/new-generation browser recovery race using generation-specific live records and independent tombstones. Exact cleanup is scoped by `{ jobId }` or `{ key }`; unscoped cleanup is a no-op; legacy fixed storage remains compatibility-only; logout removes dynamic V2 sensitive state.

## Gate B — P5C3B Worker DELETE atomicity

Status: **active**.

Scope is deliberately narrow: source-record deletion and last-record snapshot cleanup must share one verified D1 atomic boundary while preserving existing API semantics.

### Design contract

Use one D1 `batch()` transaction containing, in order:

1. guarded snapshot cleanup that runs only when the target record exists and no sibling record exists for the same user;
2. target record deletion scoped by `id + user_id`;
3. post-delete remaining-record count used only to select the response contract.

The guarded pre-delete snapshot statement prevents a missing record from deleting snapshots, while D1 batch atomicity prevents statement failure from leaving record/snapshot state partially committed.

### Required evidence

- missing record → definite 404 and zero logical mutation;
- non-last record → source record removed, snapshots preserved;
- last record → source record and snapshots removed together;
- injected batch/statement failure cannot leave a half-committed state;
- malformed/invalid batch result fails closed;
- changed-row cardinality other than 0 or 1 fails closed;
- transport failure after a successful commit may remain client-ambiguous; existing frontend `outcomeAmbiguous` semantics must not be removed;
- no POST idempotency, Schema 3, financial calculation, auth, workflow, frontend, or deployment redesign is mixed into Gate B.

### Gate B qualification

1. pre-change recovery exists from exact Gate A main;
2. Worker implementation and dedicated atomic-delete regression tests are the only product-code scope;
3. execution ledger current truth is synchronized in the same PR;
4. full PR CI succeeds on the final exact head;
5. unified diff is re-reviewed after any large-file write;
6. review submissions and inline threads are clear;
7. `main` has not drifted from the reviewed qualification base immediately before merge;
8. exact-head merge succeeds;
9. post-main CI succeeds;
10. create a post-Gate-B recovery ref.

A production Worker deployment is **not** part of Gate B closeout unless separately authorized through the existing production activation governance.

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

1. **Gate B — P5C3B server-side atomic DELETE.**
2. **Gate C — Schema-2 transaction integrity preflight and strict oversell qualification.**
3. **Gate D — calculation manifest and deterministic golden replay.**
4. **Fresh architecture review before any Schema 3, canonical-ledger, provider-abstraction, or broad cleanup phase.**

Do not reopen D3D or Schema 3 as part of Gates B–D.
