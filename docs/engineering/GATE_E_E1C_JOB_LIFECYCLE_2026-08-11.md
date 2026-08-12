# Gate E / E1c — Calculation Job Lifecycle and Idempotency

Status: **CLOSED / PRODUCTION VERIFIED**  
Finalized: **2026-08-12**

## 1. Product problem that E1c solved

Calculation updates crossed three asynchronous systems: browser state, Cloudflare Worker durable jobs, and GitHub Actions. The original implementation incorrectly let elapsed time influence liveness and recovery:

- browser pending recovery expired after 15 minutes;
- Worker idempotency could previously release an active job by age;
- GitHub default concurrency could retain only a limited pending slot and displace an older pending lifecycle run.

The resulting user-visible failure mode was severe: a real calculation could remain active while the browser forgot it, a retry could rotate identity, or an accepted durable job could become an orphan that never reached a workflow callback.

E1c therefore had to make **durable lifecycle state authoritative over wall-clock age** without creating duplicate calculations during rollout.

## 2. Locked architecture and rollout decision

E1c was intentionally split server-first:

```text
E1c-A Worker compatibility lifecycle
→ E1c-A.1 durable GitHub dispatch binding + legacy orphan reconciliation
→ E1c-B frontend lifecycle recovery + retained workflow queue
→ production browser smoke
→ E1c closeout
```

This order prevented unsafe mixed-version combinations.

Core invariants that remain authoritative:

- `queued` / `running` jobs do not become dead merely because they are old;
- exact idempotency-key replay resolves to the same durable intent;
- old frontend key rotation cannot create a second active same-tenant/same-benchmark job;
- different benchmark remains a distinct calculation intent;
- GitHub dispatch must return a positive `workflow_run_id`;
- Worker durably binds that run ID before acknowledging browser success;
- callbacks with a conflicting run identity fail closed;
- browser pending state is recovery metadata, not independent liveness authority;
- terminal state or explicit 404 semantics clear browser recovery state;
- repository-wide portfolio calculation execution remains serialized.

## 3. E1c-A / E1c-A.1 production closeout

E1c-A.1 forward runtime source:

`fe5f091fdb2c92970dff74c1a7c99052084adb95`

Live Worker version:

`68f32cee-c609-4624-aaff-eaa55ef0c77d`

Runtime contract:

`Worker 4.07 / API 2.60 / D1 Schema 2`

Legacy pre-binding residue was reconciled by protected production run `31518085574` attempt 2:

```text
before = 3
changed = 3
after = 0
```

Only the reviewed legacy `queued + github_run_id IS NULL + pre-cutover` cohort transitioned to terminal `failed` with `LEGACY_DISPATCH_UNBOUND_RECONCILED`. No transaction or snapshot mutation occurred, and the post-production contract audit passed.

A fresh authenticated production trigger then created `Update Portfolio Data #3239` / run `31557518956`; running and terminal callbacks succeeded with the same GitHub run identity and snapshot publication succeeded. PR #205 recorded the durable closeout and activated E1c-B.

Durable E1c-A.1 evidence remains in:

- `docs/engineering/GATE_E_E1C_A1_DISPATCH_BINDING_2026-08-11.md`
- `docs/governance/evidence/GATE_E_E1C_A1_CLOSEOUT_2026-08-12.json`

## 4. E1c-B implementation

PR #206 — `E1c-B: retain browser recovery and workflow queue`

Product implementation baseline:

`fdc1199bea47a2e47f38e2737827f1a2e38451f2`

Verified implementation behavior:

1. new/explicitly upgraded pending generations are lifecycle-persistent and do not expire solely by age;
2. pre-E1c-B stale unmarked live generations still obey the historical rollout TTL so old abandoned state is not resurrected;
3. currently-valid legacy pending state is best-effort upgraded without blocking recovery if storage write fails;
4. known `jobId` recovery survives refresh/reopen until durable terminal/404 semantics;
5. ambiguous pre-job state retains/replays the same idempotency intent instead of rotating by age;
6. benchmark intent is scoped so a later different benchmark does not silently reuse the prior exact-key intent;
7. generation/tombstone owner and cross-tab protections remain intact;
8. GitHub workflow concurrency remains `portfolio-update`, `cancel-in-progress: false`, with GitHub-native retained pending queue semantics (`queue: max`);
9. no Worker lifecycle, D1 schema, calculation formula, or snapshot semantic change was introduced.

Verification chain:

- Independent Review: **PASS / NO REVIEW BLOCKER**;
- exact-head CI #676 / run `31559136662`: **SUCCESS**;
- merge: `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- post-main CI #677 / run `31559255388`: **SUCCESS**;
- Pages deployment #1491 / run `31559254780`: **SUCCESS**.

## 5. Production verification

### Workflow / calculation / snapshot path

Scheduled `Update Portfolio Data #3242` / run `31560257260` completed successfully on the E1c-B product baseline, including market-data retrieval, calculation/reconciliation, transaction integrity, split-ledger parity, and snapshot publication.

### Authenticated lifecycle behavior

`#3243` proved a live browser pending identity survived logout → login while the durable job remained active. The calculation itself later failed fail-closed because of a separate market-data provider defect; the terminal lifecycle callback still succeeded.

`#3244` subsequently completed the authenticated lifecycle and snapshot path successfully.

### Final browser refresh/reopen smoke

On 2026-08-12 the user performed the required production smoke:

```text
normal authenticated update
→ calculation becomes active
→ browser F5 refresh
→ browser automatically resumes the existing calculation
→ no second update button press
→ same calculation reaches terminal completion
```

GitHub remote truth identified this operation as:

- `Update Portfolio Data #3245`;
- run `31567498004`;
- event `workflow_dispatch`;
- head `c51291686d8eefd8aa5a50bc7492269857a3d081`;
- conclusion **SUCCESS**.

Backend evidence:

- `Mark calculation job running`: **SUCCESS**;
- calculation/reconciliation: **SUCCESS**;
- snapshot upload: **SUCCESS**;
- terminal `succeeded` callback: **SUCCESS**;
- previous authenticated workflow_dispatch was #3244 more than one hour earlier, so the F5 recovery did **not** create a duplicate dispatch.

The direct browser observation plus GitHub evidence closes the previously missing refresh/reopen + terminal-cleanup acceptance behavior.

## 6. Retained queue closeout decision

E1c-B uses GitHub-native `queue: max` while preserving repository-wide serialized execution and `cancel-in-progress: false`.

The syntax and repository contract are covered by exact-head CI and independent review. We intentionally did **not** manufacture multiple simultaneous production calculations merely to force a queue-overlap demonstration. No production evidence currently shows retained-queue failure or saturation.

Residual platform limitation: GitHub's retained queue is finite (currently up to 100 pending runs under the selected platform feature). This is an operational limit, not a current product blocker. A custom scheduler/queue is not justified without real saturation or replacement evidence.

## 7. Related market-data defect discovered during E1c verification

Production #3243 reproduced an independent `MARKET_DATA_FAILED` defect: transient provider daily rows contained incomplete/inconsistent price fields. PR #210 implemented a bounded same-provider fresh re-fetch that never imputes, substitutes, drops, or fills a price and preserves existing fail-closed validation.

PR #210 product baseline:

`a8b03877449e885df935389e63fc23e6eb765dd2`

#3245 is the first normal production calculation observed after that merge and completed successfully. It did not reproduce the NaN condition, so it proves normal-path compatibility after the mitigation but does not prove the retry branch was exercised in production. The retry branch remains covered by deterministic regression tests and should stay under production watch rather than trigger speculative additional repair work.

## 8. Final closeout decision

**Gate E / E1c is CLOSED / PRODUCTION VERIFIED.**

Acceptance is met because:

- server active lifecycle no longer expires by age;
- GitHub dispatch identity is durably bound before browser acknowledgement;
- legacy unbound orphan residue is closed;
- browser recovery no longer disappears solely because time passes;
- refresh/reopen resumes the same active calculation;
- terminal completion clears the user-visible active state;
- the F5 smoke produced no duplicate workflow dispatch;
- workflow execution remains serialized with retained pending semantics;
- no known material E1c lifecycle/correctness blocker remains.

Do not reopen E1c for general lifecycle idealization. Reopen only if new production evidence demonstrates duplicate dispatch, lost durable recovery, incorrect terminal cleanup, pending-run displacement, or another material regression in this impact radius.

## 9. Next product step

The lifecycle infrastructure is no longer the project focus.

Next work is a focused Product Functionality Review over the real user path:

```text
login
→ transaction CRUD
→ trigger update
→ progress/recovery
→ snapshot refresh
→ holdings
→ P&L / performance
→ benchmark
→ actionable error/retry behavior
```

Classify actual findings as NOW / NEXT / BACKLOG / REJECT. Resolve material correctness or user-blocking defects before selecting the next feature/optimization batch; safely separable improvements should not keep E1c open.
