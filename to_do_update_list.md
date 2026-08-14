# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 5 record-create UI completion — permanent handoff complete → final docs-bearing CI / merge / post-main closure**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Fix generic root causes; parallel investigation must converge.
3. Financial/data correctness is fail-closed.
4. Keep one primary active batch.
5. R2+ work requires exact-head CI, rollback/recovery, independent review and permanent handoff.
6. Prefer invisible deterministic automation; **AI 管流程，不管帳**.
7. Do not create infrastructure or retry machinery for theoretical edge cases without production/user evidence.

---

## 1. Closed product automation chain

| Area | State | Closure evidence |
|---|---|---|
| Market-data malformed-row incident | CLOSED / PRODUCTION VERIFIED | passive watch only |
| NOW-1B-A rollback-safe record-create transport | CLOSED / PRODUCTION VERIFIED | `/api/records/idempotent` live |
| NOW-1B-B durable record-create intent | CLOSED | PR #231 `e7c94adc...`; CI #791 + Pages #1514 |
| Phase 2 Automatic Recalculation | CLOSED | PR #232 `a458966...`; CI #799 + Pages #1515 |
| Phase 3 Self-healing Snapshot | CLOSED | PR #233 `5706cb7463ad1e6e433ca9e852ff728ba0cc9c0e`; CI #807 + Pages #1516 |
| Phase 4 terminal calculation failure recovery | CLOSED | PR #234 `3ed4711af539b7d60657adbec177607014b7a0e4`; CI #818 + Pages #1517 |
| Phase 4 trigger outcome ambiguity replay | CLOSED | PR #235 `b8d412559ef684bfb2b9197480898f140a92bd43`; CI #823 + Pages #1518 |
| Phase 5 bounded data-read self-recovery | CLOSED | PR #236 `80abac173a5b5a5c75c5420af11d92480407180b`; CI #825 + Pages #1519 |
| Phase 5 GroupManager batch mutation lifecycle | CLOSED | PR #237 `98b2f2e1c765d020065a7b0493a304042455bf71`; CI #832 + Pages #1520 |
| Phase 5 dirty standalone record readback recovery | CLOSED | PR #238 `0cd9353232b26924d509fa75f5bc45ead24cb10c`; CI #838 + Pages #1521 |
| Phase 5 same-page record-create ambiguity reconciliation | CLOSED / PRODUCTION PAGES VERIFIED | PR #239 `b45505dc9d532ea076d9fcebabd65ef65e39c312`; CI #842 + Pages #1522 |
| Product handoff convergence | CLOSED | PR #240 `4a4fa7c753b7b0e38c9eeaf44eeaab0d928d9120`; CI #844 + Pages #1523 |
| Recovery-copy UX convergence | CLOSED / PRODUCTION PAGES VERIFIED | PR #241 `d80f10394d5fe7d325d96b1c9802139c22711498`; CI #848 + Pages #1524 |

Do not reopen closed phases without new material evidence.

---

## 2. ACTIVE — Phase 5 record-create UI completion

PR: **#242 — `Phase 5: complete recovered record create in current UI`**  
Branch: `feat/phase5-record-create-ui-completion-v2`  
Base: protected main `d80f10394d5fe7d325d96b1c9802139c22711498`  
Risk: **R2 Significant**.

Permanent engineering handoff:

`docs/engineering/PHASE5_RECORD_CREATE_UI_COMPLETION_2026-08-14.md`

### Root cause

PR #239 safely reconciles an outcome-ambiguous CREATE by replaying the original durable intent with the same Idempotency-Key. The remaining UX gap was that the current caller UI did not receive the authoritative replay-success result.

That could leave:

- TradeForm still showing the original unresolved transaction after it had been confirmed by the server;
- DividendManager still showing a stale pending dividend until later snapshot/read convergence.

This slice does **not** add another retry or permanent payload dedupe. It completes the current UI only after the existing same-key recovery has received `json.success`.

### Final design

1. `src/services/recordCreateRecoverySignal.js`
   - memory-only publish/subscribe;
   - event contains normalized owner + exact serialized durable body + timestamp;
   - frozen event;
   - listener exceptions isolated;
   - no storage/backend authority.

2. `src/stores/portfolio.js`
   - only `recoverPendingRecordCreateIntent()` publishes;
   - publication occurs after server replay success and existing snapshot/dirty state transition;
   - no event for ambiguity, rejection, supersede or normal initial CREATE.

3. `src/components/TradeForm.vue`
   - uses one shared `buildRecordPayload()` normalization for submit and recovery comparison;
   - remembers exact unresolved CREATE body;
   - requires same owner + same event body + current form still equal to recovered body before reset;
   - if user has edited the form, new input is preserved;
   - reset/edit mode clears stale unresolved marker;
   - recovery success may emit the existing `submitted` UI event only after all guards pass.

4. `src/components/DividendManager.vue`
   - same-owner only;
   - only `txn_type=DIV` + `tag=Auto-Dividend`;
   - must match a currently visible pending symbol/date;
   - marks presentation state confirmed only;
   - never performs another mutation, trigger or fetch from the recovery listener.

### Explicit safety boundary

The raw Idempotency-Key is not exposed to UI components.

Exact body correlation is only a same-page UI correlation mechanism. PR #239 already blocks a second same-payload logical CREATE while reconciliation is active. Intentionally identical future transactions remain legal once that bounded episode is over.

No cross-tab completion event is added; other tabs continue to converge through authoritative records/snapshot lifecycle.

---

## 3. Code-bearing verification

Initial code-bearing CI #851 / run `31784585348` found one stale TradeForm source-contract test. Worker/Python were healthy.

RCA: the old test required exactly one `emit('submitted')` in the entire component and assumed `setupForm` was directly adjacent to `defineExpose`. The new feature intentionally adds a second allowed completion point after authoritative recovery success.

The test was replaced with a stricter two-path contract:

- immediate committed mutation;
- recovered CREATE after owner/body/current-form equality guards.

Latest code-bearing exact head before permanent docs:

`d2924a2e6eeb79b26cb41f54591c84b2fcf6f966`

CI #852 / run `31784727933`: **SUCCESS**

- Frontend contracts/build: SUCCESS
- Worker security/deployment/local D1: SUCCESS
- Python tests/coverage: SUCCESS

Code-bearing scope before docs: exactly six files:

- `src/components/DividendManager.vue`
- `src/components/TradeForm.vue`
- `src/services/recordCreateRecoverySignal.js`
- `src/stores/portfolio.js`
- `tests/frontend_record_create_recovery_signal.test.mjs`
- `tests/frontend_trade_form.test.mjs`

Independent R2 review: **PASS / 0 BLOCKER**.

Permanent docs advance the branch head, so CI #852 is **not** the final merge gate.

---

## 4. Exact remaining gates

Do autonomously unless GitHub/platform genuinely requires owner action:

1. re-fetch PR #242 latest docs-bearing head;
2. require fresh full CI on that exact head;
3. compare against protected `main` and require `behind_by=0`;
4. expected final scope is exactly eight files:
   - the six code/test files listed above;
   - `docs/engineering/PHASE5_RECORD_CREATE_UI_COMPLETION_2026-08-14.md`;
   - this file;
5. final R2 review must confirm:
   - server-success recovery is the sole event publisher;
   - ambiguity/rejection/supersede cannot fabricate success;
   - TradeForm cannot erase changed/new user input;
   - edit/reset invalidates old markers;
   - DividendManager is same-owner + visible `Auto-Dividend` only;
   - no recovery listener performs mutation/trigger/fetch;
   - no permanent payload dedupe, storage, Worker, D1, Python, finance or auth drift;
6. update PR #242 body with final exact head / CI / scope / review;
7. mark Ready;
8. ordinary merge with expected head SHA;
9. require post-main CI SUCCESS;
10. require production Pages build/report/deploy SUCCESS;
11. no Worker deploy expected;
12. no real-user ledger mutation solely for smoke testing.

Only then mark this slice CLOSED.

---

## 5. Product audit after #242

After #242 closes, return to evidence-driven product/UX audit. Do not immediately create another recovery layer.

Already reviewed and intentionally not promoted without new evidence:

- generalized UPDATE/DELETE durable ambiguity intents;
- >20 minute calculation polling extensions;
- broad cross-group dividend pending filters;
- staging infrastructure issue #97.

Choose the next runtime batch only from reproducible user-facing defects, production evidence or measurable unnecessary user actions not already handled by the current lifecycle.

---

## 6. Product automation invariants to preserve

```text
record create durable intent
→ rollback-safe idempotent endpoint
→ same-page ambiguity reconciliation
→ authoritative recovery-success UI completion
→ mutation commit/readback
→ Phase 2 dirty generation
→ calculation job lifecycle
→ bounded terminal-failure recovery
→ trigger ambiguity same-key confirmation
→ snapshot integrity/self-healing
→ bounded read self-recovery
```

Never weaken D1 truth, same-key semantics, mutation barriers, owner isolation, deterministic finance gates or fail-closed correctness handling.

---

## 7. Repository hygiene

Zero-diff abandoned branches are nonfunctional hygiene only. Remove through a supported branch-delete path when convenient; never block product work for this cleanup.
