# R3.3B — Safe Ambiguous Import Retry — Deferred Handoff

Status: **DEFERRED / PRESERVED FOR RESUMPTION**

Deferred on: **2026-08-19 Asia/Taipei**

Reason: the user explicitly reprioritized the next development phase to **UX-R1 — Adaptive Workspace & Responsive Interaction**. R3.3B is not cancelled. Its current implementation branch and product contract are preserved so a future AI session can recover the work from repository truth without relying on chat history.

## Remote state at deferral

Planning baseline `main`:

- `44c62993706c083fd23fb7d1200adf217471efd4`

Existing R3.3B PR:

- PR: **#367 — `feat: add safe ambiguous import retry`**
- state: **OPEN / DRAFT / NOT MERGED**
- branch: `feat/r3-3b-safe-ambiguous-import-retry`
- head at deferral: `6eb1a86ea08b6a732b082b1e102915fe842102c2`
- original base recorded by GitHub: `e4edf84e3a60e4c63343ff5b54659def9ec950b9`
- commits: 14
- changed files: 8
- additions/deletions at deferral: +766 / -117

Last exact-head CI at deferral:

- CI #1255 / run ID `32111867887`: **FAILURE**
- Frontend contracts and build: **FAILURE** at `Run frontend security contract tests`
- Python tests: **SUCCESS**
- Worker security and deployment tests: **SUCCESS**

The Frontend failure has **not** been treated as a reason to patch or weaken security contracts. Root-cause classification is intentionally left for the future resumption session against then-current `main`.

## Product goal

When an import stops on an ambiguous server response, allow one explicit user-triggered retry of the exact same source that is still held in memory, preserving the existing stable idempotency/recovery authority and avoiding manual file re-selection.

## Preserved product contract

1. Retry is offered only for `status === 'partial_failure'` with `failure.outcomeAmbiguous === true`.
2. No ambiguous retry for committed/replayed results, sync-only warnings, or explicit rejection.
3. Retry reuses the exact current in-memory source/profile/mapping and existing preparer/writer.
4. Never reconstruct mutation payloads from receipt rows.
5. Retry begins the exact batch from the beginning; already-confirmed items replay through the same stable idempotency keys.
6. The ambiguous item must reuse the same identity and be re-resolved; no fresh identity is permitted.
7. Never use economic-field similarity as duplicate authority.
8. Canonical/mapped retry must satisfy the existing source-profile/readiness contract.
9. Mapped retry requires the current mapping to remain unchanged.
10. IBKR retry is disabled while its profile is edited but not revalidated (`profileDirty`).
11. The retry action must be explicit user intent; no background/timed automatic mutation loop.
12. No Worker/D1/schema/accounting/FX/idempotency change unless a future current-main trace proves the existing stable-key reproduction contract insufficient.
13. Receipt/retry state remains convenience/recovery presentation state, never accounting or transaction-identity authority.

## Original intended implementation batches

1. Shared ambiguity-retry eligibility/reconciliation gate + focused tests.
2. Shared receipt retry action + Canonical integration.
3. Mapped CSV + IBKR integration after deterministic stable-key evidence remains valid.
4. Full exact-head CI → frozen review → expected-head merge.

## Important resumption rule

**Do not hard-merge or blindly rebase PR #367 when work resumes.**

The branch was created against a substantially older `main`, and `main` has continued to evolve through production-correctness and UX phases. A future AI must first treat remote `main` as source of truth and perform an overlap/invariant audit.

Required resumption sequence:

1. Refresh current protected `main`, PR #367 metadata/head, open PRs, exact-head CI, and deployment truth.
2. Re-read `AI_PROJECT_PLAYBOOK.md`, `README.md`, `to_do_update_list.md`, this file, and current import architecture.
3. Compare PR #367 changed files/commits against all changes since its original base.
4. Re-trace Canonical, mapped CSV, and IBKR source → preparation → stable identity/idempotency key → durable writer → mutation outcome → receipt/readback using current code.
5. Reproduce CI #1255's Frontend security-contract failure only if still relevant; classify root cause as production logic, obsolete test contract, or main-drift integration.
6. Choose deliberately between:
   - transplanting only still-valid generic changes onto fresh current `main`, or
   - cleanly reimplementing R3.3B against current contracts.
7. Never preserve old code merely to retain branch history.
8. Run complete exact-head CI and frozen review before merge.

## Out of scope when resumed

- retrying explicit rejection without user correction;
- automatic/background retry loops;
- persisting broker source or full receipt for future sessions;
- receipt-derived mutations;
- fuzzy duplicate matching;
- receipt export/download unless separately prioritized;
- new broker adapters;
- unrelated Worker/D1/accounting/FX refactor.

## Relationship to UX-R1

While UX-R1 is Primary Active, PR #367 should remain a Draft/deferred reference and must not be merged. UX-R1 may change layout/presentation around import controls, but should not silently absorb or partially implement R3.3B mutation behavior. When UX-R1 closes, re-evaluate product priority and resume R3.3B only from fresh remote truth.
