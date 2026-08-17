# R2.6A — Cash-Inclusive Account Value Preview — Production Closeout

Date: 2026-08-17 (Asia/Taipei)

Status: **CLOSED / PRODUCTION VERIFIED**

## Primary Goal

Provide a deterministic, auditable current whole-account value preview by combining the existing securities market value with authoritative cash, without changing existing securities-only performance semantics.

## Delivered product boundary

R2.6A added an additive engine-owned `account_value_preview` contract and a separate user-facing `帳戶價值預覽` on the `全部` overview.

The implementation deliberately preserves these existing authorities and semantics:

- `summary.total_value` remains securities-only `持倉市值`;
- current Daily P&L remains unchanged;
- existing TWR and XIRR remain unchanged;
- the existing performance chart remains unchanged;
- group/tag views do not receive duplicated account-level cash;
- the browser renders published values and does not calculate account cash, FX, or whole-account value;
- the production Worker continues to store and return portfolio snapshot JSON opaquely and therefore required no runtime/schema deployment.

## Calculation authority

The preview is published only from the Python calculation engine when:

1. the deterministic shadow cash ledger is complete;
2. every observed cash currency can be valued using the same current engine-owned valuation FX context;
3. the published cash components reconcile to total cash value;
4. securities value + cash value reconciles to account value.

Expected incomplete cash/FX evidence produces `status=unavailable` instead of fabricating a value.

## CI / review evidence

Feature PR: **#335 — `feat: add cash-inclusive account value preview`**

Frozen exact head: `e5b465233c9aad086a7cb94fd00bab105413a36e`

Feature merge commit: `550c73f554915d3af6fe2805c788d65c045e0b87`

- exact-head CI #1147: SUCCESS;
- frozen independent review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- post-main CI #1148: SUCCESS across Frontend, Python, Worker security/recovery, and D1 baseline;
- Pages #1615: SUCCESS.

Two deterministic CI findings were fixed at root cause without weakening gates:

1. the preview badge initially used a numeric `font-size`; it was changed to an existing design-system typography token rather than weakening the typography authority test;
2. the new production Python module caused expected coverage source-scope drift; the module was registered in the existing branch-coverage governance without lowering any coverage threshold.

## Production evidence

User-triggered production workflow:

- `Update Portfolio Data #3301`;
- run ID `32001637621`;
- checkout / head SHA `550c73f554915d3af6fe2805c788d65c045e0b87`;
- workflow conclusion: SUCCESS.

Observed production evidence:

- cash shadow: `complete=True`;
- transaction rows: `192`, resolved `192`;
- cash-event rows: `2`, resolved `2`;
- observed cash currencies: `['USD']`;
- cash issue codes: `[]`;
- account-value preview: `status=ready`;
- preview cash ledger complete: `True`;
- preview cash currencies: `['USD']`;
- preview reason: `None`;
- preview missing FX: `[]`;
- production current USD→TWD valuation FX was available from the same engine valuation context;
- portfolio snapshot upload succeeded;
- user calculation completed successfully: 1 success / 0 failures.

No personal cash balance or account-value amount is versioned in this public repository closeout.

## Existing market-data diagnostic observed in the run

The run also encountered the already-supported CASY dividend-only provider row case on 2026-07-31. The market-data layer preserved the fail-closed selected-price input, re-fetched, then the reviewed semantic normalization path converted the persistent dividend-only row into an explicit as-of effective valuation. The normal calculation, reconciliation, preview, and snapshot upload all succeeded. This was not introduced by R2.6A and does not reopen this batch.

## Security / data boundaries

- no new browser accounting authority;
- no new browser FX source;
- no cash inference;
- no chronology inference;
- no Worker runtime change;
- no D1 schema change;
- no TWR/XIRR/performance cutover;
- no broker-specific importer.

## Exit-criteria result

All R2.6A exit criteria are satisfied:

1. explicit engine-owned preview contract and terminology — PASS;
2. incomplete cash/FX fail closed — PASS;
3. deterministic component reconciliation — PASS;
4. securities-only metrics unchanged — PASS;
5. frontend renders published preview only — PASS;
6. exact-head CI + frozen review — PASS;
7. production Pages/runtime evidence — PASS;
8. no implied whole-account performance cutover — PASS.

## Convergence decision

R2.6A is closed. Do not continue expanding cash/account-value plumbing merely for technical completeness.

The next product batch should favor direct user utility and automation. Whole-account TWR/XIRR/performance cutover remains a separately reviewed future decision because it carries materially higher methodology risk than the now-verified current-value preview.

Recommended next Primary Active Batch:

**R3.1A — Broker-Neutral Export & Backup Foundation**

Goal: provide a deterministic user-controlled export package containing authoritative transaction records, cash events, and necessary durable metadata so the journal can be backed up and later restored without relying on browser-local state or broker-specific assumptions.

Explicitly defer broker parsers, automatic inference, and whole-account performance cutover until separately justified by product evidence.
