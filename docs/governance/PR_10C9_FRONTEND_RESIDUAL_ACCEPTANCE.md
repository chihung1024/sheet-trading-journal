# PR-10C9 — Frontend Residual Correctness Acceptance

Status: IMPLEMENTED / FINAL REVIEW PENDING  
Baseline: `626fba89133dac8238d86c2464ee15479285881a`  
Recovery branch: `backup-pre-10c9-frontend-626fba8`  
Work branch: `pr-10c9-frontend-residual-correctness`  
Draft PR: `#118`

## Purpose

Close the remaining frontend-only correctness/safety defects identified in the fourth independent audit without changing Worker semantics, D1 schema/data, CSP deployment contracts, or canonical financial calculations.

## Reconfirmed defects on baseline

1. Calculation-job polling used `setInterval(async ..., 5000)` while the authenticated API deadline is 30 seconds. Requests could overlap and stale completions could race newer polling state.
2. Legacy snapshot polling had the same async-interval overlap pattern.
3. Group record mutation delegated out of the component but its service still performed raw fetch without the shared deadline/parser path.
4. Connection state initialized as connected and App rendered unconditional `連線正常` whenever it was not loading/polling; mutation success did not separately mark the portfolio snapshot as potentially stale.
5. Logout cleared the current tab's reactive state/localStorage but there was no storage-event synchronization to clear another open tab's in-memory auth state.
6. The viewport disabled user zoom and App/TradeForm retained non-semantic clickable span/div controls.
7. TradeForm hardcoded USD labels even though the journal accepts Taiwan symbols; this presentation could misstate transaction currency.

## Invariants

- A polling loop must have at most one in-flight poll request per loop instance.
- Stopping/restarting a polling loop must invalidate stale in-flight completions before they publish state or schedule another poll.
- Every frontend API mutation/read path in this batch must retain a bounded deadline and structured error parsing.
- A successful record mutation must never imply that holdings/performance snapshot is current; the UI must expose a stale/pending-recalculation state until a refreshed snapshot is observed after calculation.
- `連線正常` must only be shown after a verified successful API response, never as the idle default.
- A logout in one tab must clear the other tab's in-memory auth state on the browser `storage` event; full server-side revocation remains B05 Session V2.
- Browser zoom must remain available.
- Clickable controls changed in this batch must use semantic buttons.
- Currency presentation must distinguish Taiwan/TWD from default US/USD behavior and must not claim every symbol is USD.

## Test-first chronology

### Phase A — expected red

- Test-first head: `594d31d34faa9c973817303278c6c3d0601c61cc`.
- CI run: `31143456207`.
- Python job: PASS.
- Worker/security/D1 job: PASS.
- Frontend job: FAIL at `Run frontend security contract tests`, as expected before production fixes.
- Build was skipped because the contract-test step failed first.

The initial GitHub job annotation exposed only the failing step/exit code rather than every assertion. This evidence record therefore does not invent an assertion list. The committed regression file is the authoritative specification of the intended failing guards.

### Phase B — first root fix exposed an existing compatibility regression

- First production-fix head: `7a9d67a4d8b0f07d0c2de7c74f4fc46eae38defb`.
- The six new PR-10C9 regression guards passed.
- One pre-existing functional contract test failed: `one update requires both HTTP and application success`.
- Root cause: the new shared `readApiJson` parser correctly emitted `ApiApplicationError`, but the Group mutation adapter leaked its internal parser code `API_APPLICATION_ERROR` instead of preserving the service's existing public fallback code `APPLICATION_ERROR`.
- Repair location: `src/services/groupRecordMutation.js` adapter boundary.
- The shared deadline/parser path was retained; no test or timeout was weakened.

### Phase C — public error compatibility restored, then production build exposed an import-interface defect

- Compatibility-fix head: `c89169cb233dc8b2546659fed48dadb34d7e48db`.
- CI run: `31144348926`.
- Frontend contract result: `133/133` PASS.
- Vite production build: FAIL.
- Exact build error: `TOKEN_STORAGE_KEY` was imported from `authStorage.js`, which did not export it.
- Root cause: the cross-tab logout implementation referenced the correct canonical constant name through the wrong module interface.
- Authoritative source check showed `TOKEN_STORAGE_KEY` is already exported by `projectStorage.js`.
- Repair: import the key from canonical `projectStorage.js`; do not duplicate the literal string and do not change browser storage schema.

### Phase D — complete green proof

- Final implementation head before evidence update: `7f18cb724e31db603ae48945a625815108581c0d`.
- CI run: `31144433365`.
- Frontend security/contracts: PASS.
- Frontend production build: PASS.
- Python tests + measured coverage gate: PASS.
- Worker security/deployment + local D1 baseline checks: PASS.

This progression is retained intentionally. The two intermediate failures are not hidden because they demonstrate that the repair process followed the first-divergence rule rather than weakening tests until CI became green.

## Implemented root fixes

### Polling correctness

`src/stores/portfolio.js` replaces asynchronous interval polling with recursive `setTimeout` scheduling. Calculation-job and legacy snapshot polling each carry an epoch. Stop/restart increments the epoch so stale in-flight completions cannot publish state or schedule another poll. A next poll is scheduled only after the prior request settles.

### Truthful connectivity and snapshot freshness

`connectionStatus` now begins as `unknown`; a successful authenticated API request moves it to `connected`, while failures move it to `error`. `snapshotFreshness` is tracked separately. Successful record add/update/delete and accepted recalculation requests mark the snapshot `stale`; a subsequently fetched backend snapshot marks it `loaded`. App derives presentation from these states rather than showing an unconditional idle `連線正常` claim.

This is an explicit compatibility layer, not B06/B07 ledger revision or snapshot CAS. Until those later authoritative revisions exist, `loaded` means a backend snapshot was fetched, not that cryptographic/revision identity has been proven.

### Group mutation network path

`src/services/groupRecordMutation.js` now uses the shared `fetchWithDeadline` + `DEFAULT_REQUEST_TIMEOUT_MS` + `readApiJson` path. Its adapter preserves the pre-existing public `RecordTagUpdateError` contract:

- server `error_meta.code` remains authoritative when present;
- HTTP failure without a server code remains `HTTP_ERROR`;
- application rejection without a server code remains `APPLICATION_ERROR`;
- ordinary network failure remains `NETWORK_ERROR`;
- the new bounded transport can additionally expose typed timeout/abort/malformed-response failures without returning to unbounded raw fetch.

### Cross-tab logout compatibility

`src/stores/auth.js` listens for the browser `storage` event and clears its in-memory auth state when another tab removes the canonical token key. Listener ownership is lifecycle-bound and idempotent. The key is imported from canonical `projectStorage.js`; no duplicate key literal or storage migration was introduced.

This does not claim server-side logout/revocation. That remains B05 Session V2.

### Accessibility / semantic controls

The viewport no longer disables pinch zoom. Header refresh/profile controls and TradeForm quick-tag/remove controls changed in this batch are semantic buttons with explicit button type/labels where appropriate.

### Currency presentation containment

TradeForm no longer labels every transaction as USD. `.TW`/`.TWO` symbols display TWD/NT$; the existing default path displays USD/$. This is deliberately only a presentation containment fix. It does not pretend to support every exchange/currency; authoritative Instrument Master and fail-closed unsupported-asset behavior remain later B08/B09 work.

## Scope actually changed

Expected PR scope is limited to:

- `index.html` — viewport only; CSP text intentionally unchanged;
- `src/App.vue`;
- `src/components/TradeForm.vue`;
- `src/services/groupRecordMutation.js`;
- `src/stores/auth.js`;
- `src/stores/portfolio.js`;
- `tests/frontend_residual_correctness.test.mjs`;
- this acceptance/evidence document.

A final independent PR diff must confirm there are no additional runtime files before the PR is marked ready.

## Explicit non-goals

- no Worker source changes;
- no D1 schema/data or migration;
- no CSP origin/hardening change (reserved for PR-10D3A);
- no service-worker/PWA teardown (later B14);
- no Google ID token → application-session redesign (B05);
- no authoritative ledger revision/snapshot CAS implementation (B06/B07);
- no corporate-action/dividend economic-model repair (B11);
- no instrument-master implementation (B08/B09).

## Final acceptance before merge

PR-10C9 may be marked ready and merged only if:

1. the evidence-updated final head passes all three protected-main required checks;
2. the frontend test suite and production Vite build remain green;
3. the PR is up to date with current `main`;
4. independent patch review confirms the final diff is within the scoped frontend/evidence files and CSP content is unchanged except for the viewport line;
5. no blocking review thread remains;
6. merge uses the protected normal `merge` path with no bypass.

Post-merge `main` CI and Pages deployment must be verified before PR-10C9 is considered closed.

## Rollback

Revert the eventual PR or restore repository state from `backup-pre-10c9-frontend-626fba8`. This batch requires no D1 or Worker rollback because it changes neither.
