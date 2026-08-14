# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 5 automation chain CLOSED → product/UX evidence audit; no runtime feature batch is active**

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
| Phase 5 same-page record-create ambiguity reconciliation | **CLOSED / PRODUCTION PAGES VERIFIED** | PR #239 merge `b45505dc9d532ea076d9fcebabd65ef65e39c312`; post-main CI #842 + Pages #1522 SUCCESS |

Do not reopen closed phases without new material evidence.

---

## 2. Current remote truth

Protected `main` after Phase 5 closure:

`b45505dc9d532ea076d9fcebabd65ef65e39c312`

PR #239 is merged/closed. Its same-page ambiguous CREATE reconciliation is production-active on Pages.

Old documentation-only Draft PRs #225 and #227 were closed without merge because later NOW-1B / production evidence superseded their blocker narrative.

Issue #79 (deterministic JWT expiry / refresh scheduling) was re-audited against current code and closed as **completed**: shared `jwtClaims.js`, immediate token watcher, bounded monitor and overlap guards are already present.

No open product PR remains at this handoff.

---

## 3. ACTIVE — product / UX evidence audit

This is an audit state, not permission to create a broad refactor.

### Findings already checked and intentionally **not** promoted to runtime work

1. **20-minute calculation polling limit**
   - recent `Update Portfolio Data` runs complete far below the limit (latest observed normal run about tens of seconds);
   - no evidence supports adding longer/background polling machinery.

2. **UPDATE / DELETE outcome ambiguity**
   - deterministic readback reconciliation is architecturally possible, but would require a new mutation descriptor/durable intent surface;
   - do not expand into generalized mutation-idempotency without production/user evidence.

3. **Dividend pending state across devices**
   - Python authoritative calculation already derives `confirmed_dividends` from DIV records and removes confirmed events from new snapshots;
   - global frontend `symbol+date` filtering could be wrong across strategy groups/tags;
   - do not add a broader rule without a reproducible group-aware defect.

4. **Old manual fallback copy**
   - several messages still say “手動刷新 / 手動更新” even though Phase 4/5 recovery now covers the underlying failure path;
   - treat as low-risk presentation cleanup, not a new recovery architecture.

### Next product batch selection rule

Choose the next runtime batch only from one of these evidence sources:

- a reproducible user-facing defect;
- a current open product issue whose acceptance is not already implemented;
- production logs/jobs showing a repeated failure class;
- a measurable UX path with unnecessary actions that the existing lifecycle cannot already recover automatically.

Before writing code, verify the candidate against current `main` and existing tests so old roadmap items are not reimplemented.

---

## 4. Open roadmap item intentionally deferred

Issue #97 — staging Worker/D1 deployment contract — remains open, but it is **infrastructure**, not current product functionality.

Do not promote #97 ahead of user-facing work unless staging becomes necessary to safely deliver a concrete product change or the owner explicitly reprioritizes it.

---

## 5. Product automation invariants to preserve

Current normal mutation/recovery chain:

```text
record create durable intent
→ rollback-safe idempotent endpoint
→ mutation commit/readback
→ Phase 2 dirty generation
→ calculation job lifecycle
→ bounded terminal-failure recovery
→ trigger ambiguity same-key confirmation
→ snapshot integrity/self-healing
→ bounded read self-recovery
→ same-page ambiguous CREATE reconciliation
```

Never weaken:

- D1 transaction truth;
- same-key idempotency semantics;
- mutation barrier supersede rules;
- deterministic finance validation/reconciliation;
- exact owner isolation;
- fail-closed handling of unknown/deterministic correctness failures.

---

## 6. Repository hygiene

Zero-diff exploratory branches such as `tmp-do-not-create` or other abandoned zero-diff branches are nonfunctional hygiene only. Remove through a supported branch-delete path when convenient; never block product work for this cleanup.
