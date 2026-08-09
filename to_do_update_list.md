# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE.** Persistent Master Plan / Progress Tracker / Decision Log / Root-Cause Log / AI Handoff required by `AI_PROJECT_PLAYBOOK.md`.
>
> Update this file after every material implementation, CI result, independent review, merge, production smoke/audit, recovery ref, blocker or scope decision. Historical detail belongs in dedicated evidence documents and Git history; this file stays **current-state-first**.

Last updated: **2026-08-10**

---

# 1. Mandatory Session Startup

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this file.
4. Inspect protected `main`, active branch/PR and latest Actions.
5. Verify Current Phase / Current Batch / Next Action below against GitHub.
6. Read the current-phase evidence document.
7. Only then change code.

## Current authoritative evidence

- `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`
- `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`
- `docs/engineering/GATE_D_REPRODUCIBILITY_AUDIT.md`
- `docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md` — **current architecture roadmap authority**
- `docs/governance/risk-register.json` — historical 2026-08-06 baseline; not a current roadmap without revalidation

---

# 2. Locked Engineering Rules

- Evidence before conclusion; root cause before symptom fix.
- Investigation may expand; implementation must converge to one Current Batch.
- New findings do not automatically enter implementation scope.
- Important changes follow: recovery → scoped branch/PR → test-first where practical → fresh CI → independent review → handoff → final-head CI → exact-head merge → post-main CI → recovery.
- Never lower validation, coverage, financial-integrity, privacy, reproducibility or recovery gates merely to pass CI.
- Do not overwrite unknown/user-authored changes.
- `note` is never an implicit financial ordering or identity field.
- Repository merge does not authorize Worker deployment unless explicitly scoped.
- Every batch must leave the product usable.
- A batch is not DONE while this file is stale.

---

# 3. Current Stable State

Repository: `chihung1024/sheet-trading-journal`

Verified main after Gate-E E0 architecture review:

`32f272c973459158a18e71c89a63337bbdfd4dfa`

Runtime contracts remain unchanged by E0:

- D1 schema: **2**
- Worker release: **4.07**
- Worker API: **2.60**
- required schema: **2**

Program state:

- Gate A: **DONE**
- Gate B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D D1a–D1e: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate E / E0 Post-D Architecture Review: **DONE / POST-MAIN VERIFIED**
- Gate E / E1a Opaque GitHub Calculation Targeting: **NEXT / NOT STARTED**
- Schema 3: **NOT IMPLEMENTED**; conditionally authorized later only for the narrow ledger-revision protocol after E1 + E2-pre audit.

## Gate-E E0 terminal evidence

- branch: `pr-post-d-architecture-review`
- PR #170: `Post-Gate-D architecture review: authorize Gate E`
- final PR head: `4d342a340f2448006a1c8e6f13e05f1da7d70911`
- changed-file whitelist: exactly:
  - `docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md`
  - `to_do_update_list.md`
- PR CI #542 / run `31342771461`: **SUCCESS across Python / Frontend / Worker-D1**
- independent docs/scope review: **PASS / no BLOCKER**
- reviews: 0
- review threads: 0
- comments: 0
- protected main before merge: `2332116f0aac6ba1456e905863733f6da41eb78b`; no drift
- exact-head merge: `32f272c973459158a18e71c89a63337bbdfd4dfa`
- post-main CI #543 / run `31342909075`: **SUCCESS across Python / Frontend / Worker-D1**
- recovery: `backup-post-gate-e-e0-32f272c`

E0 changed **documentation only**. No runtime, D1 schema, Worker route, workflow, frontend, market-data, calculator or deployment behavior changed.

---

# 4. Recovery Index

Do not delete these refs during normal cleanup.

- Gate A: `backup-post-product-integrity-p6c-f3c55f4`
- Gate B: `backup-post-gate-b-03242d0`
- Gate C final: `backup-post-gate-c-ef9f5a1`
- Gate D start: `backup-gate-d-start-41338e5`
- post-D1a: `backup-post-gate-d-d1a-0d9ad8e`
- post-D1b: `backup-post-gate-d-d1b-ad9b98f`
- post-D1c: `backup-post-gate-d-d1c-768fdb6`
- post-D1d: `backup-post-gate-d-d1d-62b13dc`
- post-D1e runtime: `backup-post-gate-d-d1e-f10a8de`
- Gate-D final: `backup-post-gate-d-2332116`
- Gate-E E0: `backup-post-gate-e-e0-32f272c`

---

# 5. Completed Gate Index

| Gate / Batch | Status | Terminal authority |
|---|---|---|
| Gate A | DONE | recovery retained |
| Gate B | DONE | atomic record deletion + recovery |
| Gate C | CLOSED | `docs/engineering/GATE_C_FINAL_CLOSEOUT.md` |
| Gate D D1a | DONE | reproducibility architecture audit |
| Gate D D1b | DONE | source/config/engine deterministic identities |
| Gate D D1c | DONE | market/FX/synthetic provenance identities |
| Gate D D1d | DONE | deterministic offline replay + explicit clock seam |
| Gate D D1e | DONE | production manifest attachment + production smoke |
| Gate D closeout | CLOSED | main `2332116...`, CI #541, `backup-post-gate-d-2332116` |
| Gate E E0 | DONE | PR #170, CI #542/#543, `backup-post-gate-e-e0-32f272c` |

## Gate-C decisions still active

- Schema-2 source validity order is deterministic `Date -> record id`.
- Record id is a persistence tie-breaker, not broker-time proof.
- Source prefix integrity is authoritative; calculator `CLAMP` remains downstream compatibility/defense-in-depth.
- Public `Timestamp` / `Sequence` are recognized calculator contracts; `_sequence` is not.
- Broker chronology is deferred until a documented Gate-C reopen condition occurs.

## Gate-D decisions still active

- Deterministic identity excludes volatile run metadata.
- Source identity excludes user email/id, free-form note and created_at.
- Effective market/FX numeric identity is separate from provider diagnostics.
- Engine identity requires exact full Git SHA.
- Ambiguous/non-finite provenance fails closed.
- Deterministic replay uses explicit timezone-aware calculation clock/as-of.
- Production manifest is additive and compatible with existing Worker/D1/frontend boundaries.

---

# 6. Gate E — Safety & State Integrity

Authority:

`docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md`

Gate E addresses remaining **current-production** safety/state-integrity problems without turning the project into a broad redesign.

Explicitly rejected as the immediate next step:

- generic Schema-3 redesign;
- broker-execution table;
- cash/account ledger;
- broad provider abstraction;
- tenant UUID migration;
- Decimal migration;
- derivatives support;
- GitHub Actions replacement.

---

# 7. Current Post-D Risk Delta

## P0-A — Public GitHub workflow receives full tenant email

Current Worker user trigger still dispatches `target_user_id = principal.email` although the durable calculation job already has an opaque `public_id` and internal owner.

**Status:** OPEN.  
**Batch:** E1a — execute next.

## P0-B — realtime quote can overwrite last historical EOD row

Current market-data download can write a live quote into `hist.index[-1]` without proving that row is the quote's trading date.

**Status:** OPEN / financial correctness.  
**Batch:** E1b.

## P0-C — active job idempotency shorter than supported workflow runtime

- browser pending TTL: 15 min;
- Worker calculation idempotency window: 15 min;
- workflow timeout: 20 min plus queue delay.

**Status:** OPEN.  
**Batch:** E1c.

## P0-D — record mutations lack mutation idempotency / optimistic row revision

Ordinary create INSERT and last-writer-wins update remain.

**Status:** OPEN / structural.  
**Batch:** conditional Schema-3 E2.

## P0-E — pagination is not bound to one ledger revision

All pages are consumed and cursor integrity is verified, but concurrent mutation can still mix logical generations.

**Status:** OPEN / structural.  
**Batch:** E2.

## P0-F — calculation jobs do not bind source ledger revision

**Status:** OPEN / structural.  
**Batch:** E2.

## P0-G — stale calculation can still become latest published snapshot

Gate-D manifest proves what a result used, but Worker publication does not compare the source with current ledger generation.

**Status:** OPEN / structural.  
**Batch:** E2 compare-and-publish.

## P1 — separate later programs

- browser credential in localStorage + permissive CSP;
- one broad system API credential;
- email as persistent tenant key;
- market/benchmark calendar fragmentation.

These are important but are **not** bundled into the first Schema-3 migration.

---

# 8. Gate-E Master Plan

| Batch | Objective | Status | Schema impact |
|---|---|---|---|
| E0 | Post-D architecture re-baseline | **DONE** | none |
| E1a | Remove tenant email from public GitHub calculation dispatch | **NEXT** | none |
| E1b | Immutable EOD history + explicit realtime valuation | PLANNED | none |
| E1c | Active-job idempotency/recovery lifetime alignment | PLANNED | none unless proven unavoidable |
| E1d | Separate cursor-signing secret from system API auth | PLANNED | none |
| E2-pre | D1 atomicity / Schema-3 pre-migration audit | CONDITIONAL | audit only |
| E2a | Monotonic tenant ledger revision foundation | CONDITIONAL after E1 | additive Schema 3 |
| E2b | Mutation idempotency + optimistic row revision | CONDITIONAL | Schema 3 |
| E2c | Revision-bound pagination | CONDITIONAL | Schema 3 |
| E2d | Calculation jobs bind requested revision | CONDITIONAL | Schema 3 |
| E2e | Snapshot compare-and-publish / atomic latest pointer | CONDITIONAL | Schema 3 |
| E2f | Rollout / cutover / audit / recovery | CONDITIONAL | Schema 3 |

---

# 9. Current Batch — E1a: Opaque GitHub Calculation Targeting

**Do not begin E1b/E1c/E2 in parallel unless a proven blocker requires it.**

## Problem

The browser is tenant-authenticated and Worker already creates a durable calculation job with opaque `public_id`, but Worker dispatch still sends full email into a public GitHub workflow input.

## Required architecture contract

- browser never chooses target owner;
- Worker creates the job under authenticated principal;
- GitHub workflow dispatch receives opaque `calculation_job_id`, not email;
- runner resolves the job owner only through a system-authenticated Worker boundary;
- normal user-facing job lookup remains tenant-scoped and never exposes owner;
- scheduled all-user runs remain targetless and unchanged;
- public workflow inputs/logs contain no full email;
- no D1 migration;
- current job callback/status behavior remains compatible.

## Required test-first coverage

1. serialized GitHub dispatch contains no email field/value;
2. workflow input contract contains no target-user email for user-triggered calculation;
3. system-only job resolution returns exactly one owner internally;
4. user principal cannot retrieve another job owner's identity;
5. targeted runner processes exactly the resolved tenant;
6. scheduled run still processes all tenants;
7. invalid/missing job id fails closed;
8. calculation status callbacks remain compatible;
9. public-facing privacy regression scans dispatch/workflow evidence surfaces.

## Required execution sequence

1. Re-read merged-main Worker job routes/repository, `update.yml`, runner entrypoint and API client.
2. Create pre-E1a recovery from verified main.
3. Create one E1a branch/PR.
4. Add test-first privacy/target-resolution contracts.
5. Implement smallest system-only resolution path.
6. Fresh full CI.
7. Independent security/privacy/scope review.
8. Update this handoff with exact evidence.
9. Final-head CI.
10. Check protected-main drift / reviews / threads / comments.
11. Exact-head merge.
12. Post-main CI.
13. Post-E1a recovery.
14. Controlled production smoke because calculation dispatch/runtime targeting changes.
15. Only then activate E1b.

---

# 10. E1b — Planned: Immutable EOD + Explicit Realtime Valuation

Required contract:

- historical EOD data is never mutated by a live quote;
- live quote has explicit value/time/source;
- live value affects only an eligible current/as-of valuation path;
- historical chart/TWR/benchmark values are invariant to later live quote arrival;
- Gate-D manifest continues to hash the actual effective numeric input;
- no provider abstraction and no D1 migration.

Required fixtures include current daily row, pre-market prior-EOD-only, weekend/holiday, provider lag, unavailable live quote and TW/US date-boundary cases.

Independent financial review + production smoke are mandatory because market-data semantics change.

---

# 11. E1c — Planned: Active Job Lifetime Alignment

- queued/running job idempotency cannot expire merely by age;
- browser recovery lifetime must cover supported workflow runtime + queue/retry margin;
- terminal retry window explicit;
- generation-safe current/tombstone behavior retained;
- prefer no schema migration; stop and move to E2-pre if lease state proves necessary.

---

# 12. E1d — Planned: Cursor Secret Separation

- cursor HMAC key separated from system API authentication secret;
- controlled compatibility/rotation window;
- cursor scope/tenant binding unchanged;
- no schema migration.

Broader scoped service credentials remain a later security program.

---

# 13. Conditional Schema 3 — Ledger Revision Protocol ONLY

Schema 3 is **not yet open for implementation**.

It may start only after E1 closes and E2-pre rechecks current Cloudflare D1 transaction/batch semantics from primary documentation.

Objective:

`record mutation -> paginated read -> calculation job -> Gate-D source identity -> snapshot publication`

must bind to one monotonic tenant ledger generation.

## E2a — ledger revision foundation

- monotonic per-tenant ledger revision;
- every successful record create/update/delete increments it atomically;
- no financial field semantics change.

## E2b — mutation identity / optimistic record revision

- create idempotency identity;
- expected row revision for update/delete;
- deterministic stale conflict;
- legacy compatibility window.

## E2c — revision-bound pagination

- first page returns revision;
- cursor binds revision + tenant scope;
- mid-read mutation produces deterministic restart/conflict, never mixed ledger.

## E2d — jobs bind requested revision

- user job captures requested ledger revision;
- fetched source must match;
- scheduled tenant member receives explicit revision;
- documented supersede behavior for older work.

## E2e — compare-and-publish

- snapshot carries source revision/job publication identity in addition to Gate-D manifest;
- Worker publishes only if revision still matches;
- stale result cannot become latest;
- successful duplicate upload idempotent;
- publication/latest pointer atomic.

## E2f — rollout

additive migration → initialize revisions → dual-compatible reads → shadow observation → revision pagination → job binding → compare/publish → optimistic mutation enforcement → production audit/smoke → recovery.

### Explicit Schema-3 exclusions

Do not add merely because a migration exists:

- broker executed_at/order/execution ids;
- `broker_executions` table;
- tenant UUID;
- cash/account tables;
- derivative multipliers;
- Decimal/fixed-point columns;
- provider tables.

---

# 14. Deferred Programs

## Security/session + tenant identity

Potential later scope: revocable HttpOnly/SameSite session, remove token persistence from localStorage, CSP tightening, scoped service keys, internal tenant UUID / Google `sub` ownership.

## Market calendar

Potential later scope: reviewed exchange calendars, holidays/early closes, one UTC market-stage authority and benchmark-owned calendar/join policy.

## Broker chronology

Reopen only on Gate-C conditions or first-class broker execution ingestion. Never fabricate times for legacy date-only rows.

## Cash/account NAV

Requires explicit product decision plus broker-statement fixtures first.

## Provider abstraction

Requires a concrete second-source availability/licensing/reconciliation objective first.

## Decimal/fixed point

Requires measured broker-statement reconciliation drift first.

## Derivatives

Requires instrument-master / asset-class design first.

---

# 15. Decision Log — Post-D / Gate E

- **E-D-01 LOCKED:** Gate D is CLOSED; final recovery `backup-post-gate-d-2332116`.
- **E-D-02 LOCKED:** historical risk register is evidence, not current roadmap.
- **E-D-03 LOCKED:** broad immediate Schema-3/provider/broker/cash redesign rejected.
- **E-D-04 LOCKED:** Gate E Safety & State Integrity is the active program.
- **E-D-05 AUTHORIZED NEXT:** E1a opaque GitHub calculation targeting, no schema migration.
- **E-D-06 PLANNED:** E1b immutable EOD vs realtime valuation separation.
- **E-D-07 PLANNED:** E1c job lifetime alignment; prefer no schema.
- **E-D-08 PLANNED:** E1d cursor-signing secret separation.
- **E-D-09 CONDITIONAL:** Schema 3 only for ledger revision protocol after E1 + E2-pre.
- **E-D-10 LOCKED:** Schema 3 does not authorize broker chronology, cash, tenant UUID, Decimal, derivatives or provider tables.
- **E-D-11 DEFERRED:** same-day broker chronology remains controlled under Gate-C current long-only/source-prefix contract until reopen conditions.
- **E-D-12 DEFERRED:** account NAV/cash ledger is product-scope expansion, not current hotfix.

---

# 16. Root-Cause / Risk Log

- **RC-E-01 OPEN:** user-triggered public GitHub workflow receives full email although opaque job id exists → E1a.
- **RC-E-02 OPEN:** realtime quote can mutate prior historical EOD row → E1b.
- **RC-E-03 OPEN:** active job TTL/idempotency may expire before supported execution window → E1c.
- **RC-E-04 OPEN:** API secret and cursor signing share one trust key → E1d.
- **RC-E-05 OPEN:** records have no mutation identity/row revision → E2.
- **RC-E-06 OPEN:** record pages are not bound to one ledger revision → E2.
- **RC-E-07 OPEN:** calculation jobs have no requested ledger revision → E2.
- **RC-E-08 OPEN:** stale calculation can publish latest snapshot → E2.
- **RC-E-09 CONTROLLED:** first-class broker chronology absent; not the immediate migration driver under current Gate-C constraints.
- **RC-E-10 DEFERRED:** localStorage credential/CSP and email tenant key require separate security/identity program.

---

# 17. Immediate Next Actions

## Finish this E0 closeout handoff

1. Open docs-only PR from `pr-gate-e-e0-closeout`.
2. Changed-file whitelist: exactly `to_do_update_list.md`.
3. Run fresh full CI.
4. Verify no runtime/schema/workflow/frontend changes, no main drift, and no review/thread/comment blockers.
5. Exact-head merge.
6. Post-main CI.
7. No additional E0 runtime smoke required because E0 is documentation-only.
8. Then create fresh **pre-E1a recovery** from verified closeout main and one E1a branch.

## Then execute E1a only

First action after branch creation: authoritative read of merged-main calculation-job Worker routes/repository, `update.yml`, runner entrypoint and system API client. Do not implement E1b/E1c/E2 concurrently.
