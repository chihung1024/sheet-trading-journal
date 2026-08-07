# PR-10C9 — Frontend Residual Correctness Acceptance

Status: TEST-FIRST / EXPECTED RED  
Baseline: `626fba89133dac8238d86c2464ee15479285881a`  
Recovery branch: `backup-pre-10c9-frontend-626fba8`  
Work branch: `pr-10c9-frontend-residual-correctness`

## Purpose

Close the remaining frontend-only correctness/safety defects identified in the fourth independent audit without changing Worker semantics, D1 schema/data, CSP deployment contracts, or canonical financial calculations.

## Reconfirmed defects on baseline

1. Calculation-job polling uses `setInterval(async ..., 5000)` while the authenticated API deadline is 30 seconds. Requests can overlap and stale completions can race newer polling state.
2. Legacy snapshot polling has the same async-interval overlap pattern.
3. Group record mutation delegates out of the component but its service still performs raw fetch without the shared deadline/parser path.
4. Connection state initializes as connected and App renders unconditional `連線正常` whenever it is not loading/polling; mutation success does not separately mark the portfolio snapshot as potentially stale.
5. Logout clears the current tab's reactive state/localStorage but there is no storage-event synchronization to clear another open tab's in-memory auth state.
6. The viewport disables user zoom and App/TradeForm retain non-semantic clickable span/div controls.
7. TradeForm hardcodes USD labels even though the journal accepts Taiwan symbols; this presentation can misstate transaction currency.

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

## Test-first procedure

1. Add regression tests that fail on the baseline for the defects above.
2. Open a Draft PR and retain the expected-red CI evidence.
3. Repair the authoritative frontend layer, not only the displayed text.
4. Re-run the same tests and all repository CI gates.
5. Independent patch review before marking the PR ready/merging.

## Scope allowed

- `src/stores/portfolio.js`
- `src/stores/auth.js`
- narrowly scoped frontend services needed for polling/auth/currency/transport
- `src/components/GroupManager.vue` only if transport invocation contract changes
- `src/components/TradeForm.vue`
- `src/App.vue`
- `index.html` viewport only; **do not alter CSP in this PR**
- frontend regression tests
- this acceptance/evidence document and append-only execution history

## Explicit non-goals

- no Worker source changes;
- no D1 schema/data or migration;
- no CSP origin/hardening change (reserved for PR-10D3A);
- no service-worker/PWA teardown (later B14);
- no Google ID token → application-session redesign (B05);
- no authoritative ledger revision/snapshot CAS implementation (B06/B07);
- no corporate-action/dividend economic-model repair (B11);
- no instrument-master implementation (B08/B09).

## Rollback

Revert the eventual PR or restore repository state from `backup-pre-10c9-frontend-626fba8`. This batch must not require any D1 or Worker rollback.
