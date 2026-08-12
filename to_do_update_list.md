# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Documentation exists to prevent project amnesia/distortion, not to become the project.

Last updated: **2026-08-12 13:44 Asia/Taipei**  
Handoff revision: **E1c CLOSED / MD-NAN-B1 MERGED / PRODUCT FUNCTIONALITY REVIEW ACTIVE**

---

## 1. Primary Product Goal

Deliver a reliable Trading Journal user flow:

```text
login
→ view/add/edit/delete transactions
→ trigger portfolio update
→ observe/recover calculation progress
→ publish/read correct snapshot
→ show correct holdings / P&L / performance / benchmark
→ surface actionable success/failure/retry state
```

**Convergence = finish necessary correctness/functionality work, then stop unnecessary expansion.** Do not close with a known material bug merely to shorten the phase; do not keep expanding infrastructure when no material product defect justifies it.

---

## 2. Current Product Status

| Area | Status | Product meaning |
|---|---|---|
| Gate A–D | DONE | closed |
| Gate E / E0 | DONE | architecture re-review closed |
| E1a / E1b | DONE | production completed |
| E1c-A.1 | CLOSED / PRODUCTION VERIFIED | durable dispatch binding + legacy orphan residue resolved |
| E1c-B | **CLOSED / PRODUCTION VERIFIED** | refresh/reopen recovery, terminal cleanup, retained workflow queue implemented and verified |
| Gate E / E1c | **CLOSED** | no known material lifecycle blocker remains |
| MD-NAN-B1 | **MERGED / POST-MAIN VERIFIED / NORMAL PRODUCTION PATH PASS** | bounded same-provider re-fetch mitigation deployed; retry branch remains production-watch only |
| Product Functionality Review | **ACTIVE** | current single product work line |

The lifecycle/control-plane work is no longer the project focus.

---

## 3. E1c Final Production Evidence

E1c-B implementation PR #206:

- product baseline: `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- Independent Review: PASS;
- exact-head CI #676 / `31559136662`: SUCCESS;
- post-main CI #677 / `31559255388`: SUCCESS;
- Pages #1491 / `31559254780`: SUCCESS.

Final browser recovery smoke:

- user performed one normal authenticated update;
- after calculation became active, browser was refreshed with F5;
- after refresh the UI automatically resumed the existing calculation;
- user did not press update again;
- UI reached terminal completion successfully.

GitHub remote truth for that operation:

- `Update Portfolio Data #3245`;
- run `31567498004`;
- event `workflow_dispatch`;
- head `c51291686d8eefd8aa5a50bc7492269857a3d081`;
- running callback SUCCESS;
- calculation/reconciliation SUCCESS;
- snapshot upload SUCCESS;
- terminal `succeeded` callback SUCCESS;
- workflow SUCCESS;
- previous authenticated dispatch #3244 occurred more than one hour earlier, therefore F5 did **not** create a duplicate workflow run.

Retained queue uses GitHub-native `queue: max` with repository-wide `portfolio-update` serialization and `cancel-in-progress: false`. Exact syntax/contract is covered by CI/review. Do not manufacture concurrent production calculations solely to demonstrate queueing; revisit only if real replacement/saturation evidence appears.

Durable lifecycle record:

`docs/engineering/GATE_E_E1C_JOB_LIFECYCLE_2026-08-11.md`

---

## 4. Market-Data Correctness Residual

Production #3243 reproduced transient upstream daily-row incompleteness/inconsistency: provider rows could contain Open/High/Low/Volume while Close/Adj Close were NaN; at least one captured row was internally inconsistent enough that OHLC substitution would be unsafe.

PR #210 — bounded same-provider fresh re-fetch:

- product baseline: `a8b03877449e885df935389e63fc23e6eb765dd2`;
- exact-head Independent Review: PASS;
- exact-head CI #696 / `31565889026`: SUCCESS;
- post-main CI #697 / `31566063069`: SUCCESS;
- Pages #1495 / `31566062067`: SUCCESS.

Financial-integrity contract remains:

- no drop/fill/forward-fill/back-fill;
- no Open/High/Low/Adj Close substitution;
- no alternate provider or guessed price;
- one bounded fresh request to the same provider/request semantics is allowed only with complete action evidence, same selected price source, and preservation of every original provider daily date;
- unacceptable retry remains fail-closed.

#3245 is a post-merge production SUCCESS and proves the normal path remains compatible after the mitigation. It did not reproduce NaN, so the actual retry branch is **not claimed production-exercised**. Keep passive production watch; do not add speculative market-data repair work unless the defect recurs or new evidence shows incorrect financial results.

---

## 5. Current Active Batch — Product Functionality Review

Review the real user path, not architecture in isolation:

```text
1. login / session restoration
2. transaction list/read
3. add transaction
4. edit transaction
5. delete transaction
6. portfolio update trigger
7. queued/running progress and refresh/reopen recovery
8. terminal success/failure feedback
9. snapshot refresh
10. holdings correctness
11. realized/unrealized P&L and daily P&L
12. performance metrics / benchmark behavior
13. empty/error/retry states
14. mobile/responsive usability where it affects actual use
```

For each finding classify:

- **NOW** — material correctness/data bug, user-blocking failure, security/auth bypass, duplicate/lost calculation, incorrect snapshot/performance, or a defect that predictably contaminates the next functional batch;
- **NEXT** — important user-facing improvement that is safely separable;
- **BACKLOG** — genuine non-blocking technical/UX improvement;
- **REJECT** — insufficient evidence/value or infrastructure idealization without a current product problem.

Only NOW findings block the review closeout. Do not turn discovery into automatic scope expansion.

---

## 6. Known Stable Decisions

- durable server lifecycle is authoritative over browser age;
- active jobs are not expired by age alone;
- browser pending state is recovery metadata;
- exact idempotency replay and benchmark intent remain protected;
- Worker/D1 lifecycle semantics are not to be redesigned without new evidence;
- E1c does not justify Schema 3, a custom scheduler, heartbeat/sweeper, ledger redesign, Decimal migration, tenant UUID migration, or broad auth redesign;
- historical remediation plans are evidence/candidate sources, not automatic execution roadmaps;
- a known material product defect may be promoted to NOW even if it falls outside an older scope label.

---

## 7. Backlog / Deferred Unless Evidence Promotes Them

- Schema 3 / new calculation-job columns;
- custom scheduler or queue service;
- automatic job lease/heartbeat/sweeper;
- ledger revision / compare-and-publish;
- cursor-signing redesign;
- Decimal/fixed-point migration;
- tenant UUID migration;
- broad provider redesign;
- broad authentication/session redesign;
- CI/CD or governance beautification.

None of these should interrupt product functionality work without a demonstrated current correctness, security, outage, or delivery blocker.

---

## 8. Exact Next Actions

1. Complete a read-only Product Functionality Review against current main and production evidence.
2. Search existing tests/issues/recent workflow failures for real user-path defects before proposing new features.
3. Produce a compact NOW / NEXT / BACKLOG / REJECT finding set.
4. If NOW is non-empty, select **one** highest-impact functional/correctness batch and fix it completely with existing test infrastructure, exact-head CI, independent review, expected-head merge, and risk-proportional production verification.
5. If NOW is empty, close the review and select the highest-value NEXT user-facing optimization/development batch.
6. Keep MD-NAN-B1 under passive production watch; only reopen if new provider evidence materially changes the safety decision.
7. Keep this handoff concise. Update existing authority rather than creating additional process documents.
