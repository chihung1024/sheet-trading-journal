# R2.5A — Transaction Currency Reconciliation UX Closeout

Date: 2026-08-17 (Asia/Taipei)  
Status: **CLOSED / PRODUCTION PAGES VERIFIED**

## Primary Goal

Make legacy transactions that lack authoritative transaction currency understandable and safely repairable, so cash-ledger completeness can progress from explicit facts instead of Symbol inference or fabricated defaults.

## Root Cause

R2.4 production shadow evidence showed that the targeted cash feed and deterministic shadow derivation path were functioning, while affected legacy transaction records lacked durable `currency` metadata. The first observed readiness issue was `TRANSACTION_CURRENCY_MISSING`.

The defect was therefore a data-reconciliation / product-UX gap, not a cash-engine failure and not a reason to activate another accounting authority.

## Scope Delivered

- Added one Transaction History reconciliation surface for records without stored currency.
- Symbol-derived currency is presented only as a suggestion; selected records default to none.
- Durable confirmation reuses the existing tenant-scoped, fill-only `PUT /api/records/metadata` contract with economic guard fields.
- Repair writes are bounded to four concurrent requests, all selected rows are attempted, and one records readback is performed after the batch.
- Only readback-confirmed stored currency is classified successful.
- PUT ambiguity remains fail-closed; HTTP 401 uses the existing token-refresh path; definite conflicts remain unconfirmed unless readback independently proves the desired authoritative value.
- New manual trades expose an explicit editable currency field so future records persist a user-confirmed quote unit.
- Legacy full-record edit cannot silently persist Symbol-derived currency when durable currency is absent.
- Record History prefers stored currency. Stored-vs-Symbol disagreement prevents secondary TWD valuation instead of blending authorities.
- `GBp` remains distinct from `GBP`.

## Explicit Non-Goals Preserved

- No Worker/API permission expansion.
- No D1 migration.
- No system/API-secret cash writer.
- No cash-inclusive NAV, TWR, XIRR, FX authority or transaction chronology activation.
- No portfolio recalculation request from currency metadata repair.
- No unrelated refactor.

## Debug / Root Cause Log

### CI failure 1 — stale currency source-shape contract

Symptom: frontend contract job exited before build.  
Failure point: `frontend_instrument_currency.test.mjs`.  
Root cause: the old regression test hard-bound TradeForm to direct `detectNativeCurrency(symbol)` implementation even though R2.5A correctly introduced a stronger authority chain: confirmed/normalized currency first, Symbol detection only as suggestion/fallback.  
Fix: update the test to assert semantic authority boundaries rather than the obsolete implementation string. Production behavior was not reverted.

### CI failure 2 — journal-note test froze unrelated form-field ordering

Symptom: frontend contracts still failed after the first correction.  
Failure point: `frontend_journal_note.test.mjs`.  
Root cause: the test intended to prove Journal `note` is additive, but its regex accidentally required `tag` to remain the final field of the form forever. Adding legitimate `currency` metadata therefore violated a source-shape detail, not the Journal contract.  
Fix: narrow the test to assert that `note` remains outside the financial form declaration without freezing future legitimate financial fields.

### Frozen-review blocker — missing acceptance coverage

Finding: the implementation handled 401, mixed currencies, `GBp`, partial results and conflicts, but the new focused suite did not directly combine all required acceptance cases.  
Classification: **BLOCKER — regression evidence**, not a production defect.  
Fix: add direct 401 refresh/retry coverage plus mixed USD/GBp partial repair with HTTP 409 definite conflict and authoritative readback.  
Result: exact-head CI remained green.

## Verification

### Candidate

- PR: #330 — `feat: add transaction currency reconciliation UX`
- Base: `4bf91cfbd381e2b147eb89aeab4c3d77e3feeedd`
- Frozen candidate head: `2bfa16c26f6848caf3fd5241def2ed7159702e71`
- Changed files: 8

### Exact-head CI

CI #1133 / run `31996866556`: **SUCCESS**

Verified:
- frontend contracts — PASS;
- Vite production build — PASS;
- Python compile/tests/branch-coverage gate — PASS;
- Worker security/deployment contracts — PASS;
- Recovery Evidence Gate — PASS;
- local D1 baseline apply/verification — PASS.

### Frozen review

Exact head `2bfa16c26f6848caf3fd5241def2ed7159702e71`: **PASS / BLOCKER 0 / FOLLOW-UP 0**.

### Merge

- PR #330 merged to `main` with expected-head protection.
- Merge commit: `7acb01717395b09a0b4e09b24af8733e60a0a8cb`.

### Post-main verification

- CI #1134 / run `31996960247`: **SUCCESS** on merge SHA `7acb0171...`.
- GitHub Pages #1610 / run `31996959451`: **SUCCESS** on the same merge SHA.
- Pages repository state: `built`, source `main` `/`, HTTPS enforced.
- Production Worker was intentionally not redeployed because R2.5A contains no Worker runtime or schema change.

## Data / Security / Regression Boundaries

- Browser state is not accounting authority.
- Symbol inference never becomes durable legacy-record currency without explicit confirmation.
- Reconciliation payload excludes Journal note, tag and provenance fields.
- Tenant isolation and Worker fill-only conflict semantics remain the durable mutation boundary.
- Existing securities records remain valid even when cash currency is missing.
- Existing securities snapshot/accounting path remains unchanged.
- No cash-inclusive account-value semantics were enabled.

## Rollback

Revert merge commit `7acb01717395b09a0b4e09b24af8733e60a0a8cb` or revert PR #330. No D1 rollback or Worker rollback is required because this batch introduced neither a schema migration nor a Worker runtime change.

## Convergence

### NOW

R2.5A is complete. Do not continue changing its reconciliation implementation without new material evidence.

### NEXT

Use the production reconciliation UX to confirm missing transaction currency, then rerun/observe the existing shadow completeness path. The next product batch must be selected from the next **observed** readiness issue. If explicit opening balance becomes the next authoritative gap, address it in a separate R2.5 batch rather than assuming it in advance.

### BACKLOG

Reviewed FX/account-value methodology, cash-inclusive NAV/account performance cutover, and broker-neutral data gateway work remain downstream.

### REJECT

Guessed currency authority, fabricated zero opening cash, partial-data NAV cutover, chronology inference, parallel browser accounting engines, and unrelated cleanup.

## User Dependency

To generate the next truthful production evidence, an authenticated user with legacy missing-currency transactions must review and confirm those quote units in the production Transaction History reconciliation surface. This is a data-authority decision and must not be automated from Symbol inference alone.
