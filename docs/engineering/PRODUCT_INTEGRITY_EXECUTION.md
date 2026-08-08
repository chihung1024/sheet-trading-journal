# Product Integrity Audit & Execution Ledger

This is the **current operational ledger** for the post-D3D product-correctness program. It is intentionally concise: current state, protected boundaries, phase evidence, known residuals, and next execution gates live here. Detailed historical rationale remains recoverable from the referenced PRs, commits, CI runs, recovery branches, and Git history.

## Current authoritative state

- Program audit baseline: `a1466e6733203c4a3ec9aa00b5b90edb52a1e045`
- Current merged product-integrity baseline: `bb176870f7136457b42096341427eff47d2124a5` (**P5A completed**)
- Active work: **P5B — stale/read reliability UX and structured anomaly surfacing**
- Active PR: **#139**
- P5B work branch: `pr-product-integrity-p5b-snapshot-anomaly-ux`
- P5B pre-change recovery: `backup-pre-product-integrity-p5b-bb17687`
- Runtime identity remains Worker **4.07** / API **2.60** / D1 schema **2**.
- Production activation remains fail-closed. Product Integrity work does **not** reopen D3D.
- Schema 3 remains prohibited until the separate recovery-evidence gate passes.

## Non-negotiable engineering rules

1. Preserve valid behavior unless a result is demonstrably wrong or misleading.
2. Fix the earliest trustworthy root boundary; UI messaging is not a substitute for data/contract correctness.
3. Do not retry or fallback through ambiguous financial/data failures.
4. Financial-semantic changes require regression/golden evidence before merge.
5. Every phase uses: pre-change recovery → scoped PR → CI → second diff review → review/thread check → exact-head merge → post-main CI/Pages → post-change recovery.
6. Never lower coverage/validation gates merely to make a change pass.
7. Do not deploy a production Worker merely because repository source changed.
8. Treat monetary values as dimensioned quantities; numeric finiteness alone is insufficient when currency/quote scale is wrong.
9. Distinguish unavailable/undefined metrics from genuine numeric zero.
10. Keep current navigation concise; preserve detailed history in Git/PR/recovery evidence instead of duplicating it into current docs.

## Completed phases

### P1 — Source-record and required market-data integrity

Status: **completed**

Key outcomes:
- Python transaction validation aligned with the Worker source-of-record contract.
- Required market-data validation wired into orchestration.
- historical price/FX coverage fails closed when usable as-of data begins after the first required calculation date.

Evidence:
- PR #133
- merge/main: `cde4c770d0c64b582083764a55d3ffbfc5e603ad`
- post-main CI #323: SUCCESS
- Pages #1422: SUCCESS
- recovery: `backup-post-product-integrity-p1-cde4c77`

### P2 — Dividend semantic unification

Status: **completed**

Key outcomes:
- removed duplicated/wrong hardcoded pending-dividend withholding behavior;
- reviewed automatic policy: TWD 0%, USD 30% under the current model;
- KRW/HKD/CNY/JPY/GBp/EUR automatic pending accrual remains fail-closed until policy review;
- confirmed DIV transactions remain exact actual cash flows.

Evidence:
- PR #134
- merge/main: `8735d5849850e957b1ddd67c7a3c5d84db1491b8`
- post-main CI #327: SUCCESS
- Pages #1423: SUCCESS
- recovery: `backup-post-product-integrity-p2-8735d58`

### P3 — Currency-aware valuation / FX dimensional integrity

Status: **completed**

Key outcomes:
- canonical per-currency `TWD per native quote unit` FX contexts;
- no known-foreign `1.0` valuation fallback;
- explicit KRW/HKD/CNY/JPY/GBp/EUR detection;
- GBp quote-unit scaling fixed explicitly;
- date-specific FX applied consistently to transactions, valuation, Daily P&L, and reconciliation;
- dividend records publish native-currency provenance.

Evidence:
- PR #135
- merge/main: `de4d1d1deed6fd4ba1fef9d720a23a0557e3887a`
- post-main CI #341: SUCCESS
- post-main Pages: SUCCESS
- recovery: `backup-post-product-integrity-p3-de4d1d1`

### P4A — XIRR validity / precision / valuation-date semantics

Status: **completed**

Key outcomes:
- raw terminal valuation instead of rounded holding total;
- actual valuation date for terminal cash flow;
- machine-readable `xirr_status / reason / asof / conventional` provenance;
- true 0% distinguished from unavailable compatibility sentinel;
- legacy numeric field retained without treating it as authoritative when status is unavailable.

Evidence:
- PR #136
- final reviewed head: `b88a99222e5a99992d483264571f08637ca6b4dd`
- merge/main: `1a4496dec4f1cfc07f07831f2db1819bf5d333bd`
- final PR CI #349: SUCCESS
- post-main CI #350: SUCCESS
- Pages #1425: SUCCESS
- recovery: `backup-post-product-integrity-p4a-1a4496d`

### P4B — Modified Dietz / linked-TWR reliability

Status: **completed**

Key outcomes:
- valid numeric TWR formula/linking preserved;
- period reliability classified as `ok / not_applicable / undefined`;
- zero denominator, non-finite period, and unfunded zero-start states no longer appear as trustworthy 0%;
- cumulative reliability becomes sticky after first undefined period;
- summary/history carry TWR status/reason/invalid-since provenance;
- Stats Grid displays unavailable new-snapshot TWR as `--`;
- Performance Chart stops strategy TWR at the first invalid period while benchmark remains independent;
- null chart gaps are not coerced to numeric zero.

Evidence:
- PR #137
- final reviewed head: `903c0a4813f0bb3dc06d617510f7ecbe7cc8da93`
- merge/main: `4ff50c40ea595b182221c5b2ffc09dbf66d2a2fe`
- post-main CI #364: SUCCESS
- Pages #1426: SUCCESS
- recovery: `backup-post-product-integrity-p4b-4ff50c4`

Known P4B residual:
- a zero-start day containing offsetting positive/negative intraday flows cannot be reconstructed reliably from the currently published **net** daily cash-flow provenance. Do not claim this case is solved until gross/order-aware flow provenance exists.

### P5A — `fetchAll()` caller contract and load concurrency

Status: **completed**

Key outcomes:
- ordinary concurrent `fetchAll()` callers share one real in-flight Promise/outcome;
- real load failures propagate instead of being swallowed;
- `afterCurrent()` requires post-calculation/new-snapshot callers to obtain a generation occurring after any older in-flight load;
- successful authentication is no longer relabeled as login failure when only the subsequent portfolio load fails;
- accepted login flow survives normal LoginOverlay unmount;
- App initial-load failure no longer stalls the loading shell;
- calculation/snapshot completion no longer claims reload success after a failed fresh load.

Evidence:
- PR #138
- final head: `fbbc992666d3722c9e121b93bf7cebafb259cd4d`
- final-head CI #368 / run `31241270334`: SUCCESS
- merge/main: `bb176870f7136457b42096341427eff47d2124a5`
- post-main CI #369 / run `31241409868`: SUCCESS
- Pages #1427 / run `31241409291`: SUCCESS
- recovery: `backup-post-product-integrity-p5a-bb17687`
- debug/rebuild refs: `backup-p5a-pre-singleflight-rebuild`, `backup-p5a-fresh-load-prototype`

Known P5A auth-boundary behavior:
- global `fetchWithAuth()` still logs out and returns `null` after an unrecoverable HTTP 401 refresh failure. `readApiJson()` otherwise fails closed for HTTP/application/malformed-response errors. P5A intentionally did not redesign the global auth/request boundary.

## Active phase — P5B

### Scope

P5B owns **frontend data reliability presentation**, not financial calculation or mutation protocol redesign.

Confirmed pre-P5B gaps:
- backend already publishes per-group `anomalies`, but frontend did not consume them;
- `DIVIDEND_POLICY_REVIEW_REQUIRED` could therefore be hidden behind an apparently clean “no pending dividends” state;
- connection/stale state was visible only as a small header status while old/stale holdings and performance remained fully presented without a persistent explanation;
- the global `connectionStatus` mixes GET/read and mutation/API failures, so it cannot by itself prove that the displayed portfolio load failed;
- DividendManager still inferred every non-Taiwan pending dividend as USD instead of consuming P3 `currency / total_net_native` provenance.

Current P5B implementation on PR #139:
- `portfolioReadStatus` is owned only by the complete `fetchAll()` load boundary (`loading / loaded / error`) and is not written by unrelated add/update/delete mutation blocks;
- `src/services/dataReliability.js` normalizes current-group anomalies and reliability issues from read-specific status plus snapshot freshness;
- `src/components/DataReliabilityBanner.vue` persistently surfaces authoritative portfolio read failure, stale snapshot, and structured anomalies across content tabs;
- a portfolio read failure explicitly warns that the screen may still contain the last successful snapshot and offers a bounded `fetchAll()` retry;
- unrelated global API/mutation failure alone does not imply that displayed portfolio data is stale;
- `DIVIDEND_POLICY_REVIEW_REQUIRED` explains that automatic estimation was deliberately withheld because tax policy is unreviewed;
- unknown future anomaly codes remain visible instead of being silently discarded;
- DividendManager consumes published currency/native-net provenance first and preserves legacy fallback only for old snapshots;
- neutral dividend empty-state copy no longer contradicts a structured manual-review warning;
- reliability banner severity backgrounds use low-alpha warning/error overlays so text contrast remains viable in both light and dark themes.

Verification to date:
- P5B base: `bb176870f7136457b42096341427eff47d2124a5`
- pre recovery: `backup-pre-product-integrity-p5b-bb17687`
- PR #139 first tested head: `5c61e001f3e0e60ae596e5b8168b0f5aeb3a2d99`
- CI #370 / run `31241978139`: SUCCESS
- late-review functional head: `8cde4c9959be47ac1629a9c79534c402140a7cc4`
- CI #377 / run `31242264197`: SUCCESS after read-status isolation and theme-contrast fixes

P5B is **not complete** until this final current-truth commit itself receives final-head CI, all changed-file diffs are re-reviewed, review threads are clear, `main/head` TOCTOU is rechecked, exact-head merge succeeds, post-main CI/Pages succeed, and a post-P5B recovery ref is created.

## Confirmed follow-up finding — P5C candidate

Dividend confirmation / record mutation has a deeper commit-boundary ambiguity that P5B intentionally does not hide with UI wording:

- a mutation can commit server-side before a subsequent browser refresh fails;
- caller-facing mutation APIs still collapse some of that sequence into boolean success/failure;
- `requestErrors.js` already contains `outcomeAmbiguous` semantics telling users to refresh before retrying an uncertain mutation.

P5C should audit and repair mutation commit/idempotency/result semantics end-to-end before changing confirmation-storage behavior. Do not treat a refresh failure after a possibly committed POST as proof that the mutation did not occur.

## Remaining queued phases

### P6 — Performance, load, and race audit

Status: **queued**

Focus:
- cross-tab leadership under load;
- polling/update contention;
- large-record and snapshot performance;
- race/failover behavior beyond the contract fixes already completed in P5A.

### P7 — Coverage architecture and dead-code removal

Status: **queued**

Focus:
- remove coupling between dead calculation paths and absolute coverage floors;
- redesign coverage protection around active source/change behavior;
- remove dead modules/imports/dependencies atomically without lowering gates.

### P8 — Contract/model consolidation

Status: **queued**

Focus:
- Pydantic V2 `ConfigDict` migration;
- explicit default factories;
- central domain invariants;
- Worker/Python/frontend contract-drift tests.

## Current execution order

1. **P5B** — finish PR #139 final-head verification and closeout.
2. **P5C** — mutation commit/idempotency/result-semantics audit if confirmed after fresh main review.
3. **P6** — performance/load/race.
4. **P7** — coverage architecture + dead-code removal.
5. **P8** — contract/model consolidation.

Do not reopen D3D or Schema 3 as part of these phases.
