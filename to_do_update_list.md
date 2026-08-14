# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not an instruction to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **NOW-1B Durable Transaction Intent → merge/production Pages verification → Phase 2 Automatic Recalculation**

---

## 0. Operating doctrine

1. Product functionality and user experience are the highest priority.
2. Debugging, CI, deployment governance, RCA and documentation exist to protect functionality; they are not the product roadmap.
3. Fix generic root causes, not individual symptoms. Parallel investigation is allowed only when it converges.
4. Financial/data correctness is fail-closed and may not be traded for convenience.
5. Keep one primary active batch. Do not reopen closed infrastructure or market-data work without new material evidence.
6. Preserve stable checkpoints, exact-head CI, rollback/recovery paths and a permanent handoff for R2+ work.
7. Prefer invisible automation. The user should express intent; the system should handle dedupe, retry/recovery, recalculation and synchronization when correctness permits.
8. AI may orchestrate workflows; deterministic ledger/accounting logic remains rules-based — **AI 管流程，不管帳**.

---

## 1. Future-AI bootstrap / authority map

Reconstruct truth in this order:

1. `AI_PROJECT_PLAYBOOK.md` — governance and risk rules.
2. `README.md` — architecture/product orientation.
3. this file — current batch and exact next action.
4. protected `main`, open PRs, CI, Pages, current workflow/deployment state.
5. `worker-manifest.json`, `wrangler.toml`, `config/production-activation-authority.json`, recovery/deployment contracts and verifier tests.
6. `docs/engineering/NOW1B_DURABLE_RECORD_CREATE_INTENT_2026-08-14.md` — current NOW-1B design/evidence.
7. `docs/DEPLOYMENT.md` only when deployment work is actually required.
8. older `docs/engineering/`, `docs/governance/evidence/`, `audits/`, PR/Git history for provenance only.

Do not collapse these identities into one “current SHA”:

- protected-main HEAD;
- selected/deployed Worker runtime source;
- Pages source;
- production activation authority;
- immutable evidence baseline.

Always re-fetch before consequential actions.

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
  -> snapshot upload
  -> browser poll/readback
```

D1 is authoritative for transactions. Browser persistence is only bounded recovery/cache state. Do not move accounting truth into browser state or AI inference.

---

## 3. Closed work — do not reopen by default

| Area | State | Meaning |
|---|---|---|
| Gate A–D / E0 / E1 lifecycle work | CLOSED | no current product blocker |
| Market-data NaN/event-row incident | CLOSED / PRODUCTION VERIFIED | generic recovery path was production exercised; passive watch only |
| Server record-create idempotency | LIVE | tenant-scoped exactly-once replay contract is active |
| NOW-1B-A rollback-safe transport | **CLOSED / PRODUCTION VERIFIED** | frontend may safely use `/api/records/idempotent` |
| Old authenticated-create smoke infrastructure blocker | **NOT A PRODUCT BLOCKER** | do not hold frontend/product work for a missing dedicated production test tenant |

Do not restart broad OAuth, provider, Decimal, cash-ledger, stale-PUT, UUID, generalized idempotency, or backend tombstone redesign without new concrete evidence.

---

## 4. NOW-1B-A — production evidence

Rollback-safe transport exists because a simple capability preflight had a TOCTOU rollback race.

Contract:

- frontend create endpoint: **`POST /api/records/idempotent`**;
- new `worker-entry.js` rewrites only that exact POST path to canonical `/api/records`;
- older Worker runtime does not know the alias and returns 404 before authentication/mutation;
- frontend must never fall back to legacy `/api/records` after alias failure.

Production verification:

- runtime source: `a0213f05c64f8b1636711e5e3bfdea650f42f2df`;
- Production Identity Evidence #17: run `31757896091`, artifact `9203733363`, PASS;
- Deploy Worker #6: run `31759350109`, SUCCESS;
- deployed version ID: `ea9c129f-6e8f-4071-be36-e22721f82ef8`;
- post-deploy artifact: `9205266306`;
- stable production contract: 3 consecutive PASS after edge propagation;
- Worker 4.08 / API 2.61 / Schema 3;
- no new D1 migration required.

NOW-1B-A is closed. Do not redeploy it unless a later source actually requires deployment.

---

## 5. NOW-1B-B — ACTIVE

PR: **#231 — `NOW-1B: durable record-create intent and invisible recovery`**  
Risk: **R2 Significant** — browser persistence + transaction create/recovery semantics.  
Base when opened: protected main `1bfe2ba728cec8736a30be7298a5b8bfb9693b78`.

### Product contract

```text
one logical create
-> persist owner-bound intent before POST
-> stable random idempotency key + immutable serialized body
-> send rollback-safe compatibility path
-> timeout / network / 5xx may remain ambiguous
-> bounded recovery reuses exact key/body
-> verified success clears replay eligibility before UI refresh
-> one logical trade remains one D1 record
```

### Implemented browser state

- service: `src/services/recordCreateIntent.js`;
- version: 1;
- live recovery TTL: 24 hours;
- intent prefix: `pending_record_create.v1.`;
- mutation barrier: `record_mutation_barrier.v1`;
- storage key has no email/PII;
- stored value is owner-validated and contains the exact serialized create body;
- secure random key/barrier generation;
- persistence is write/read-back verified;
- logout removes barrier and all intent-prefix entries.

### Mutation semantics

- create persists barrier + intent **before** network mutation;
- create sends exactly one normal-call POST to `/api/records/idempotent`;
- 401 refresh recursively reuses the same endpoint/options, preserving key/body;
- verified create success clears the exact intent before `fetchRecords()`;
- a refresh failure after commit remains a committed mutation, never a reason to create again;
- explicit 4xx/409/unsupported 404 become terminal for that intent; no automatic new key and no legacy fallback;
- timeout/network/5xx ambiguity retains the exact live intent;
- recovery is single-flight and bounded once per intent key per store lifetime; reload permits a new bounded attempt if still live;
- later new create rotates the barrier;
- UPDATE/DELETE first supersede an eligible old create intent before sending their own mutation.

### Cross-tab/distributed-ordering boundary

The barrier is a browser replay-eligibility fence. It prevents a superseded **pending** intent from starting a future automatic replay. It does not claim to cancel or reorder a request already dispatched by another tab. Existing server idempotency protects duplicate create dispatches. Do not add a backend tombstone/transaction-ordering subsystem unless production evidence demonstrates that stronger ordering is necessary.

### Verification already obtained

- CI #777 exposed the missing reviewed storage-inventory entry; safety inventory was updated rather than weakened.
- CI #782 was the first run with executable durable-intent service tests in the frontend glob; 212/213 passed and the sole failure was a test-only raw-string assertion against nested JSON storage.
- CI #783 / run `31763766650`: **SUCCESS** on the code-bearing candidate after correcting that test assertion.
- Frontend contracts + executable storage tests + build: PASS.
- Worker security/deployment tests: PASS.
- Python tests/coverage: PASS.

Handoff/document-only commits after the code-bearing CI must still receive fresh exact-head CI before merge. Do not quote CI #783 as exact-head if the PR head has advanced.

---

## 6. NOW-1B-B remaining gates

Execute without asking the user unless GitHub/platform requires owner action:

1. re-fetch PR #231 head/base/main and ensure no unexpected drift;
2. run/wait for exact-current-head full CI after handoff changes;
3. perform R2 independent adversarial review:
   - persist-before-send;
   - exact same key/body on recovery/token refresh;
   - no legacy endpoint fallback;
   - 409/404 terminal without key rotation;
   - ambiguous outcomes retained but no tight retry loop;
   - owner isolation / no PII in storage key;
   - logout cleanup;
   - success clears replay state before record refresh;
   - update/delete supersede eligible older replay before mutation;
   - no Worker/D1/financial/market-data changes;
4. update PR body with exact current head + CI + review result;
5. mark Ready and merge if all gates pass;
6. verify post-main CI;
7. verify production Pages build/deployment for the merge SHA;
8. do **not** create/delete a real-user transaction merely for smoke testing.

Close NOW-1B-B only after post-main CI + Pages are green.

---

## 7. Next product phase — Phase 2 Automatic Recalculation

After NOW-1B-B closure, immediately move to:

```text
confirmed transaction mutation
-> snapshot stale
-> debounce/coalesce dirty generation
-> automatically request calculation
-> durable job poll/recovery
-> fresh snapshot published/read
-> UI refresh
```

Primary UX KPI: **normal add/edit/delete transaction → manual “update portfolio” clicks = 0**.

Requirements:

- do not trigger calculation for a definitely rejected mutation;
- ambiguous transaction mutation must first resolve through the existing mutation/recovery truth before recalculation logic assumes a commit;
- coalesce rapid successive committed mutations;
- if a mutation occurs while calculation is running, retain a dirty generation and run one required follow-up calculation;
- reuse existing durable `calculation_jobs` lifecycle and polling instead of building a second queue;
- preserve all financial validation/reconciliation gates.

---

## 8. Later roadmap

1. Phase 2 — Automatic Recalculation.
2. Phase 3 — Self-healing snapshot lifecycle.
3. Phase 4 — AI failure triage/recovery.
4. Phase 5 — AI Ops Autopilot.
5. Phase 6 — AI UX.

Each phase begins only after the prior user-visible flow is functionally closed. Avoid infrastructure-first expansion.

---

## 9. Historical provenance

The previous long-form handoff was intentionally converged on 2026-08-14 because it mixed closed Gate-E/NOW-1A history with current blockers and could misdirect future agents. Nothing was erased from repository history. For detailed prior evidence use Git history, merged PRs, `docs/engineering/`, `docs/governance/evidence/` and workflow artifacts.

The purpose of this file is to answer one question accurately: **what should the next AI do now without breaking the product?**
