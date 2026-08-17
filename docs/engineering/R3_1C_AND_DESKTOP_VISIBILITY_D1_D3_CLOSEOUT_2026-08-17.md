# R3.1C Production Activation + Desktop Visibility D1–D3 Closeout — 2026-08-17

## Scope

This closeout records two related product milestones completed on 2026-08-17:

1. R3.1C safe journal restore execution reached protected production capability.
2. The first three Desktop Visibility batches improved desktop workspace use without changing financial semantics, API authority, persistence, or mobile behavior.

No personal financial amounts, backup contents, credentials, or destructive production restore evidence are recorded here.

---

## R3.1C — Restore Execution UX + Production Capability Activation

Status: **CLOSED / PRODUCTION VERIFIED**.

### Reviewed runtime source

- user-facing restore execution UX merged in PR #346;
- reviewed runtime source: `aaa1e39819f0f0c56d37aa02b399cc13738072eb`;
- PR #346 exact-head CI #1175: SUCCESS;
- frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- post-main CI #1176: SUCCESS;
- Pages #1626: SUCCESS.

### Production identity and activation

Fresh read-only Production Identity Evidence #27 / run `32030517867` succeeded on exact runtime source `aaa1e39819f0f0c56d37aa02b399cc13738072eb`.

Sanitized evidence:

- artifact `9288717155`;
- digest `sha256:6c3e7e779b13377e86cb86b155eb562a2b1812bf604575c2d19d28fb6887115d`;
- production D1 identity passed;
- canonical Pages production identity passed;
- live frontend contract passed;
- errors: none.

Production activation authority was versioned through PR #347 and merged at `main@3cb84d6840abdd21ef8b4195efc970e810e64dcb` after exact-head CI #1177 and frozen review PASS.

The repository-controlled Production Deployment Dispatch Broker #11 dispatched canonical Deploy Worker #14 / run `32031442311`. After the protected production environment approval:

- preflight authority checks passed;
- production D1 identity verification passed;
- additive migration `0006_journal_restore_sessions.sql` was applied;
- canonical Worker source `aaa1e39819f0f0c56d37aa02b399cc13738072eb` was deployed;
- stable post-deploy production contract reached the required consecutive passes;
- sanitized post-deploy evidence was uploaded.

Post-deploy evidence:

- artifact `9289089443`;
- digest `sha256:fb5920a12e008ee71cea3312458676f432dcea9c6c30ca78703b526951242f6e`.

### Retained safety boundary

The production route is the already-reviewed authenticated tenant-scoped empty-account atomic journal restore path. The product still does **not** support merge restore, replace-all restore, silent deletion, derived snapshot import, or a fresh idempotency key on an ambiguous retry. Production verification intentionally avoided destructive restore against the populated primary tenant.

---

## Desktop Visibility D1 — Workspace Reclaim

Status: **CLOSED / PAGES VERIFIED**.

PR #348 delivered desktop shell and viewport reclaim while preserving one navigation authority and mobile behavior.

Changes:

- desktop sticky header reduced from 64px to 56px;
- outer desktop padding and column gaps reduced;
- transaction rail changed from a fixed 360px column to a responsive 330–350px range;
- sticky transaction rail receives more usable vertical height;
- desktop Overview top-surface spacing was tightened without changing labels, values, or typography;
- at >=1680px, the existing single navigation DOM row uses the otherwise-unused sticky-header center, removing one in-flow navigation row without duplicating controls.

Evidence:

- exact feature head `859ec7bf9571b4f55843102663a052bf9a6f7077`;
- exact-head CI #1179: SUCCESS;
- frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- merged `main@22ea4bbd4528cb190429a3b8fbddf1037d95809f`;
- post-main CI #1180: SUCCESS;
- Pages #1628: SUCCESS.

---

## Desktop Visibility D2 — Overview Information Hierarchy

Status: **CLOSED / PAGES VERIFIED**.

PR #349 improved Overview composition rather than continuing blind compression.

Changes:

- at >=1600px, existing portfolio summary and daily context are placed side by side;
- account-value preview remains full width;
- detailed Daily P&L explanation remains full width;
- loading skeleton remains full width;
- performance chart remains full width;
- desktop chart height is viewport-aware: `clamp(360px, 44vh, 450px)`;
- source/DOM order and all projection/calculation authorities are unchanged.

Evidence:

- exact feature head `b5e91934f5bec5569f4e96d05d801b3d147802a8`;
- exact-head CI #1181: SUCCESS;
- frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- merged `main@8b2a86ea4d69de5dd2453ed32af54c0c00c51a1e`;
- post-main CI #1182: SUCCESS;
- Pages #1629: SUCCESS.

---

## Desktop Visibility D3 — Data Work Surfaces

Status: **CLOSED / PAGES VERIFIED**.

PR #350 focused on the highest-density desktop work surfaces without hiding data or controls.

Changes:

- transaction-history toolbar/header spacing tightened;
- four transaction count blocks become one inline desktop status strip;
- every search/filter/import/backup/refresh control remains present;
- holdings concentration panel spacing tightened without removing concentration facts, chart, list, or explanatory boundary;
- holdings table viewport changed from fixed 600px ceiling to `clamp(480px, 62vh, 760px)` on desktop;
- <=1024px/mobile component behavior remains unchanged.

Evidence:

- exact feature head `3f44ebdefa0f918c5b58ccb20dabcd3c8eee053c`;
- exact-head CI #1183: SUCCESS;
- frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- merged `main@c6acf86da3a5406a3850c458a7c8fb4f1621d753`;
- post-main CI #1184: SUCCESS;
- Pages #1630: SUCCESS.

---

## Architecture / safety conclusions

The D1–D3 work intentionally remained within the existing final layout/density authority (`src/styles/product-consistency.css`) plus Overview-local responsive composition where appropriate.

The following did not change:

- transaction/cash/accounting authority;
- FX policy;
- Daily P&L/TWR/XIRR/NAV semantics;
- Worker/API/auth contracts;
- restore semantics;
- browser persistence authority;
- typography authority;
- mobile financial/data presentation semantics.

No `font-size` rules or `!important` escape hatches were added to the cross-page layout layer.

`AI_PROJECT_PLAYBOOK.md` is unchanged because these batches do not establish a new reusable governance rule.

---

## Next product direction

The remaining persistent desktop workspace consumer is the always-open right transaction rail. A future D4 should first trace the edit/create lifecycle and then evaluate a user-controlled desktop focus mode that can temporarily reclaim horizontal space while automatically restoring the transaction rail when an edit/create action requires it.

D4 must not introduce a second transaction authority, must not affect mobile sheet behavior, and should avoid persistent browser state until the interaction contract is proven useful and safe.
