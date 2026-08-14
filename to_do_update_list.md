# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **User-reported product defect batch ACTIVE on PR #245; runtime code frozen pending docs-bearing CI / merge gates**

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

Do not reopen closed phases without new material evidence.

---

## 2. Current production baseline before active PR #245

Protected `main`:

`f00c5616a1d9eca819e6c7cccda181fe6be322e8`

PR #244 is merged/closed and production-active on Pages.

No runtime feature/recovery batch was active before the user reported the three defects below.

---

## 3. ACTIVE — PR #245 user-reported product defects

Branch:

`fix/product-audit-three-user-defects`

Draft PR:

`#245 — fix: close stale snapshot, desktop overlap, and TWR baseline defects`

### A. Successful backend calculation but snapshot remains stale

Production evidence:

- `Update Portfolio Data #3275` / run `31792620418` SUCCESS on production main;
- calculation/upload and result-reporting both succeeded;
- UI nevertheless could remain in `持倉與績效快照待重新計算`.

Root cause class:

- Phase 3 may create a newer durable dirty generation while the successful calculation/fresh-read lifecycle is still unwinding;
- a loaded transition during in-flight snapshot reconciliation could be coalesced away;
- the new dirty token could therefore miss a later lifecycle edge that re-offers it to Phase 2.

Fix:

- preserve loaded rerun requests during in-flight reconciliation;
- one bounded post-success full-read handoff per same-owner dirty token when stale state is still proven;
- re-enter existing `fetchAll()` only; Phase 2 remains calculation scheduler;
- do not hide or forcibly clear stale state.

### B. Desktop right transaction panel overlaps banners/notices

Root cause class:

- panel was `position: fixed` to viewport even though its aside belongs to the workspace grid;
- content above the grid could not push it down.

Fix:

- desktop panel becomes grid-flow `position: sticky`;
- width derives from the grid rail rather than a second hardcoded viewport geometry;
- relevant horizontal overflow uses `clip` so sticky semantics remain viewport-based;
- mobile fixed sheet remains unchanged.

### C. TWR strategy and benchmark start from different dates

Root cause class:

- benchmark was independently rebased from the selected baseline row;
- strategy correctly stayed null until reliable TWR existed;
- benchmark could therefore start earlier than strategy.

Fix:

- shared first common reliable strategy + finite benchmark anchor;
- both series start from that same date and are rebased to 0%;
- benchmark does not extend through a later unreliable strategy interval;
- missing benchmark values fail closed and are never coerced from `null` to numeric zero;
- Python TWR / financial methodology unchanged.

### Code-bearing verification

Code-bearing head before permanent docs:

`7ebba7c0e6a6b3344dee9abce1bb20b5cfbdf61c`

CI #862 / run `31795590198`: **SUCCESS** across Frontend contracts/build, Worker/D1 tests and Python tests/coverage.

Independent R2 review: **PASS / 0 BLOCKER**.

Permanent engineering handoff:

`docs/engineering/PRODUCT_AUDIT_THREE_USER_DEFECTS_2026-08-14.md`

### Remaining closure gates

1. obtain latest docs-bearing head;
2. confirm final compare against protected `main`, `behind_by=0`, expected code/tests/docs only;
3. require fresh exact-head full CI SUCCESS;
4. update PR #245 final evidence and keep R2 PASS / 0 blocker;
5. mark Ready;
6. ordinary merge with expected head SHA;
7. require post-main CI SUCCESS and Pages build/report/deploy SUCCESS for exact merge SHA;
8. no Worker deployment or D1 migration expected.

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

## 5. Deferred / evidence-gated candidates

Do not promote without new material evidence:

1. generalized UPDATE / DELETE outcome-ambiguity durable intents;
2. calculation polling beyond 20 minutes;
3. broad cross-group dividend pending filtering;
4. staging Worker/D1 issue #97 unless required to deliver a concrete product change safely or explicitly reprioritized.

---

## 6. Repository hygiene

Old Draft PRs #225/#227 and completed issue #79 are closed. Zero-diff abandoned branches are nonfunctional hygiene only; remove through a supported branch-delete path when convenient and never block product work for them.
