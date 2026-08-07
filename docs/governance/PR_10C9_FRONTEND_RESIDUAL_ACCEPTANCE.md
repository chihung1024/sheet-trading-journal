# PR-10C9 — Frontend Residual Correctness Acceptance

Status: CLOSED / PASS  
Baseline: `626fba89133dac8238d86c2464ee15479285881a`  
Pre-change recovery branch: `backup-pre-10c9-frontend-626fba8`  
Work branch: `pr-10c9-frontend-residual-correctness`  
PR: `#118`  
Final reviewed head: `61cc62071b3dd3fee355d8c566c61968383fb738`  
Merge SHA: `415d408d65a41cb9da12abe055a3bbdcef39e9f4`  
Post-change recovery branch: `backup-post-10c9-415d408`

## Purpose

PR-10C9 closed the remaining frontend-only correctness and safety defects identified in the fourth independent audit without changing Worker semantics, D1 schema/data, CSP deployment contracts, or canonical financial calculations.

## Closed invariants

- Polling loops are single-flight: a next poll is scheduled only after the previous request settles.
- Stop/restart invalidates stale in-flight completions before they can publish state or schedule another poll.
- Group record mutations use the shared bounded request/parser path.
- Record mutation success no longer implies that holdings/performance snapshot is current.
- API connectivity and snapshot freshness are distinct UI states; idle UI no longer claims an unverified `連線正常` state.
- Browser storage-token removal in another tab clears the current tab's in-memory auth state.
- Browser zoom remains available and scoped clickable controls use semantic buttons.
- TradeForm no longer labels Taiwan symbols as USD.

## Test-first chronology

### Phase A — expected red

- Head: `594d31d34faa9c973817303278c6c3d0601c61cc`.
- CI: `31143456207`.
- Python: PASS.
- Worker/security/D1: PASS.
- Frontend: FAIL at `Run frontend security contract tests`, expected before implementation.
- Build was skipped because the contract-test step failed first.

GitHub exposed the failing step/exit code rather than every assertion. The committed regression test is the authoritative assertion specification; this record does not invent missing log detail.

### Phase B — first root fix exposed compatibility divergence

- Head: `7a9d67a4d8b0f07d0c2de7c74f4fc46eae38defb`.
- All six new PR-10C9 regression guards passed.
- One existing Group mutation contract test failed.
- Root cause: the shared `readApiJson` parser emitted `ApiApplicationError`, but the Group adapter leaked internal `API_APPLICATION_ERROR` rather than preserving its existing public fallback `APPLICATION_ERROR`.
- Repair: normalize the parser error at the Group service adapter boundary while retaining the shared deadline/parser path and existing server error codes.

### Phase C — compatibility restored; build exposed module-interface divergence

- Head: `c89169cb233dc8b2546659fed48dadb34d7e48db`.
- CI: `31144348926`.
- Frontend contracts: `133/133` PASS.
- Vite production build: FAIL.
- Root cause: `TOKEN_STORAGE_KEY` was imported from `authStorage.js`, while the canonical exported key already lives in `projectStorage.js`.
- Repair: import the existing canonical key from `projectStorage.js`; no duplicate key literal and no storage migration were introduced.

### Phase D — complete green proof

- Implementation head: `7f18cb724e31db603ae48945a625815108581c0d`.
- CI: `31144433365`.
- Frontend contracts/build: PASS.
- Python tests/measured coverage: PASS.
- Worker security/deployment/local D1 baseline: PASS.

### Phase E — evidence-head and independent review

- Final reviewed head: `61cc62071b3dd3fee355d8c566c61968383fb738`.
- CI: `31144526687`, all three protected-main required checks PASS.
- Independent AI review id: `4879709204`.
- Changed files: exactly eight and all within the documented PR-10C9 allowlist.
- Review threads: zero.
- `index.html` diff changed the viewport line only; the CSP policy itself was unchanged.
- No Worker, workflow, migration, D1, Python financial engine, corporate-action, or PWA/service-worker file changed.
- Merge method: normal protected `merge`.
- Bypass: **not used**.

## Implemented root fixes

### Polling correctness

`src/stores/portfolio.js` replaced asynchronous interval polling with recursive `setTimeout` scheduling. Calculation-job and legacy snapshot polling have independent epochs. Stop/restart increments the relevant epoch, preventing stale completions from publishing state or rescheduling work.

### Truthful connectivity and snapshot freshness

`connectionStatus` begins as `unknown`. Successful authenticated API responses move it to `connected`; failures move it to `error`. `snapshotFreshness` is separate. Successful add/update/delete and accepted recalculation requests mark the snapshot `stale`; fetching the backend snapshot marks it `loaded`. App derives display state from these signals instead of an unconditional idle success label.

This remains a compatibility containment layer. It is not B06/B07 ledger revision or snapshot CAS; `loaded` means a backend snapshot was fetched, not that input revision identity has been proven.

### Group mutation network path

`src/services/groupRecordMutation.js` uses `fetchWithDeadline`, `DEFAULT_REQUEST_TIMEOUT_MS`, and `readApiJson`. The adapter preserves existing public `RecordTagUpdateError` semantics while retaining typed bounded-transport failures.

### Cross-tab logout compatibility

`src/stores/auth.js` listens for browser `storage` events and clears in-memory auth state when another tab removes the canonical token key imported from `projectStorage.js`. This does not claim server-side session revocation; B05 Session V2 remains open.

### Accessibility and semantic controls

The viewport no longer disables pinch zoom. Scoped header and TradeForm interactions changed in this batch are semantic buttons with explicit button types/labels where appropriate.

### Currency presentation containment

`.TW`/`.TWO` symbols display TWD/NT$; the legacy default path displays USD/$. This is presentation containment only. Instrument Master and fail-closed unsupported/global asset handling remain B08/B09.

## Merge and post-merge acceptance

PR `#118` merged through the protected normal path at:

`415d408d65a41cb9da12abe055a3bbdcef39e9f4`

Post-merge verification:

- main CI `31144710972`: PASS for Frontend, Python, Worker/D1.
- Pages deployment `31144709919`: PASS.
- post-change checkpoint: `backup-post-10c9-415d408`.

No Worker deployment, D1 migration/schema operation, or financial-engine change was part of PR-10C9.

## Explicit carried-forward limitations

PR-10C9 intentionally does **not** close the following:

- backend record mutation still lacks authoritative ledger revision + guaranteed recomputation semantics; B06/B07 remain the root fix;
- browser cross-tab logout is not B05 server-side revocable application sessions;
- non-Taiwan/default currency handling is not an Instrument Master; B08/B09 remain open;
- environment-specific CSP mismatch N24 remains open for PR-10D3A;
- service-worker/PWA lifecycle remains B14;
- dividend/corporate-action model N31 remains B11;
- no Schema 3 work has begun.

## Recovery

To roll back repository behavior introduced by PR-10C9, revert PR `#118` or compare/restore against `backup-pre-10c9-frontend-626fba8`. The exact accepted post-change state is preserved at `backup-post-10c9-415d408`. No D1 or Worker rollback is required for this batch.

## Closeout result

**PR-10C9 is CLOSED / PASS.** Its expected-red test-first evidence, intermediate compatibility/build divergences, final green checks, independent review, protected merge, and post-merge CI/Pages proof are retained. The next runtime batch is PR-10D3A environment-aware CSP; it must remain isolated from later CSP hardening and must not re-enable arbitrary preview origins.
