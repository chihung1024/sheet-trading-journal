# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **PR #245 three user-reported defects CLOSED / PRODUCTION PAGES VERIFIED → no runtime batch active; resume evidence-driven product / UX audit**

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
| Record-create recovery UI completion | CLOSED / PRODUCTION PAGES VERIFIED | PR #242 `268a7b31c1354da67857c910b7dbea7f4d602112`; final PR CI #854, post-main CI #855 + Pages #1525 SUCCESS |
| Phase 5 closure handoff | CLOSED | PR #243 `74351c863bcceb061a10d85ed673f6611d2e1faa`; post-main CI #857 + Pages #1526 SUCCESS |
| Restored-session read recovery copy | CLOSED / PRODUCTION PAGES VERIFIED | PR #244 `f00c5616a1d9eca819e6c7cccda181fe6be322e8`; final PR CI #858, post-main CI #859 + Pages #1527 SUCCESS |
| Three user-reported product defects | **CLOSED / PRODUCTION PAGES VERIFIED** | PR #245 `112c9b7b0d93ea49547f3cd005f4a5024f152bd5`; final PR CI #864, post-main CI #865 + Pages #1528 SUCCESS |

Do not reopen closed phases without new material evidence.

---

## 2. Current production baseline

Protected `main` after PR #245:

`112c9b7b0d93ea49547f3cd005f4a5024f152bd5`

PR #245 is merged/closed and production-active on Pages.

There is currently **no runtime feature batch active**.

Permanent engineering handoff for the latest product defect batch:

`docs/engineering/PRODUCT_AUDIT_THREE_USER_DEFECTS_2026-08-14.md`

### Closed behavior from PR #245

1. **Snapshot stale after successful calculation**
   - a loaded transition arriving during in-flight snapshot reconciliation is not lost;
   - if a successful calculation is followed by a still-proven stale snapshot and same-owner durable dirty generation, one bounded full-read lifecycle handoff re-offers that generation to existing Phase 2 scheduling;
   - stale state is never hidden or force-cleared.

2. **Desktop trade-panel overlap**
   - desktop transaction rail participates in the workspace grid and uses sticky positioning rather than viewport-fixed positioning;
   - banners/notices above the grid can push the rail down naturally;
   - mobile fixed-sheet behavior is unchanged.

3. **TWR / benchmark mismatched starting point**
   - comparison begins at the first common reliable strategy + finite benchmark row;
   - both series are rebased to 0% on the same date;
   - benchmark does not extend through unreliable strategy intervals;
   - missing benchmark values fail closed instead of being coerced to zero;
   - Python/financial methodology is unchanged.

---

## 3. ACTIVE STATE — evidence-driven product / UX audit

This is an audit state, not permission for a broad refactor.

Select the next product batch only from:

- a reproducible user-facing defect;
- production logs/jobs showing a repeated failure class;
- a current open product issue whose acceptance is not already implemented;
- a measurable normal-use path requiring unnecessary user actions that the existing automation lifecycle cannot already recover.

Before writing code, verify the candidate against current `main` and existing tests so old roadmap items are not reimplemented.

### Already reviewed and intentionally not promoted without new evidence

1. **Generalized UPDATE / DELETE outcome-ambiguity durable intents**
   - technically possible, but would expand mutation authority;
   - do not implement without real user/production evidence.

2. **Calculation polling beyond 20 minutes**
   - observed normal update runs complete far below the current limit;
   - do not add long-running polling machinery for a theoretical case.

3. **Broad cross-group dividend pending filtering**
   - Python already derives confirmed DIV state authoritatively;
   - frontend global symbol/date filtering risks incorrect group semantics.

4. **Staging Worker/D1 issue #97**
   - infrastructure, not current user-facing functionality;
   - keep deferred unless needed to deliver a concrete product change safely or explicitly reprioritized.

---

## 4. Product automation invariants to preserve

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

Never weaken:

- D1 transaction truth;
- same-key idempotency semantics;
- mutation-barrier supersede rules;
- owner isolation;
- deterministic financial validation/reconciliation;
- fail-closed handling of unknown or correctness failures.

---

## 5. Repository hygiene

Old Draft PRs #225/#227 and completed issue #79 are closed. Zero-diff abandoned branches are nonfunctional hygiene only; remove through a supported branch-delete path when convenient and never block product work for them.
