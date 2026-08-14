# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 3 Self-healing Snapshot Lifecycle — final exact-head CI → merge → post-main CI/Pages → Phase 4**

---

## 0. Operating doctrine

1. Product functionality and user experience are the highest priority.
2. Debugging, CI, deployment governance, RCA and documentation protect functionality; they are not the roadmap.
3. Fix generic root causes, not individual symptoms. Parallel investigation is allowed only when it converges.
4. Financial/data correctness is fail-closed and may not be traded for convenience.
5. Keep one primary active batch. Do not reopen closed infrastructure or market-data work without new material evidence.
6. Preserve exact-head CI, rollback/recovery paths and permanent handoff for R2+ work.
7. Prefer invisible automation. User intent should drive the system; dedupe, recovery, recalculation and synchronization should be automatic when correctness permits.
8. AI may orchestrate workflows; deterministic ledger/accounting logic remains rules-based — **AI 管流程，不管帳**.

---

## 1. Future-AI bootstrap / authority map

Reconstruct truth in this order:

1. `AI_PROJECT_PLAYBOOK.md` — governance/risk rules.
2. `README.md` — architecture/product orientation.
3. this file — current batch and exact next action.
4. protected `main`, open PRs, exact-head CI, Pages and deployment state.
5. `docs/engineering/PHASE3_SELF_HEALING_SNAPSHOT_2026-08-14.md` — active Phase 3 design, RCAs and closure gate.
6. `docs/engineering/PHASE2_AUTOMATIC_RECALCULATION_2026-08-14.md` — closed automatic-recalculation contract Phase 3 reuses.
7. `docs/engineering/NOW1B_DURABLE_RECORD_CREATE_INTENT_2026-08-14.md` — closed durable-create boundary.
8. Worker/D1/recovery/deployment contracts only when backend/deployment work is actually required.
9. older docs/evidence/PR/Git history for provenance only.

Do not collapse protected-main HEAD, Pages source, Worker runtime source, production authority and immutable evidence into one “current SHA”. Re-fetch before consequential actions.

---

## 2. Product architecture that must remain intact

```text
Vue 3 / Vite SPA (Cloudflare Pages)
  -> Cloudflare Worker API
  -> D1 authoritative transaction DB

transaction/update intent
  -> calculation_jobs
  -> GitHub Actions Python engine
  -> market data / ledger / split / FX / FIFO / dividend / TWR / XIRR
  -> fail-closed validation + reconciliation
  -> snapshot + deterministic calculation manifest
  -> browser poll/readback
```

D1 is authoritative for transactions. Browser persistence is bounded recovery/orchestration state only. Do not move accounting truth into browser state or AI inference.

---

## 3. Closed work — do not reopen by default

| Area | State | Evidence / meaning |
|---|---|---|
| Gate A–D / E0 / E1 lifecycle work | CLOSED | no current product blocker |
| Market-data NaN/event-row incident | CLOSED / PRODUCTION VERIFIED | passive watch only |
| Server record-create idempotency | LIVE | tenant-scoped replay/conflict contract |
| NOW-1B-A rollback-safe create transport | CLOSED / PRODUCTION VERIFIED | `/api/records/idempotent` live; Worker runtime source `a0213f05...` |
| NOW-1B-B durable create intent | CLOSED | PR #231 merged `e7c94adc...`; post-main CI #791 + Pages #1514 PASS |
| Phase 2 Automatic Recalculation | **CLOSED** | PR #232 merged `a458966...`; post-main CI #799 + Pages #1515 PASS |
| Old dedicated production create-smoke blocker | NOT A PRODUCT BLOCKER | do not hold product work for missing isolated tenant |

Do not restart broad OAuth, provider, Decimal, cash-ledger, stale-PUT, UUID, generalized idempotency, backend tombstone or distributed-ordering redesign without new concrete production evidence.

---

## 4. Phase 2 closure contract Phase 3 may rely on

Primary KPI achieved by design:

> **normal confirmed add/edit/delete transaction → manual “update portfolio” clicks = 0**

Existing lifecycle:

```text
confirmed mutation
-> durable dirty generation
-> debounce/coalesce
-> existing /api/trigger-update
-> calculation_jobs
-> exact generation coverage
-> polling/recovery
-> fresh snapshot readback
```

Important invariants remain active:

- ambiguous/rejected mutation is never declared dirty as if committed;
- deduplicated active job cannot claim a later dirty generation;
- mutation during a running job survives the old job’s success and causes one follow-up;
- first-trade `snapshotPollActive` blocks a parallel second calculation;
- job failure/404 never declares work clean;
- browser state is owner-bound, non-authoritative and contains no transaction payload.

Phase 3 must hand repair work into this lifecycle rather than build another calculation queue.

---

## 5. Phase 3 Self-healing Snapshot Lifecycle — ACTIVE

PR: **#233 — `Phase 3: self-healing snapshot lifecycle`**  
Branch: `feat/phase3-self-healing-snapshot`  
Risk: **R2 Significant**.  
Base / protected `main` at phase start: `a4589667604eb5f03dd4a8b2dfc6bf70b84021b9`.

Product objective:

> After a successful full read, automatically prove whether the materialized portfolio snapshot covers current authoritative transactions and requested benchmark. If repair is safe, hand one bounded repair intent to Phase 2; otherwise fail closed.

### Deterministic proof

Implementation: `src/services/snapshotIntegrity.js`.

The browser reproduces the existing Python `calculation_manifest.deterministic_identity.source_records` contract byte-for-byte:

- exact material transaction field set;
- `(Date, id)` ordering;
- Symbol/Type normalization;
- raw optional Tag semantics;
- Python-compatible `float.hex()`;
- versioned compact/sorted canonical JSON;
- UTF-8 SHA-256.

Python/frontend parity is locked by fixture SHA:

`87d3299660d98bc027a2ee16bcb3dbb246098b5c4e7ca6faf83fa9b3328fdaa4`

This detects cross-device edits even when `record_count` and `max_record_id` do not change.

### Classification / repair policy

- `fresh`, `empty` → no repair;
- `missing`, `stale_source`, `stale_benchmark` → bounded repair;
- malformed current/legacy-compatible manifest → bounded one-attempt repair;
- malformed authoritative records → fail closed;
- explicit future manifest / deterministic identity / canonicalization version → fail closed as unsupported.

Legacy/current snapshots may omit additive version metadata. Missing optional metadata remains compatible; explicit future versions do not.

Repair fingerprints are semantic and **exclude `updated_at`**, preventing an unchanged defect from evading the attempt bound merely by publishing a new timestamp.

### Self-healing handoff

Implementation: `src/services/snapshotSelfHealing.js`.

The controller runs only after `portfolioReadStatus === 'loaded'` from a successful full read. It:

1. assesses current records + snapshot + requested benchmark;
2. marks anomaly stale for UI truth;
3. bounds each semantic fingerprint to one attempt per installed controller lifetime;
4. never replaces an already-dirty Phase 2 generation;
5. otherwise persists one Phase 2 dirty generation;
6. yields one task boundary past the completed read single-flight;
7. invokes one fresh `portfolio.fetchAll()` handoff;
8. lets Phase 2 own debounce, trigger, `calculation_jobs`, coverage and polling.

Phase 3 never calls `/api/trigger-update` directly and adds no new persistent browser key.

### Production bootstrap

`src/main.js` installs exactly one controller using the same Pinia instance as the app:

```text
const auth = useAuthStore(pinia)
const portfolio = usePortfolioStore(pinia)
installSnapshotSelfHealing({ portfolio, auth, storage: localStorage })
```

---

## 6. Phase 3 verification chronology

### CI #800 / run `31766645660`

- Worker PASS;
- Python PASS;
- Frontend 254/255 PASS;
- root cause: Phase 3 service existed but production `src/main.js` did not install it.

Fix: minimal shared-Pinia bootstrap. No store/backend rewrite.

### CI #801 / run `31772089355`

Exact head `53c1f6ed2bb9904337002c2bbf054e75e337743a`: **SUCCESS**.

### Post-#801 adversarial review

Found two real correctness issues before merge:

1. `updated_at` was part of repair fingerprint and could enable timestamp-only repair loops;
2. explicit future manifest contracts were treated as current malformed contracts and could be auto-repaired by an older frontend.

Both were corrected with executable regressions.

### CI #803 / run `31772260676`

- Worker PASS;
- Python PASS;
- Frontend 255/257 PASS;
- root cause: first future-version correction accidentally made additive version metadata mandatory, breaking valid legacy/current snapshot compatibility.

Fix: absent optional metadata remains compatible; explicit supported v1 remains compatible; explicit future version fails closed.

### CI #804 / run `31772363579`

Code-bearing exact head `316a7ba6af1c211a0fdae69232b7520d3b8c648c`: **SUCCESS** across Frontend, Worker and Python.

This proves the code-bearing candidate only. Permanent handoff documentation advances the branch head afterward.

---

## 7. Phase 3 exact remaining gates

Do these autonomously unless GitHub/platform genuinely requires owner action:

1. after this handoff update, re-fetch PR #233 exact current head;
2. require a **fresh full CI on that exact docs-bearing head** — do not merge based on CI #804;
3. compare PR against protected `main`; expected scope is exactly:
   - `src/services/snapshotIntegrity.js`
   - `src/services/snapshotSelfHealing.js`
   - `src/main.js`
   - `tests/frontend_snapshot_integrity.test.mjs`
   - `tests/frontend_snapshot_self_healing.test.mjs`
   - `tests/frontend_snapshot_self_healing_bootstrap.test.mjs`
   - `docs/engineering/PHASE3_SELF_HEALING_SNAPSHOT_2026-08-14.md`
   - `to_do_update_list.md`
4. final R2 adversarial review must confirm:
   - Python/browser SHA parity;
   - cross-device edit detection;
   - malformed records never auto-repair;
   - future snapshot contracts fail closed;
   - legacy additive metadata remains compatible;
   - timestamps cannot refresh repair fingerprints;
   - one semantic fingerprint attempt per controller lifetime;
   - existing Phase 2 dirty generation is never replaced;
   - reconcile only after successful full read;
   - task-boundary/single-flight handoff is bounded;
   - no second trigger/debounce/retry lane;
   - exactly one shared-Pinia bootstrap controller;
   - no Worker/D1/finance/market-data/auth/deployment drift;
5. update PR #233 body with exact final head, CI and review result;
6. ordinary merge only;
7. require post-main CI SUCCESS;
8. require production Pages SUCCESS for merge SHA;
9. no Worker deployment expected;
10. do not mutate a real-user ledger solely for smoke testing.

Only then mark Phase 3 **CLOSED**.

---

## 8. Phase 4 lock

A branch named `feat/phase4-failure-triage-recovery` exists, but **Phase 4 is not active and no Phase 4 code should be developed until Phase 3 closes**.

After Phase 3 post-main CI + Pages verification:

1. verify the Phase 4 branch has no independent work;
2. fast-forward/recreate it from the new protected `main` if necessary;
3. begin Phase 4 from existing deterministic signals: calculation-job error codes, API outcome classes, snapshot-integrity states and financial validation/reconciliation results;
4. classify only safe deterministic recovery vs fail-closed/user-action states before adding AI orchestration;
5. AI may triage/route/recover workflows but must not infer or rewrite accounting truth.

---

## 9. Later roadmap

1. **Phase 3 — Self-healing Snapshot Lifecycle — ACTIVE until closure gates pass.**
2. Phase 4 — AI failure triage/recovery.
3. Phase 5 — AI Ops Autopilot.
4. Phase 6 — AI UX.

Each phase begins only after the prior user-visible flow is functionally closed.

---

## 10. Historical provenance

This handoff is intentionally converged rather than append-only. Closed Gate-E/NOW-1A/NOW-1B/Phase-2 detail remains available in Git history, merged PRs, engineering docs, governance evidence and workflow artifacts.

This file exists to answer one operational question accurately: **what should the next AI do now without breaking the product?**
