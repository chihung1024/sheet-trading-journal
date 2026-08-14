# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **PR #247 CLOSED / PRODUCTION PAGES VERIFIED — snapshot freshness API/manifest record-contract root cause fixed; no runtime batch active; user browser symptom recheck is the next evidence point**

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
| Three user-reported product defects | CLOSED / PARTIALLY SUPERSEDED | PR #245 `112c9b7b0d93ea49547f3cd005f4a5024f152bd5`; layout + TWR remain closed; stale-snapshot item was reopened by new production evidence and superseded by PR #247 |
| Snapshot freshness API/manifest record contract | **CLOSED / PRODUCTION PAGES VERIFIED** | PR #247 merged as `cc51ebc2b0f020e23c2efbf2cdcb7c2102c7d0a9`; final PR CI #871, post-main CI #872 + Pages #1530 SUCCESS; Independent Review Gate PASS |

Do not reopen closed phases without new material evidence.

---

## 2. Project Status / Stable State

Current verified runtime merge checkpoint:

`cc51ebc2b0f020e23c2efbf2cdcb7c2102c7d0a9`

- PR #247 is merged and its frontend runtime is deployed through Pages production deployment #1530.
- Exact merge-SHA post-main CI #872 / run `31801023106`: **SUCCESS**.
- Exact merge-SHA Pages #1530 / run `31801022403`: **SUCCESS**.
- Production Worker remains release `4.08`, API `2.61`, schema `3`; PR #247 changed no Worker source, D1 schema/migration, or Python financial methodology, so no Worker deployment was required.
- The reproduced backend calculation path itself was already healthy: production `Update Portfolio Data` run #3276 completed record fetch, financial calculation, snapshot upload, and terminal `succeeded` callback. PR #247 fixes the browser-side false-negative freshness verification after successful publication.
- Recovery point for the runtime batch was branch `fix/snapshot-integrity-record-contract`, created from `main@c1acaa2039eecca301440e8b26fa065a2d61c36d`.
- Rollback remains a normal revert of PR #247 / merge `cc51ebc2...`; no schema or data rollback is required.

Stable product invariants remain:

```text
record create durable intent
→ rollback-safe idempotent endpoint
→ mutation commit/readback
→ durable dirty generation
→ calculation job lifecycle
→ snapshot publication
→ browser source/benchmark integrity verification
→ bounded self-healing only when integrity evidence proves repair is safe
```

### User-facing verification boundary

Repository, CI, and Pages deployment are verified. An actual already-open browser tab can still be running the pre-deploy JavaScript bundle until reload. The next useful product evidence is therefore a normal browser reload followed by observation of a fresh snapshot / next calculation cycle. If the stale pill/banner still persists after the deployed bundle is loaded, reopen from that new evidence instead of adding speculative retry logic.

---

## 3. Closed Batch — PR #247 Snapshot Integrity Record Contract

### Primary Goal — SATISFIED BY CODE/DEPLOYMENT EVIDENCE

Every legal transaction set returned by the real Worker `/api/records` contract is now canonicalized through the same API→calculation field boundary used by Python before comparison with `calculation_manifest`. A matching source/benchmark can converge to verified/non-stale state; true mismatches and malformed/unknown contracts remain fail-closed.

### Scope completed

Runtime:

- `src/services/snapshotIntegrity.js`

Regression:

- `tests/frontend_snapshot_integrity.test.mjs`
- `tests/frontend_snapshot_self_healing.test.mjs`
- `tests/frontend_user_reported_product_defects.test.mjs`

Handoff:

- `to_do_update_list.md`

Explicitly unchanged:

- Worker API/auth
- D1 schema/migrations/data
- Python financial calculations / manifest methodology
- retry/timer policy
- `portfolio.js` orchestration
- UI copy/components
- production Worker deployment architecture

---

## 4. Root Cause Log

### 2026-08-14 — Snapshot remains stale after successful calculation

**Symptom**  
User observed both `快照待重算` and `持倉與績效快照待重新計算` after a calculation job completed successfully.

**Reproduce / Evidence**

- Production calculation run #3276 succeeded end-to-end, including snapshot upload and terminal `succeeded` callback.
- Worker `/api/records` returns the persisted API/D1 field contract: `txn_date`, `symbol`, `txn_type`, `qty`, `price`, `fee`, `tax`, `tag`.
- Browser pagination passes those record objects into Pinia without converting field names.
- Python `prepare_transactions()` explicitly converts that API schema to `Date`, `Symbol`, `Type`, `Qty`, `Price`, `Commission`, `Tax`, `Tag` before building deterministic source-record identity.
- Pre-PR-247 `snapshotIntegrity.js` skipped that boundary and read browser records directly as the Python field names.

**Failure Point**  
`buildSourceRecordsIdentity(records)` could not construct a valid canonical projection from real Worker records; `assessSnapshotIntegrity()` therefore classified legitimate production records as `UNVERIFIABLE_RECORDS`. Snapshot self-healing correctly treated that as fail-closed and called `markSnapshotStale()`.

**Contributing Factor**  
PR #245 fixed a separate real post-terminal/full-read scheduling race, but its regression fixtures used calculation-schema records (`Date`, `Symbol`, etc.) rather than the actual Worker API record shape. The lifecycle test therefore passed while the schema-boundary defect remained invisible.

**Root Cause**  
The browser integrity layer independently implemented Python manifest canonicalization but omitted the API-record → calculation-record normalization boundary used by the authoritative Python engine.

**Systemic Cause**  
The same source-record contract existed across Worker/API, Python preprocessing, frontend integrity logic, and tests without a regression that fed the real Worker API shape through the browser canonicalizer and compared it with the established Python canonical SHA fixture.

**Impact Analysis**

- No evidence of D1 data corruption or incorrect Python financial calculation.
- A correctly published snapshot could be falsely marked stale in the browser.
- Re-triggering calculation could not permanently solve the defect because the same frontend integrity check rejected the next correct snapshot again.
- The warning was truthful relative to frontend verification state, but that verification state was wrong.

**Permanent Fix**

- Added an explicit internal schema-boundary adapter in `snapshotIntegrity.js` matching Python `prepare_transactions()` field normalization.
- Preserved calculation-schema input for the existing pure manifest projection contract/tests.
- Mixed API/calculation schema objects are rejected as ambiguous and fail-closed.
- Optional API `fee`, `tax`, and `tag` use Python-compatible defaults.
- Regression coverage now uses real Worker API-shaped records across identity, self-healing, and the user-reported terminal-success lifecycle.
- No stale state is force-cleared; successful job status alone never proves freshness.

**Prevention**

The regression suite now requires:

1. Worker API shape and calculation shape produce the same source projection;
2. both produce the exact pre-existing Python canonical SHA fixture;
3. symbol/type trim + uppercase normalization remains stable;
4. non-manifest fields such as `user_id` / `note` do not affect identity;
5. matching API records classify as `FRESH`;
6. true record edits remain `STALE_SOURCE`;
7. malformed or mixed schemas remain fail-closed;
8. fresh proof does not invoke self-healing repair.

---

## 5. Change Log / Verification

### PR #247

Implementation branch: `fix/snapshot-integrity-record-contract`  
Final PR head: `09486cfb4a9422a070d17ae8a2a8943c7f41159f`  
Main merge: `cc51ebc2b0f020e23c2efbf2cdcb7c2102c7d0a9`

Verification:

- targeted canonical SHA/integrity regression: PASS;
- code-head CI #870 / `31800319339`: SUCCESS;
- final exact-head PR CI #871 / `31800465725`: **SUCCESS**;
- Python tests + branch coverage: PASS;
- frontend contracts + production build: PASS;
- Worker security/deployment tests: PASS;
- Worker config / Recovery Evidence Gate / local D1 schema: PASS;
- independent frozen-diff review on exact head: **PASS**;
  - BLOCKER: 0;
  - FOLLOW-UP: 0;
  - BACKLOG: 1 — if the source-record/API/manifest contract materially versions in the future, consider generated/versioned cross-language mapping instead of duplicated mapping;
- post-main exact merge-SHA CI #872 / `31801023106`: **SUCCESS**;
- Pages production deployment #1530 / `31801022403`: **SUCCESS**.

### Merge-method note

The intended squash merge was attempted twice against exact PR head `09486cf...`; GitHub's canonical merge mutation endpoint returned HTTP 405 `Squash merges are not allowed on this repository` both times. Repository merge policy was **not** modified or bypassed. A normal exact-head `merge` was then used, consistent with existing repository history, producing `cc51ebc2...`.

### Deployment

- Frontend Pages: **DEPLOYED / VERIFIED**.
- Production Worker: **NOT REQUIRED / NOT DEPLOYED**.
- D1 migration: **NOT REQUIRED / NOT RUN**.
- User browser symptom recheck after loading the new frontend bundle: **NOT YET DIRECTLY OBSERVED BY THE AUTOMATED REPOSITORY GATES**.

Rollback:

- revert PR #247 / merge `cc51ebc2...` if a regression is observed;
- no schema/data migration rollback is required.

---

## 6. Decision Log

### D-2026-08-14-01 — Fix the schema boundary, not the stale UI symptom

- **Evidence:** successful backend calculation/publication plus deterministic frontend `UNVERIFIABLE_RECORDS` path.
- **Alternatives rejected:** force `snapshotFreshness` to fresh; hide warning after `succeeded`; add another calculation retry; change Worker API field names; change Python manifest format.
- **Reason:** those alternatives either conceal unverifiable data or broaden impact without addressing the mismatched contract.
- **Trade-off:** frontend accepts two explicit source input shapes at the canonicalization boundary (real API shape and calculation projection shape) and rejects mixed objects.
- **Status:** CLOSED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** fresh production evidence proves another valid Worker record shape or manifest contract that is not represented by this boundary, or the user reproduces the stale state after loading the deployed frontend bundle.

### D-2026-08-14-02 — Keep fail-closed integrity semantics

A successful job status alone is not proof that the displayed snapshot matches current records. Freshness still requires source SHA/count/max-id and benchmark agreement. Job success must never directly clear the stale warning.

Status: **LOCKED**.

---

## 7. Known Issues / Risks / Technical Debt

### Current risk

Cross-layer canonicalization could drift if Worker/Python field contracts materially change in the future. The API-shaped SHA parity tests reduce this risk; versioning discipline remains required.

### Known non-blocking documentation/status drift

- `docs/DEPLOYMENT.md` historical/current-live text can lag remote deployment truth; deployment methodology remains authoritative but live identity must be revalidated from Actions/contracts.
- Issue #97 contains historical staging status wording and is not a blocker for current product functionality.

### Technical Debt / Deferred Candidates

Do not promote without new evidence:

1. generalized UPDATE / DELETE outcome-ambiguity durable intents;
2. calculation polling beyond 20 minutes;
3. broad cross-group dividend pending filtering;
4. broad `portfolio.js` refactor;
5. Worker/D1 changes for the closed snapshot incident;
6. generated/versioned cross-language source-record mapping contract before an actual contract-version change.

---

## 8. NOW / NEXT / BACKLOG / REJECT

**NOW**

- no runtime implementation batch active;
- obtain the next direct user-facing evidence by loading the deployed frontend and observing whether the stale pill/banner converges away for a matching snapshot / next calculation cycle.

**NEXT**

- if user verification passes: return to evidence-driven product / UX audit;
- if user verification fails: reopen this incident from fresh browser + current production evidence, classify the newly observed failure point, and do not assume the same root cause.

**BACKLOG**

- documentation/status hygiene listed above;
- generated/versioned cross-language mapping only if a future schema/version change justifies it;
- unrelated deferred product candidates already reviewed.

**REJECT**

- force-clearing stale state because the job says `succeeded`;
- adding retries to mask integrity verification failure;
- changing Worker/D1/Python for this incident without new evidence;
- broad refactor during incident closeout.

---

## 9. Next Actions

1. User/browser loads the newly deployed frontend bundle (reload current tab if it predates Pages #1530).
2. Observe current matching snapshot or the next normal calculation completion.
3. Expected state: no `快照待重算` top pill and no `持倉與績效快照待重新計算` banner once source/benchmark identity matches.
4. If the warning remains, capture fresh evidence and reopen Root Cause investigation from the current deployed code; do not add speculative retries or force freshness.
5. Otherwise mark the user-facing symptom externally confirmed and resume the next product/UX evidence-driven batch.
