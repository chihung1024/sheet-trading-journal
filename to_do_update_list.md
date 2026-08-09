# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE.** Persistent Master Plan / Progress Tracker / Decision Log / Root-Cause Log / AI Handoff required by `AI_PROJECT_PLAYBOOK.md`.
>
> **Mandatory update rule:** after every material implementation, CI result, PR review, merge, production smoke/audit, recovery ref, blocker, scope decision, or main drift, update this file in the same scoped branch/PR whenever practical.
>
> Historical detail is intentionally stored in dedicated engineering evidence documents and Git history. This file is **current-state-first** so a new AI can resume execution without rereading the previous chat.

Last updated: **2026-08-10**

---

# 1. Session Startup — mandatory order

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this file.
4. Inspect protected `main`, current branch/PR, recent commits/PRs/Actions.
5. Verify Current Phase / Current Batch / Next Action below against GitHub before changing code.
6. Read the current-phase evidence document.
7. Only then implement.

## Current authoritative evidence

- `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`
- `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`
- `docs/engineering/GATE_C_C5B_PRODUCTION_AUDIT.md`
- `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`
- `docs/engineering/GATE_D_REPRODUCIBILITY_AUDIT.md`
- `docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md` — **current architecture roadmap authority after Gate D**
- `docs/governance/risk-register.json` — **historical 2026-08-06 baseline; not the current roadmap without revalidation**

---

# 2. Locked Engineering Rules

- Evidence before conclusion; root cause before symptom fix.
- Investigation may be broad; implementation must converge to one Current Batch.
- New discovery does not automatically enter implementation scope.
- Important changes: recovery → scoped branch/PR → tests/CI → independent review → handoff → final-head CI → exact-head merge → post-main verification → recovery.
- Never lower validation, coverage, financial-integrity, privacy, reproducibility or recovery gates merely to pass CI.
- Do not overwrite unknown/user-authored changes.
- `note` is never an implicit financial ordering/identity field.
- Repository merge does not authorize Worker deployment unless deployment is explicitly scoped.
- Production default behavior must remain unchanged unless the Batch explicitly authorizes a behavior change and proves it.
- Every Batch must leave a usable Stable State.
- A Batch is not DONE if this file is stale.

---

# 3. Current Stable State

Repository: `chihung1024/sheet-trading-journal`

Verified protected-main baseline before current docs-only audit branch:

`2332116f0aac6ba1456e905863733f6da41eb78b`

Runtime contracts:

- D1 schema: **2**
- Worker release: **4.07**
- Worker API: **2.60**
- required schema: **2**

Program state:

- Gate A: **DONE**
- Gate B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D D1a–D1e: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D production smoke: **VERIFIED**
- Gate E / E0 Post-D Architecture Review: **ACTIVE — docs/audit only**
- Schema 3: **NOT IMPLEMENTED**; only conditionally authorized later for the narrow ledger-revision protocol defined by the Post-D review.

## Gate-D terminal evidence

- D1e runtime merge: `f10a8de3ca51dd20fa72a42c96212d73fa6d6226`
- D1e final-head CI #537 / run `31327377673`: SUCCESS
- D1e post-main CI #538 / run `31327529828`: SUCCESS
- D1e production `Update Portfolio Data #3217` / run `31341740730`: **SUCCESS, 168 records, 2 users, 2 success / 0 failure**
- Gate-D docs closeout PR #169 final head: `4154eb9abb86bdbc47e8523222003e43cb77745b`
- PR #169 merge: `2332116f0aac6ba1456e905863733f6da41eb78b`
- Gate-D final post-main CI #541 / run `31342029846`: **SUCCESS**
- final Gate-D recovery: `backup-post-gate-d-2332116`

Gate D is therefore **DONE / CLOSED / POST-MAIN VERIFIED** at code, reproducibility, production-smoke, recovery and governance boundaries.

---

# 4. Recovery Index

Do not delete these refs during normal cleanup.

- Gate A: `backup-post-product-integrity-p6c-f3c55f4`
- Gate B: `backup-post-gate-b-03242d0`
- Gate C audit infra: `backup-post-gate-c-audit-infra-24fd65c`
- post-C6a: `backup-post-gate-c-c6a-e5df59e`
- post-C3-rem: `backup-post-gate-c-c3-rem-5928c52`
- Gate C final: `backup-post-gate-c-ef9f5a1`
- Gate D start: `backup-gate-d-start-41338e5`
- post-D1a: `backup-post-gate-d-d1a-0d9ad8e`
- pre-D1b: `backup-pre-gate-d-d1b-88a9701`
- post-D1b: `backup-post-gate-d-d1b-ad9b98f`
- pre-D1c: `backup-pre-gate-d-d1c-4971dbb`
- post-D1c: `backup-post-gate-d-d1c-768fdb6`
- pre-D1d: `backup-pre-gate-d-d1d-1381f17`
- post-D1d: `backup-post-gate-d-d1d-62b13dc`
- pre-D1e: `backup-pre-gate-d-d1e-b235d9f`
- post-D1e runtime: `backup-post-gate-d-d1e-f10a8de`
- Gate-D final: `backup-post-gate-d-2332116`

---

# 5. Completed Gate Index

This section is a compact history index. Read the linked evidence documents for full chronology, tests, blockers and rationale.

| Gate / Batch | Final status | Key terminal evidence |
|---|---|---|
| Gate A | DONE | generation-safe pending calculation recovery; recovery retained |
| Gate B | DONE | atomic Worker record deletion; recovery retained |
| Gate C | CLOSED | prefix integrity + split-adjusted parity + production smoke; `docs/engineering/GATE_C_FINAL_CLOSEOUT.md` |
| D1a | DONE | reproducibility architecture audit; no Gate-D schema migration required |
| D1b | DONE | canonical source/config/engine identities; exact SHA/float/id contracts |
| D1c | DONE | effective market/FX/synthetic identities + provider diagnostics |
| D1d | DONE | explicit clock seam + frozen network-free mixed TW/US deterministic replay |
| D1e | DONE | optional production calculation manifest + runtime attachment + production smoke |
| Gate D closeout | CLOSED | PR #169 merge `2332116...`, CI #541, `backup-post-gate-d-2332116` |

## Gate-C locked decisions still active

- Source validity order under Schema 2 is deterministic `Date -> record id`.
- Record id is a persistence tie-breaker, not broker-time proof.
- Source prefix integrity is authoritative; calculator `CLAMP` remains downstream compatibility/defense-in-depth.
- Calculator recognizes public `Timestamp` / `Sequence`; private `_sequence` is not a contract.
- Current production schema does not persist chronology fields.
- Reopen same-day execution chronology before production only under the conditions documented in `GATE_C_FINAL_CLOSEOUT.md`.

## Gate-D locked decisions still active

- Deterministic identity excludes volatile run metadata.
- Source identity excludes user email/id, free-form note and created_at.
- Effective market/FX numeric identity is separate from provider diagnostics.
- Production engine identity requires exact full Git SHA.
- Ambiguous/non-scalar/non-finite provenance fails closed.
- Deterministic replay uses an explicit timezone-aware calculation clock/as-of.
- Production snapshot manifest is additive and compatible with existing Worker/D1/frontend boundaries.
- Realtime FX enters deterministic identity only when the calculation can actually use the corresponding as-of realtime path.

---

# 6. Current Phase — Gate E: Safety & State Integrity

Formal authority:

`docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md`

## Gate-E purpose

Address the remaining **current-production** safety/state-integrity problems without converting the project into a broad rewrite.

The Post-D review explicitly rejected a one-shot bundle of:

- Schema 3 redesign;
- broker execution table;
- cash/account ledger;
- provider abstraction;
- tenant UUID migration;
- Decimal migration;
- derivatives support;
- GitHub Actions replacement.

Gate E proceeds in small batches.

---

# 7. Post-D Risk Delta — current priority

The 2026-08-06 `risk-register.json` is historical. The following classifications are the current roadmap inputs.

## P0 — current behavior / must be addressed before broad expansion

### P0-A — Public GitHub workflow receives full tenant email

Current Worker user-triggered dispatch sends:

- benchmark;
- `target_user_id = principal.email`;
- opaque calculation job id.

The workflow still declares `target_user_id` as email.

**Status:** OPEN / current privacy exposure.

**Target:** E1a.

### P0-B — realtime quote can overwrite the last historical EOD row

Current market-data download writes realtime quote into `hist.index[-1]` without proving the row is the current quote's trading date.

**Status:** OPEN / financial correctness.

**Target:** E1b.

### P0-C — active calculation idempotency shorter than supported execution window

- browser recovery TTL: 15 min;
- Worker calculation idempotency: 15 min;
- workflow timeout: 20 min plus possible queue delay.

**Status:** OPEN / lifecycle correctness.

**Target:** E1c.

### P0-D — record mutations have no idempotency/optimistic revision

Create is ordinary INSERT; update is last-writer-wins by id/user.

**Status:** OPEN / structural.

**Target:** E2 Schema-3 ledger revision protocol.

### P0-E — pagination is not bound to one ledger revision

Cursor pagination is deterministic and fully consumed by frontend/runner, but concurrent mutation can still mix generations across pages.

**Status:** OPEN / structural.

**Target:** E2.

### P0-F — jobs are not bound to a ledger revision

A job has durable status/idempotency but no source ledger generation.

**Status:** OPEN / structural.

**Target:** E2.

### P0-G — stale calculation can become latest snapshot

Worker accepts system snapshot upload, inserts it, and latest read is highest snapshot id. Gate-D manifest proves what was calculated but Worker does not compare it with a current ledger revision.

**Status:** OPEN / structural publication race.

**Target:** E2 compare-and-publish.

---

## P1 — important, but not mixed into the first migration

### Browser credential/session exposure

Google credential/token still persists in localStorage; CSP still permits `unsafe-inline` / `unsafe-eval` script execution.

**Target:** dedicated later security/session program.

### Broad system credential blast radius

One `API_SECRET` authorizes system routes and also signs record cursors.

**Near target:** E1d splits cursor signing secret first. Broader per-service credential scope is later.

### Email as persistent tenant key

D1 records/snapshots/settings/jobs still use email as owner key even though authenticated Google `sub` exists.

**Target:** dedicated tenant-identity dual-write migration after E2; do not bundle into Schema 3 unless new evidence requires it.

### Market/benchmark calendar fragmentation

Frontend refresh, backend market stage and benchmark date-range semantics still lack one reviewed exchange-calendar authority.

**Target:** later market-calendar program after state integrity.

---

## Materially mitigated / no longer use old risk wording as roadmap

- arbitrary preview frontend → production environment path: repo build policy now fails closed outside production `main` and fixed staging contract;
- GroupManager false sequential-success handling;
- frontend one-page record truncation;
- persistent transaction cache in localStorage;
- silent modeled non-TWD FX multiplier fallback;
- cross-tab automatic-refresh duplication/pause failure;
- missing benchmark identity on new snapshots;
- unbounded general authenticated fetch requests.

These may retain residual sub-risks, but their 2026-08-06 original statements are no longer accurate roadmap descriptions.

---

# 8. Gate E Master Plan

| Phase | Batch | Objective | Status | Schema impact |
|---|---|---|---|---|
| Gate E | E0 | Post-D architecture re-baseline and staged plan | **ACTIVE** | none |
| Gate E | E1a | Remove tenant email from public GitHub calculation dispatch | NEXT after E0 | none |
| Gate E | E1b | Separate immutable EOD history from realtime valuation | PLANNED | none |
| Gate E | E1c | Align active-job idempotency/recovery lifetime | PLANNED | none unless proven necessary |
| Gate E | E1d | Separate cursor-signing secret from system API auth | PLANNED | none |
| Gate E | E2-pre | Schema-3 pre-migration / D1 atomicity audit | CONDITIONAL | audit only |
| Gate E | E2a | Monotonic tenant ledger revision foundation | CONDITIONAL / AUTHORIZED ONLY AFTER E1 | additive Schema 3 |
| Gate E | E2b | Mutation idempotency + optimistic record revision | CONDITIONAL | Schema 3 dual-compatible |
| Gate E | E2c | Revision-bound pagination | CONDITIONAL | Schema 3 |
| Gate E | E2d | Calculation jobs bind requested ledger revision | CONDITIONAL | Schema 3 |
| Gate E | E2e | Snapshot compare-and-publish + atomic latest pointer | CONDITIONAL | Schema 3 |
| Gate E | E2f | Schema-3 rollout/cutover/audit/recovery | CONDITIONAL | Schema 3 |
| Later | Security/tenant | HttpOnly session, scoped service keys, internal tenant UUID | DEFERRED | separate review/migration |
| Later | Market calendar | authoritative exchange calendar + benchmark join policy | DEFERRED | no automatic schema change |

---

# 9. E0 — Current Batch

Branch:

`pr-post-d-architecture-review`

Base:

`2332116f0aac6ba1456e905863733f6da41eb78b`

Scope:

- architecture/read-only evidence;
- `docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md`;
- this persistent handoff re-baseline;
- no runtime, Worker, schema, workflow, frontend or deployment behavior change.

## E0 findings already established

1. Gate D is fully CLOSED; final CI #541 and recovery exist.
2. Old risk register cannot be copied forward as-is.
3. Public workflow tenant email exposure is still real.
4. Realtime quote / historical EOD mutation is still real.
5. Active-job 15-minute TTL vs 20-minute workflow mismatch is still real.
6. Record mutation / pagination / job / snapshot publication lack one monotonic ledger generation.
7. Same-day broker chronology remains a controlled future-capability gap under current Gate-C long-only invariants; it is not the first Schema-3 driver.
8. Cash/account NAV, provider abstraction, Decimal and derivatives remain deferred.
9. A minimal Schema 3 is conditionally justified only for ledger revision/publication correctness after E1.

## E0 Definition of Done

- [x] authoritative merged-main read;
- [x] current risk delta established;
- [x] broad redesign rejected;
- [x] Gate-E staged architecture defined;
- [x] formal Post-D review document created;
- [x] handoff re-baselined;
- [ ] open docs-only PR;
- [ ] fresh full CI;
- [ ] independent docs/scope review;
- [ ] final-head CI if handoff changes after review;
- [ ] exact-head merge;
- [ ] post-main CI;
- [ ] post-E0 recovery;
- [ ] only then start E1a.

---

# 10. E1a — NEXT Batch: Opaque GitHub Calculation Targeting

Do **not** implement until E0 closes.

## Problem

Worker already owns a durable calculation job with opaque `public_id`, yet GitHub dispatch still carries full tenant email.

## Required contract

- user browser never chooses target owner;
- Worker creates job under authenticated principal;
- GitHub dispatch receives opaque job id, not email;
- runner resolves target user by system-authenticated job lookup;
- normal user-facing job GET remains tenant-scoped and does not expose owner;
- scheduled all-user run remains targetless;
- public workflow definition no longer describes target email for normal calculation;
- logs remain masked/opaque;
- no D1 migration.

## Required tests

- serialized dispatch payload contains no email key/value;
- system-only job resolution returns exactly one target internally;
- user cannot resolve another user's job owner;
- runner targeted job processes exactly that tenant;
- scheduled run still processes all tenants;
- missing/invalid job id fails closed;
- callback behavior remains compatible;
- full CI + controlled production smoke because user-triggered runtime dispatch path changes.

---

# 11. E1b — Planned: Immutable EOD + Explicit Realtime Valuation

## Required contract

- historical EOD DataFrame is never mutated by a live quote;
- live quote has explicit value/time/source state;
- a live quote may affect only an eligible current/as-of valuation path;
- no live quote is attached to a prior EOD date;
- historical TWR/chart/benchmark state is invariant to arrival of a live quote for a later date;
- Gate-D manifest continues to identify the actual effective numeric value used;
- no broad provider abstraction.

## Required regression fixtures

- current daily row present;
- pre-market current day but only prior EOD bar exists;
- weekend/holiday;
- provider lag/missing current daily row;
- live quote unavailable;
- TW/US date boundary;
- deterministic replay/provenance.

Runtime market-data semantics change, therefore independent financial review + production smoke are mandatory.

---

# 12. E1c — Planned: Active Job Lifetime Alignment

## Required contract

- queued/running job idempotency does not expire simply by age;
- browser recovery lifetime >= supported backend runtime + queue/retry margin;
- terminal retry window is explicit;
- generation-safe tombstone/current-job behavior remains intact;
- orphaned jobs remain visible as a later lease/sweeper candidate rather than being silently reused.

Prefer no schema change. If tests prove a lease field is unavoidable, stop and move the change into E2-pre rather than silently expanding E1c.

---

# 13. E1d — Planned: Cursor Secret Separation

## Required contract

- cursor HMAC signing secret is separate from system API authentication secret;
- controlled compatibility/rotation window;
- rotating API credential does not silently alter cursor trust domain;
- cursor scope/tenant binding remains unchanged;
- no schema migration.

Broader scoped service credentials are deferred to the later security program.

---

# 14. Conditional Schema 3 — Ledger Revision Protocol ONLY

Schema 3 is **not yet opened for implementation**. It is conditionally authorized after E1 and a new E2-pre audit.

## Schema-3 objective

Bind one monotonic tenant ledger generation across:

`record mutation -> paginated read -> calculation job -> Gate-D source identity -> snapshot publication`

so stale or mixed-generation work fails deterministically.

## E2a — ledger revision foundation

Conceptual requirement:

- one monotonic ledger revision per tenant;
- every successful record create/update/delete increments revision atomically with the mutation;
- legacy data remains readable;
- no transaction financial meaning changes.

Do not write SQL until current Cloudflare D1 transaction/batch semantics are re-read from primary documentation in E2-pre.

## E2b — mutation identity / optimistic row revision

- create idempotency identity;
- expected row revision for update/delete;
- deterministic conflict on stale mutation;
- legacy-client compatibility period;
- no blind mutation retry without idempotency identity.

## E2c — revision-bound pagination

- first page identifies ledger revision;
- cursor binds tenant scope + revision;
- continuation checks current revision;
- mid-read mutation returns deterministic restart/conflict;
- frontend/runner may bounded-restart, then fail closed.

## E2d — calculation jobs bind revision

- user job captures requested ledger revision;
- fetched records must match it;
- scheduled run gets an explicit tenant revision per member;
- older queued work may be superseded under a documented rule.

## E2e — compare-and-publish snapshot

- snapshot carries ledger revision/job publication identity in addition to Gate-D manifest;
- Worker publishes only when current ledger revision matches job/snapshot revision;
- stale result cannot become latest;
- publication/latest-pointer update is atomic;
- duplicate successful upload is idempotent;
- retention cleanup cannot determine publication truth.

## E2f — rollout

1. additive migration + recovery;
2. revision initialization/backfill;
3. dual-compatible reads;
4. shadow revision observation;
5. revision-bound pagination;
6. job binding;
7. compare-and-publish;
8. optimistic mutation enforcement;
9. production audit/smoke;
10. post-Schema-3 recovery.

Every sub-batch must remain usable independently.

### Schema-3 explicit exclusions

Do not add merely because a migration exists:

- executed_at/order_id/execution_id;
- broker execution table;
- tenant UUID;
- cash/account tables;
- derivative multipliers;
- Decimal/fixed-point columns;
- provider tables.

Those require separate evidence gates.

---

# 15. Deferred Programs — not authorized by Gate E0

## Auth/session + tenant identity

Potential later scope:

- revocable HttpOnly/SameSite session;
- remove Google credential persistence from localStorage;
- CSP tightening;
- scoped runner/read/upload/job-callback keys;
- internal tenant UUID / Google `sub` ownership;
- email becomes mutable profile metadata.

Do not mix with Schema-3 ledger revision.

## Market calendar / benchmark calendar

Potential later scope:

- reviewed exchange calendars based on UTC instants;
- holidays / early closes;
- one market-stage authority;
- benchmark owns its calendar and explicit join policy.

## Broker execution chronology

Reopen only when Gate-C conditions trigger. Never fabricate execution time for legacy date-only rows.

## Cash/account NAV

Requires explicit product decision + broker-statement fixtures. Current portfolio tracker should not silently evolve into a broker general ledger.

## Provider abstraction

Require a concrete licensing/availability/reconciliation objective first.

## Decimal/fixed point

Require measured broker-statement reconciliation drift first.

## Derivatives

Require instrument-master / asset-class design first.

---

# 16. Decision Log — Post-D

- **E-D-01 LOCKED:** Gate D is DONE / CLOSED / POST-MAIN VERIFIED; final recovery `backup-post-gate-d-2332116`.
- **E-D-02 LOCKED:** historical risk register is evidence, not current roadmap; every finding must be revalidated against current main.
- **E-D-03 LOCKED:** broad Schema-3/canonical-ledger/provider/broker redesign is rejected as the immediate next step.
- **E-D-04 AUTHORIZED:** Gate E Safety & State Integrity is the next program.
- **E-D-05 AUTHORIZED NEXT:** E1a removes full email from public GitHub calculation dispatch without schema migration.
- **E-D-06 AUTHORIZED PLANNED:** E1b separates immutable EOD history from realtime valuation without provider abstraction.
- **E-D-07 AUTHORIZED PLANNED:** E1c fixes active-job idempotency/recovery lifetime mismatch; prefer no schema.
- **E-D-08 AUTHORIZED PLANNED:** E1d splits cursor-signing secret from system API secret.
- **E-D-09 CONDITIONAL:** Schema 3 is justified only for the ledger revision protocol after E1 + E2-pre primary-source D1 audit.
- **E-D-10 LOCKED:** Schema 3 does not automatically authorize broker chronology, cash, tenant UUID, Decimal, derivatives or provider tables.
- **E-D-11 DEFERRED:** same-day broker chronology remains controlled under current Gate-C long-only/source-prefix contract until a reopen condition occurs.
- **E-D-12 DEFERRED:** account NAV/cash ledger is a product-scope expansion, not a current correctness hotfix.

---

# 17. Root Cause / Risk Log — Post-D

- **RC-E-01 OPEN:** user-triggered GitHub workflow receives full email although opaque job id already exists → E1a.
- **RC-E-02 OPEN:** realtime quote mutates last historical EOD bar without date equality proof → E1b.
- **RC-E-03 OPEN:** active job TTL/idempotency window can expire before max workflow duration → E1c.
- **RC-E-04 OPEN:** API secret and cursor signing share one trust key → E1d narrow remediation.
- **RC-E-05 OPEN:** records have no mutation identity/row revision → E2.
- **RC-E-06 OPEN:** cursor pages are not bound to one ledger revision → E2.
- **RC-E-07 OPEN:** calculation job has no requested ledger revision → E2.
- **RC-E-08 OPEN:** Worker snapshot insert/latest semantics allow older calculation to publish after newer ledger mutation → E2.
- **RC-E-09 CONTROLLED:** first-class broker chronology absent; current long-only Gate-C prefix contract prevents it from becoming the immediate migration driver.
- **RC-E-10 DEFERRED:** localStorage token/CSP and email tenant key require dedicated security/identity program.

---

# 18. Immediate Next Actions

## Finish E0 docs-only architecture review

1. Open Draft PR from `pr-post-d-architecture-review` to protected `main`.
2. Changed-file whitelist must be exactly:
   - `docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md`
   - `to_do_update_list.md`
3. Run fresh full CI.
4. Independent review must confirm:
   - no runtime/schema/workflow/frontend behavior change;
   - risk classifications are supported by current main evidence;
   - deferred work is not accidentally authorized;
   - Schema-3 scope is narrow/conditional.
5. If review modifies handoff/docs, run final-head CI again.
6. Confirm protected-main drift / reviews / threads / comments.
7. Exact-head merge.
8. Verify post-main CI.
9. Create `backup-post-gate-e-e0-<sha7>` from verified merged main.
10. Update terminal audit metadata / next-phase handoff.
11. Only then create E1a branch.

## Then execute E1a only

Do not begin E1b/E1c/E2 in parallel unless a proven blocker requires it.

E1a first implementation objective:

**remove full tenant email from public GitHub calculation-dispatch inputs by resolving the target through the existing opaque calculation job id on a system-only Worker boundary.**
