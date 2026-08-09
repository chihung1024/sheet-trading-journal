# Product Integrity Audit & Execution Ledger

This is the **current operational ledger** for the post-D3D product-correctness program. It records current truth, protected boundaries, known residuals, and the next execution gates. Detailed historical rationale remains recoverable from the referenced PRs, commits, CI runs, recovery branches, Git history, and root-level `to_do_update_list.md`.

## Current authoritative state

- Program audit baseline: `a1466e6733203c4a3ec9aa00b5b90edb52a1e045`.
- Current merged `main`: `03242d00082067333cf77ffa424094b8936b406c` — PR #149 / Gate B P5C3B atomic record deletion.
- Gate B final PR head: `439e9ed39647ccd5885a2cc02a6850712c30708a`.
- Gate B exact-head CI #433 / run `31296056184`: SUCCESS.
- Gate B post-main CI #434 / run `31296121054`: SUCCESS.
- Gate B post-change recovery: `backup-post-gate-b-03242d0`.
- Gate C pre-change recovery: `backup-pre-gate-c-03242d0`.
- Active work: **Gate C — Schema-2 transaction integrity preflight**.
- Gate C branch: `pr-gate-c-transaction-integrity-preflight`.
- Root continuation source: `to_do_update_list.md` — must be updated after every material execution result.
- D1 remains on the current Schema-2 line. Gate C initial audit does not authorize Schema 3.
- Production Worker activation remains separately governed and fail-closed; repository merges do not imply production deployment.

### Legacy GitHub Pages closeout note

GitHub-managed legacy Pages can enter inconsistent external states while the authoritative production frontend remains Cloudflare Pages (`sheet-trading-journal.pages.dev`). No application change is authorized merely to make the legacy Pages status green.

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
10. Keep this ledger concise; preserve detailed chronological continuation in `to_do_update_list.md`.
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
| Gate B / P5C3B — atomic record deletion | completed | PR #149 / merge `03242d0...` |

### Current confirmed residuals

- **P4B residual:** history persists net daily cash flow, so a zero-start day with offsetting intraday flows cannot be reconstructed as gross/order-aware Modified Dietz timing from published history alone.
- **Execution identity residual:** Schema 2 does not provide first-class `source`, immutable external execution id, `executed_at`, or stable execution sequence fields.
- **Same-day ordering residual:** current preparation/calculator paths may not preserve true broker execution order when multiple BUY/SELL events share one transaction date.
- **Commission rebate residual:** current calculation paths normalize commission/tax with `abs()`, so genuinely net-negative commission cannot be represented faithfully.
- **Derivatives residual:** current Stock journal has no first-class asset class / contract multiplier; futures remain excluded.

## Gate A — P6C generation-safe calculation recovery

Status: **completed**.

Evidence:

- PR #148 final exact head: `80d417c125797020fab1b6be401084049f2e25e3`.
- merge/main: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`.
- final PR CI #429: SUCCESS.
- post-main CI #430: SUCCESS.
- production calculation smoke #3213 / run `31295494999`: SUCCESS on exact merged SHA.
- recovery: `backup-post-product-integrity-p6c-f3c55f4`.

## Gate B — P5C3B Worker DELETE atomicity

Status: **completed**.

Result:

- one D1 `batch()` transaction now contains guarded final-snapshot cleanup, exact record deletion, and post-delete remaining-record count;
- missing record stays definite 404 without snapshot cleanup;
- non-last record preserves snapshots;
- last record removes snapshots and record within the same D1 batch;
- malformed result / impossible row cardinality fails closed;
- frontend transport ambiguity semantics remain unchanged.

Evidence:

- PR #149 final exact head `439e9ed39647ccd5885a2cc02a6850712c30708a`;
- exact-head CI #433 / `31296056184`: SUCCESS;
- merge `03242d00082067333cf77ffa424094b8936b406c`;
- post-main CI #434 / `31296121054`: SUCCESS;
- recovery `backup-post-gate-b-03242d0`.

Production Worker deployment was not part of Gate B.

## Gate C — Schema-2 transaction integrity preflight

Status: **active — audit first, then enforce**.

### Initial scope

- audit every transaction-consumer path affecting holdings, realized P&L, daily P&L, and metrics;
- define deterministic ledger order by user → symbol → date → stable sequence;
- validate running `BUY - SELL` quantity never becomes negative beyond a documented tolerance;
- repeat prefix validation for every active tag group;
- audit same-day execution ordering differences across preparation/calculator/analyzer/Daily-P&L code;
- audit duplicate structured external `import_key` / order provenance conservatively without making `note` a financial dependency;
- audit current production data before any compatibility `CLAMP` → fail-closed `ERROR` oversell switch;
- ensure secondary transaction-analysis integrity exceptions cannot become apparently valid all-zero snapshots.

### Gate C acceptance path

1. complete code-path/evidence matrix;
2. define prefix-integrity contract and tolerance;
3. add targeted regressions for same-day round trips and oversells;
4. audit current production records and active tag groups;
5. record explained vs unexplained violations;
6. only if evidence supports it, propose strict oversell enforcement;
7. open scoped implementation PR;
8. exact-head CI + independent diff review + review/thread + main-drift checks;
9. exact-head merge + post-main CI + post-Gate-C recovery;
10. update `to_do_update_list.md` and activate Gate D.

Schema 3 is not authorized by Gate C. A fresh post-Gate-D architecture review is required before any execution-identity migration.

## Gate D — Calculation reproducibility evidence

Status: **queued; conditional on Gate C closeout**.

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

1. **Gate C — Schema-2 transaction integrity preflight and strict oversell qualification.**
2. **Gate D — calculation manifest and deterministic golden replay.**
3. **Fresh architecture review before any Schema 3, canonical-ledger, provider-abstraction, or broad cleanup phase.**

Do not reopen D3D or Schema 3 as part of Gates C–D.
