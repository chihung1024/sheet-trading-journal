# R3.3B — Safe Ambiguous Import Retry — Historical Handoff

Status: **SUPERSEDED / CLOSED / NOT PLANNED / NOT MERGED**

This file is retained only as historical evidence of the earlier Deferred state.

The current product decision is:

`docs/engineering/PRODUCT_SURFACE_CONVERGENCE_AND_UX_PRIORITY_DECISION_2026-08-19.md`

That newer decision supersedes every instruction below that previously treated R3.3B as work intended for automatic future resumption.

## Final current status

- PR #367: **CLOSED**;
- merged: **NO**;
- branch retained: `feat/r3-3b-safe-ambiguous-import-retry`;
- recorded head: `6eb1a86ea08b6a732b082b1e102915fe842102c2`;
- original base: `e4edf84e3a60e4c63343ff5b54659def9ec950b9`;
- 14 commits / 8 changed files / approximately +766 / -117 at closure;
- last exact-head CI before product retirement: run `32111867887`, Frontend security contracts failed while Python and Worker suites succeeded.

R3.3B must not be implicitly revived, rebased, transplanted, merged, or treated as a pending obligation.

Future import-retry work requires a fresh explicit product decision, fresh current-main architecture tracing, and a new correctness/security review.

---

## Historical context

R3.3B originally attempted to let a user explicitly retry the exact same in-memory import source after an ambiguous server response while preserving stable idempotency and avoiding duplicate transaction creation.

The preserved historical safety contract was:

1. retry only for a partial failure with an ambiguous outcome;
2. never retry committed/replayed results or explicit rejection as though they were ambiguous;
3. reuse the exact current source/profile/mapping and stable identity;
4. never reconstruct mutation payloads from receipt rows;
5. replay the batch from the beginning with the same idempotency keys;
6. never use economic-field similarity as duplicate authority;
7. no background/timed mutation retry loop;
8. no Worker/D1/schema/accounting/FX change merely to support retry;
9. receipt/retry state remains convenience/recovery presentation state, not accounting authority.

Historical intended implementation batches were:

1. shared ambiguity-retry eligibility/reconciliation gate;
2. receipt retry action + Canonical integration;
3. mapped CSV + IBKR integration;
4. exact-head CI + frozen review + expected-head merge.

These batches are **not current backlog commitments**.

---

## Current product boundary that replaced this work

### Retained

- manual transaction creation/edit/delete;
- generic record-create intent / idempotency / ambiguity recovery / authoritative readback;
- historical imported-record readability;
- Backup JSON export.

### Product-retired / frozen

- IBKR Import;
- Canonical CSV Import;
- mapped/broker-neutral import;
- mapping presets;
- CSV import template UX;
- import receipt/retry UX;
- this R3.3B retry work.

### Journal Restore

- normal UI retired;
- backend/migration/tests maintenance-only for now;
- no backend purge inside UX-R1.

The current primary implementation phase is UX-R1 Adaptive Workspace & Responsive Interaction. A future AI must read `to_do_update_list.md` and the newer product decision before using this historical file.