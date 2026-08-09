# Post-Gate-D Architecture Review — Independent Re-baseline

Date: **2026-08-10**

## Review mandate

Re-open the architecture only after Gate D is fully closed and independently re-evaluate the deferred candidates against the **current** production code, rather than automatically carrying forward the 2026-08-06 risk-register priorities.

This review follows the repository's controlled-divergence rule:

1. inspect broadly enough to avoid local optimization;
2. separate current production defects from future capability gaps;
3. converge to the smallest next sequence of batches;
4. do not authorize Schema 3 merely because it was previously discussed;
5. do not bundle unrelated broker, cash, provider, authentication, and accounting redesigns into one migration.

This document is an **architecture/audit artifact only**. It does not change runtime behavior, D1 schema, Worker routes, market-data behavior, calculation semantics, frontend behavior, or deployment configuration.

---

# 1. Stable baseline

Reviewed protected main:

`2332116f0aac6ba1456e905863733f6da41eb78b`

Final Gate-D recovery:

`backup-post-gate-d-2332116`

Current production contracts:

- D1 schema: **2**
- Worker: release **4.07** / API **2.60** / required schema **2**
- Gate A: DONE
- Gate B: DONE
- Gate C: DONE / CLOSED / POST-MAIN VERIFIED
- Gate D D1a–D1e: DONE / CLOSED / POST-MAIN VERIFIED
- D1e controlled production smoke: `Update Portfolio Data #3217` / run `31341740730`, **2 success / 0 failure**
- final Gate-D docs closeout post-main CI: #541 / run `31342029846`, **SUCCESS**

Gate D materially improved reproducibility: current snapshots can carry a deterministic manifest describing source/config/engine/effective market/FX identity and provider diagnostics. That does **not** by itself guarantee that the result being published is based on the newest ledger revision. Reproducibility and publication concurrency are separate concerns.

---

# 2. Why the old risk register cannot be used as the new roadmap

`docs/governance/risk-register.json` remains useful historical evidence, but its baseline predates multiple completed batches. Several entries still say `accepted_for_remediation` even though their original conditions have materially changed.

Examples now materially mitigated or superseded:

- **RISK-003 preview isolation:** repository build policy now rejects arbitrary Pages preview/PR branches and recognizes only production `main` plus one fixed staging contract. External staging resources still require evidence, but the original arbitrary-preview path is no longer the current repository contract.
- **RISK-007 GroupManager mutation truth:** current orchestration distinguishes committed, partial, ambiguous and refresh/recalculation outcomes rather than blindly reporting sequential mutation success.
- **RISK-008 frontend records pagination:** frontend now follows all signed cursor pages.
- **RISK-009 transaction localStorage cache:** legacy transaction cache is actively cleared and the current record list is not used as a durable local transaction store.
- **RISK-015 / RISK-016 FX fail-closed:** current production runner validates required historical FX coverage and currency-aware conversion fails closed for modeled non-TWD currencies rather than silently using multiplier 1.0. Instrument classification remains a separate issue.
- **RISK-039 cross-tab refresh duplication:** current frontend implements visible-tab leadership, shared pause intent and automatic-action claims.
- **RISK-041 benchmark snapshot provenance:** snapshot now carries `benchmark_symbol` and Gate D manifest runtime identity includes the benchmark.
- **RISK-048 general fetch timeout:** authenticated frontend requests now use bounded fetch deadlines and mutation outcome semantics.

Therefore this review establishes a **post-Gate-D risk delta** rather than rewriting history.

---

# 3. Current findings — priority reclassification

## P0-A — Public workflow tenant identity remains exposed

**Related historical risks:** RISK-001, RISK-026.

Current Worker trigger still builds GitHub workflow inputs as:

- `custom_benchmark`
- `target_user_id = principal.email`
- `calculation_job_id`

`.github/workflows/update.yml` still declares `target_user_id` as a target-user email input.

This means the public GitHub execution plane still receives a persistent tenant identifier even though the calculation job already has an opaque public job id and D1 already stores the job's owner internally.

### Finding

**OPEN / CRITICAL / current behavior.**

### Smallest safe direction

Do not wait for internal tenant UUID migration. First remove full email from GitHub dispatch entirely:

1. user-triggered dispatch sends only opaque `calculation_job_id` plus non-sensitive calculation parameters;
2. the runner resolves the job's tenant internally through a system-authenticated Worker lookup;
3. scheduled all-user runs remain targetless;
4. workflow logs and public inputs never contain the full email;
5. system lookup does not expose tenant identity to browser/user routes.

This is a no-schema privacy improvement because `calculation_jobs` already stores `user_id`.

---

## P0-B — Realtime quote can mutate the last historical EOD bar

**Related historical risk:** RISK-014.

Current `MarketDataClient.download_data()`:

1. downloads daily history;
2. fetches a realtime quote;
3. writes that realtime quote into `hist.index[-1]` for `Close` / `Adj Close`;
4. only then prepares `Close_Adjusted`.

There is no condition proving that `hist.index[-1]` is the same trading date as the realtime quote.

A pre-market, holiday, delayed daily-bar or provider-lag condition can therefore attach a current quote to a prior EOD date. The current D1e provenance sidecar records that a realtime overlay occurred, but provenance does not undo the economic contamination.

### Finding

**OPEN / CRITICAL / current financial-correctness defect.**

### Smallest safe direction

Keep historical daily bars immutable and separate live valuation state:

- never overwrite an existing historical EOD row with a realtime quote;
- keep realtime quote value/time/source in a separate effective-valuation sidecar;
- permit realtime value to affect only an explicitly eligible current/as-of valuation path;
- if a synthetic current-date valuation row is needed by the calculator, create it explicitly with versioned provenance rather than relabeling a prior date;
- preserve D1c/D1e deterministic evidence for the actual numeric value used;
- add pre-market, holiday, missing-current-daily-row and normal-current-row regression cases.

No provider abstraction is required for this fix.

---

## P0-C — Record mutations have no idempotency or optimistic revision

**Related historical risk:** RISK-010.

Current Schema-2 `records` contains no mutation identity or row revision. Worker create is an ordinary `INSERT`; update is:

`UPDATE ... WHERE id=? AND user_id=?`

There is no expected revision and no replay identity.

### Finding

**OPEN / CRITICAL / structural.**

Consequences remain:

- retrying a create after ambiguous transport failure can duplicate a trade;
- two tabs can update the same row and last writer silently wins;
- edit/delete APIs cannot deterministically reject stale client state.

This should be addressed as part of a narrowly scoped ledger-revision migration, not by adding ad-hoc browser retry logic.

---

## P0-D — Paginated reads are deterministic but not snapshot-consistent

**Related historical risk:** RISK-036.

The frontend and runner now correctly follow every signed cursor page and detect duplicate ids/cursor loops. That fixed truncation and several pagination failure modes.

However the cursor signs ordering/scope, not a ledger revision. A record mutation between page 1 and page 2 can still produce a logically mixed read without a duplicate id or cursor loop.

### Finding

**OPEN / CRITICAL / structural.**

The correct solution is a tenant ledger revision bound to the whole paginated read. Mid-read revision change must return a deterministic restart/conflict response.

---

## P0-E — A reproducible snapshot can still be stale when published

**Related historical risks:** RISK-011, RISK-037, RISK-046.

Gate D now attaches strong deterministic evidence to snapshots, but Worker publication remains:

1. accept system upload;
2. `INSERT INTO portfolio_snapshots`;
3. latest read = highest snapshot id;
4. separately delete old retained snapshots.

The Worker does not compare the snapshot's source identity against a current ledger revision, and calculation jobs are not bound to a ledger revision.

### Finding

**OPEN / CRITICAL / structural.**

A job can start from ledger state A, the user can mutate the ledger to B, and the older A job can later upload successfully and become the latest visible snapshot. Gate-D manifest makes that stale result identifiable after the fact, but does not prevent publication.

The required architecture is a compare-and-publish protocol tied to a monotonic tenant ledger revision.

---

## P0-F — Calculation-job lifetime and idempotency windows remain inconsistent

**Related historical risks:** RISK-020, RISK-038.

Current constants:

- browser pending calculation TTL: **15 minutes**;
- Worker calculation idempotency window: **15 minutes**;
- GitHub workflow timeout: **20 minutes**, excluding queue delay.

The Worker clears an old idempotency hash by age; the schema has no lease expiry / heartbeat / superseded state.

### Finding

**OPEN / CRITICAL for lifecycle correctness; currently mitigated but not solved by durable job rows.**

### Near-term no-schema correction

Before redesigning the job schema:

- an active `queued` / `running` job must not lose deduplication merely because 15 minutes elapsed;
- browser recovery lifetime must not be shorter than the supported backend execution window;
- terminal retry retention should be explicit and longer than transport ambiguity.

Lease/sweeper/supersede semantics can then be added with the ledger-revision phase if evidence still requires them.

---

## P1-A — Authentication credential is still persisted in localStorage under a permissive CSP

**Related historical risks:** RISK-025, RISK-050.

Current auth state still restores the Google credential/token from `localStorage`. Current CSP still includes `unsafe-inline` and `unsafe-eval` for scripts.

The auth implementation has improved substantially—centralized JWT helpers, refresh controller, cross-tab synchronization and sensitive-storage cleanup—but the principal browser credential exposure model remains.

### Finding

**OPEN / HIGH-IMPACT SECURITY ARCHITECTURE.**

This warrants a staged session migration, but it should not be mixed into the first financial/data-state migration. A revocable HttpOnly/SameSite server session and CSP tightening require their own compatibility/staging gate.

---

## P1-B — One system secret has an unnecessarily broad blast radius

**Related historical risk:** RISK-043.

Current Worker treats one `API_SECRET` as the system credential for cross-tenant system routes. The same secret is also used to sign record cursors.

### Finding

**OPEN / HIGH-IMPACT SECURITY ARCHITECTURE.**

At minimum cursor signing should use a distinct secret with controlled fallback/rotation. Runner read/upload credentials and job-callback credentials should eventually be separately scoped rather than sharing one all-powerful key.

This can begin without changing tenant identity or financial schema.

---

## P1-C — Email remains the persistent tenant key

**Related historical risk:** RISK-026.

Current D1 records, snapshots, settings and calculation jobs are keyed by email. Worker authentication already has Google `sub`, but persistence continues to use `principal.email`.

### Finding

**OPEN / HIGH / identity durability and privacy.**

Do not fold this into the first Schema-3 ledger revision migration unless required. Internal tenant UUID migration affects all tables, auth, system targeting, browser recovery and data-rights semantics. It should follow opaque workflow targeting and be treated as its own dual-write migration.

---

## P1-D — Market calendar and benchmark calendar remain fragmented

**Related historical risks:** RISK-017, RISK-018.

Current frontend refresh hours and backend market-stage logic are independently implemented. They still lack one authoritative exchange-holiday/early-close calendar. Portfolio history date range is based on held-asset calendars; benchmark is calculated on that joined range rather than owning an independent benchmark calendar.

### Finding

**OPEN / HIGH, but not ahead of P0 publication/data-integrity work.**

A single UTC-instant exchange-calendar service and explicit benchmark join policy remain justified after Gate E state integrity is complete.

---

# 4. Controlled / deferred findings that should NOT drive the next migration

## Same-day broker execution chronology — controlled under current product contract

**Related historical risk:** RISK-034.

Schema 2 has no first-class `Timestamp` or `Sequence`; calculator falls back to BUY → DIV → SELL within a day. This remains a real limitation for broker-execution fidelity.

However Gate C proved the current long-only production contract has a separate authoritative `Date -> id` prefix gate. Recognized `Sequence`/`Timestamp` already has an explicit calculator contract, and Gate C defined concrete reopen conditions.

### Decision

**DEFER / controlled limitation. Do not add execution timestamp fields to the first Schema 3 merely because they are desirable.**

Reopen when:

- automated broker execution import becomes a production feature;
- true same-day sequence is supplied by ingestion;
- short/derivative semantics are added;
- a production case proves current valid long-only FIFO diverges economically.

When reopened, preserve actual broker UTC execution time/order identity; never fabricate times for legacy date-only rows.

---

## Full cash/account NAV accounting — product-scope expansion, not current hotfix

**Related historical risks:** RISK-004, RISK-005.

Current product remains security-portfolio tracking rather than a complete broker general ledger. README now uses NAV-like language instead of asserting a fully reconciled brokerage account NAV.

### Decision

**DEFER.**

Do not introduce deposits, withdrawals, settlement, liabilities and cash receivables until the product explicitly decides to become an account-level NAV/performance engine and broker-statement fixtures are available.

---

## Broad provider abstraction

**Related historical risk:** RISK-013.

Single-provider dependency remains an availability/licensing risk. Gate D added provider provenance, but not a provider abstraction.

### Decision

**DEFER.**

First separate live quotes from immutable EOD history. A second provider should be introduced only with a concrete licensing/availability/reconciliation objective; otherwise the abstraction itself adds complexity without improving truth.

---

## Decimal / fixed-point authority

**Related historical risk:** RISK-027.

SQLite REAL / Python float / JavaScript Number remains the authoritative numeric model.

### Decision

**DEFER pending measured drift evidence.**

Do not combine numeric storage migration with ledger revision. If broker-statement reconciliation later shows material cent/share drift, run a dedicated Decimal/fixed-point shadow migration with conservation tests.

---

## Derivatives / futures / contract multipliers

Still out of the current stock/ETF production contract.

### Decision

**DEFER.**

Do not add derivatives columns to Schema 3. A future instrument-master/asset-class design must precede derivatives publication.

---

# 5. Architecture decision — authorize Gate E, not a broad redesign

## Gate E — Safety & State Integrity

Gate E is authorized as the next program, but must execute in small independently releasable batches.

### E0 — Post-D architecture evidence

**This document / current branch.**

Deliverables:

- re-baseline stale risk register against current main;
- identify open current-production defects separately from future capability gaps;
- define the minimum sequence below;
- update persistent handoff;
- docs-only PR, CI, independent review, merge, post-main verification.

No runtime change.

---

## E1 — Immediate no-schema safety corrections

Execute sequentially, one PR/batch at a time.

### E1a — Opaque GitHub calculation targeting

Priority: **first** because it is a definite privacy exposure with a small blast radius.

Contract:

- browser → Worker remains tenant-authenticated;
- Worker creates/owns the calculation job;
- public GitHub dispatch receives `calculation_job_id`, never full email;
- runner resolves target tenant through a system-only Worker lookup;
- user-facing job lookup never reveals owner identity;
- scheduled all-user runs remain unchanged;
- workflow/API logs contain only masked or opaque identity;
- no schema migration.

Acceptance:

- tests inspect serialized dispatch payload and prove no email field/value;
- workflow input contract no longer declares target email for normal user-triggered calculation;
- end-to-end targeted calculation still processes exactly one tenant;
- privacy regression scans public-facing evidence surfaces.

### E1b — Immutable EOD + explicit realtime valuation

Priority: **second** because it is a present financial-correctness defect.

Contract:

- downloaded daily history is immutable after normalization;
- realtime quote never overwrites a prior EOD date;
- current/as-of live valuation is explicit and provenance-bearing;
- historical chart/TWR/benchmark rows do not change merely because a live quote arrives;
- manifest hashes the effective numeric value actually used;
- normal closed-market EOD behavior remains compatible;
- no provider abstraction and no D1 migration.

Acceptance fixtures:

- normal current daily row;
- pre-market with previous-day last bar;
- weekend/holiday;
- provider missing current daily row;
- live quote unavailable;
- TW + US date boundary;
- deterministic replay/provenance update.

### E1c — Active-job idempotency lifetime alignment

Priority: **third**.

Contract:

- queued/running job identity does not expire while the job is active;
- browser recovery TTL is not shorter than supported workflow runtime + queue/retry margin;
- terminal replay window is explicit;
- existing generation-safe frontend recovery remains intact;
- no job-schema migration unless tests prove unavoidable.

### E1d — Split cursor-signing secret from system API authentication

Small security hardening after E1c:

- introduce dedicated cursor-signing secret with dual-read/rotation compatibility;
- API credential rotation cannot invalidate or forge unrelated cursor identity unexpectedly;
- broader per-service key scoping remains a later dedicated security batch.

---

# 6. Conditional Schema 3 authorization — ledger revision protocol only

A Schema-3 migration is **conditionally justified**, but only after E1 closes and a dedicated pre-migration audit confirms the following design.

Schema 3 is **not** authorization for broker execution fields, cash accounts, derivatives, tenant UUID, provider abstraction or Decimal migration.

## Schema-3 objective

Create one monotonic tenant ledger generation that binds:

`record mutation -> paginated read -> calculation job -> source manifest -> snapshot publication`

so stale or mixed-generation results fail deterministically.

## E2a — Ledger revision foundation

Preferred conceptual model:

- one tenant ledger-state row with monotonic `ledger_revision`;
- every successful record create/update/delete increments the revision atomically with the mutation;
- existing records remain readable during rollout;
- no financial field semantics change.

Before implementation, verify D1 transactional/batch semantics from current Cloudflare primary documentation and prove rollback behavior in local D1 tests.

## E2b — Mutation identity + optimistic record revision

Add only the fields/contracts necessary for current CRUD correctness:

- create mutation idempotency identity;
- record revision / expected revision for update/delete;
- deterministic 409-style conflict for stale state;
- no automatic mutation retry without idempotency identity;
- legacy client compatibility window before enforcement.

## E2c — Revision-bound pagination

- first page returns ledger revision;
- every cursor binds to that revision and tenant scope;
- Worker compares current revision before serving continuation;
- mid-read mutation causes deterministic `LEDGER_REVISION_CHANGED` / restart, never a mixed logical ledger;
- frontend and Python runner restart a bounded number of times, then fail closed.

## E2d — Calculation job binds requested revision

- user-triggered job captures requested ledger revision;
- runner proves fetched source revision matches job revision;
- scheduled runs create an explicit member revision per tenant or equivalent deterministic binding;
- active newer revision can supersede an older queued job under a documented rule.

## E2e — Compare-and-publish snapshot

- snapshot carries source ledger revision and calculation job/publication identity alongside Gate-D manifest;
- Worker publishes only if current ledger revision matches the snapshot/job revision;
- stale calculation returns deterministic `STALE_LEDGER` / superseded state and cannot become latest;
- publication and latest-pointer update are atomic;
- retention cleanup is not allowed to determine publication truth;
- retries of the same successful snapshot are idempotent.

A small `portfolio_head`/equivalent pointer may be justified; exact SQL is intentionally not prescribed until D1 transaction semantics are audited.

## E2f — Rollout / cutover

Required sequence:

1. additive migration + recovery;
2. backfill/initialize ledger revisions;
3. dual-compatible reads;
4. shadow revision observation;
5. enable revision-bound pagination;
6. bind jobs;
7. enable compare-and-publish;
8. enforce optimistic mutation contract;
9. production audit/smoke;
10. post-Schema-3 recovery.

Every sub-batch must leave the application usable.

---

# 7. Later security/identity program — explicitly separate from Schema 3

After state integrity is stable, perform a dedicated review for:

1. internal tenant UUID / Google `sub` ownership with email as mutable profile metadata;
2. scoped runner/read/upload/job-callback service credentials;
3. revocable HttpOnly/SameSite browser session;
4. removal of Google credential persistence from localStorage;
5. CSP tightening without breaking Google Identity Services;
6. key-id/rotation overlap and audit evidence.

This is high-impact security work, but combining it with ledger revision would multiply migration dimensions and rollback risk.

---

# 8. Later market/calendar correctness program

After Gate E state integrity:

- unify TW/US market-stage, refresh scheduling and as-of logic around UTC instants + reviewed exchange calendars;
- model holidays and early closes;
- give benchmark its own calendar and explicit join policy;
- retain current fail-closed data-coverage gates.

Do not mix this with E1b's narrower live/EOD separation.

---

# 9. Explicitly deferred architecture candidates

The following remain documented but are **not authorized for implementation by this review**:

- immutable `broker_executions` table;
- first-class broker executed UTC timestamp / order id / execution id;
- canonical lot-ledger consolidation;
- full cash/deposit/withdrawal/settlement account ledger;
- Account NAV / Account TWR / Account MWRR cutover;
- derivatives/futures/options support;
- contract multiplier model;
- signed rebates/refunds/cash-event redesign;
- broad market-data provider abstraction;
- Decimal/fixed-point financial storage migration;
- full compute-plane replacement of GitHub Actions;
- normalized snapshot object-storage redesign.

They may be re-opened only by new evidence, product requirements or a later architecture gate.

---

# 10. Revised priority map

| Priority | Finding | Current disposition |
|---|---|---|
| P0 | Full email in public GitHub dispatch | **E1a — implement next** |
| P0 | Realtime quote overwrites last EOD row | **E1b** |
| P0 | Active job idempotency shorter than execution window | **E1c** |
| P0/P1 | API secret also signs cursors | **E1d narrow split; broader scoping later** |
| P0 | Record create/update lacks idempotency/revision | **E2 Schema 3** |
| P0 | Pagination not bound to ledger revision | **E2 Schema 3** |
| P0 | Jobs not bound to ledger revision | **E2 Schema 3** |
| P0 | Stale snapshot can publish latest | **E2 Schema 3** |
| P1 | Token in localStorage + permissive CSP | dedicated security/session program after E2 |
| P1 | Email as persistent tenant key | dedicated tenant-identity migration after E2 |
| P1 | Market/benchmark calendar fragmentation | dedicated market-calendar program after E2 |
| Deferred | Same-day broker chronology | reopen only on Gate-C conditions / broker ingest |
| Deferred | Cash/account NAV | product-scope decision first |
| Deferred | Provider abstraction | concrete second-source objective first |
| Deferred | Decimal/fixed point | measured reconciliation drift first |
| Deferred | Derivatives | instrument model first |

---

# 11. Independent decision

## What should happen next

**Proceed with Gate E / E1a — opaque GitHub calculation targeting.**

Reasoning:

- confirmed current privacy exposure;
- smallest blast radius;
- no schema migration;
- existing calculation-job public id already provides the required opaque handle;
- removes sensitive identity from a public execution plane before larger state changes.

Then execute **E1b realtime/EOD separation**, because it is the most direct remaining financial-correctness defect.

Only after E1a–E1d are qualified should the project open the Schema-3 pre-migration audit for the **ledger revision protocol**.

## What should NOT happen next

Do not start with:

- a generic "Schema 3 redesign";
- a new broker-execution table;
- cash accounting;
- a provider interface abstraction;
- Decimal migration;
- tenant UUID migration;
- a GitHub-Actions replacement.

Those directions remain possible, but current evidence does not justify putting them ahead of the narrow P0 fixes and ledger publication correctness.

---

# 12. Gate-E execution governance

Every Gate-E implementation batch must follow:

1. authoritative merged-main read;
2. exact recovery ref;
3. one scoped branch/PR;
4. test-first contract where practical;
5. fresh full CI;
6. independent semantic/security/privacy/financial review;
7. persistent `to_do_update_list.md` update;
8. final exact-head CI;
9. protected-main drift check;
10. exact-head merge;
11. post-main CI;
12. post-batch recovery;
13. production smoke only when the runtime path materially changes.

No batch may lower existing coverage, ledger integrity, reconciliation, snapshot validation, recovery or reproducibility gates to pass CI.
