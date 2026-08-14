# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **PR #247 ACTIVE — snapshot freshness API/manifest record-contract root-cause fix; code head CI #870 SUCCESS; final PR gates pending**

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
| Three user-reported product defects | **PARTIAL REOPEN — stale-snapshot item only** | PR #245 `112c9b7b0d93ea49547f3cd005f4a5024f152bd5`; layout + TWR fixes remain CLOSED; new production evidence reopened stale-snapshot root cause in PR #247 |

Do not reopen other closed phases without new material evidence.

---

## 2. Project Status / Stable State

Current protected `main` before PR #247:

`c1acaa2039eecca301440e8b26fa065a2d61c36d`

- PR #246 advanced `main` with handoff/documentation only; no new Worker/D1/Python runtime contract was introduced.
- Production Worker remains release `4.08`, API `2.61`, schema `3`; PR #247 does not change Worker, D1, migrations, or Python calculation methodology.
- Latest reproduced calculation path itself is healthy: production `Update Portfolio Data` run #3276 completed record fetch, financial calculation, snapshot upload, and terminal `succeeded` callback. The defect is browser-side freshness verification after that successful publication.
- Recovery point for the active batch: branch `fix/snapshot-integrity-record-contract`, created from exact `main@c1acaa2039eecca301440e8b26fa065a2d61c36d`.

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

---

## 3. Current Phase / Batch — PR #247 Snapshot Integrity Record Contract

### Primary Goal

After a successful calculation publishes a snapshot, every legal transaction set returned by the real Worker `/api/records` contract must be canonicalized exactly like Python before comparison with `calculation_manifest`. A genuinely matching snapshot must converge to verified/non-stale UI state; true data/benchmark mismatches and malformed/unknown contracts must remain fail-closed.

### In Scope

- `src/services/snapshotIntegrity.js`
- real Worker API-shaped snapshot-integrity regression fixtures
- snapshot self-healing regression coverage
- the original user-reported stale-after-success lifecycle regression
- handoff / root-cause documentation

### Out of Scope

- Worker API or authorization changes
- D1 schema/migrations
- Python financial calculations or manifest methodology
- extra retry loops or timers
- forcing/hiding stale UI state
- `portfolio.js` refactor
- deployment architecture changes

### Allowed Investigation

Trace only the established path:

```text
successful calculation job
→ snapshot upload
→ terminal callback
→ fetchAll / records + settings + snapshot
→ snapshotIntegrity
→ snapshotSelfHealing
→ snapshotFreshness / reliability UI
```

### Expansion Trigger

Expand only if final tests show the Worker API projection still cannot reproduce the Python source-record identity, or if a fresh production snapshot after deployment still proves a different mismatch. Do not add retries/UI special cases as a substitute.

---

## 4. Root Cause Log

### 2026-08-14 — Snapshot remains stale after successful calculation

**Symptom**  
User observed both `快照待重算` and `持倉與績效快照待重新計算` after a calculation job completed successfully.

**Reproduce / Evidence**

- Production calculation run #3276 succeeded end-to-end, including snapshot upload and terminal `succeeded` callback.
- Worker `/api/records` returns the persisted API/D1 field contract: `txn_date`, `symbol`, `txn_type`, `qty`, `price`, `fee`, `tax`, `tag`.
- Browser pagination passes those record objects into Pinia without converting field names.
- Python `prepare_transactions()` explicitly converts that API schema to `Date`, `Symbol`, `Type`, `Qty`, `Price`, `Commission`, `Tax`, `Tag` before building the deterministic source-record manifest.
- Pre-PR-247 `snapshotIntegrity.js` skipped that boundary and read browser records directly as the Python field names.

**Failure Point**  
`buildSourceRecordsIdentity(records)` could not construct a valid canonical projection from real Worker records; `assessSnapshotIntegrity()` therefore classified legitimate production records as `UNVERIFIABLE_RECORDS`. Snapshot self-healing correctly treated that as fail-closed and called `markSnapshotStale()`.

**Contributing Factor**  
PR #245 fixed a real post-terminal/full-read scheduling race, but its regression fixtures used calculation-schema records (`Date`, `Symbol`, etc.) rather than the actual Worker API record shape. The lifecycle test therefore passed while the production schema-boundary defect remained invisible.

**Root Cause**  
The browser integrity layer independently implemented Python manifest canonicalization but omitted the API-record → calculation-record normalization boundary used by the authoritative Python engine.

**Systemic Cause**  
The same cross-layer source-record contract existed in Worker/API, Python preprocessing, frontend integrity logic, and tests without a regression that fed the real Worker API shape through the browser canonicalizer and compared it against the existing Python canonical SHA fixture.

**Impact Analysis**

- No evidence of D1 data corruption or incorrect Python financial calculation.
- A correctly published snapshot could be falsely marked stale in the browser.
- Re-triggering calculation could not permanently solve it because the same frontend integrity check would reject the next correct snapshot again.
- The stale warning was therefore truthful relative to frontend verification state, but the verification state itself was wrong.

**Permanent Fix**

- Add an explicit schema-boundary adapter inside `snapshotIntegrity.js` matching Python `prepare_transactions()` field normalization.
- Preserve the existing calculation-schema input only for the pure manifest projection contract/tests.
- Reject mixed API/calculation schema objects as ambiguous and fail-closed.
- Preserve Python-compatible defaults for optional API `fee`, `tax`, and `tag`.
- Exercise real Worker API-shaped records across integrity, self-healing, and the user-reported lifecycle regression.
- Keep the adapter internal; do not expand frontend public API solely for testing.

**Prevention**

The regression suite now requires:

1. Worker API shape and calculation shape produce the same source projection;
2. both produce the exact pre-existing Python canonical SHA fixture;
3. symbol/type trim + uppercase normalization remains stable;
4. non-manifest fields such as `user_id` / `note` do not affect identity;
5. a matching API record set classifies as `FRESH`;
6. true record edits remain `STALE_SOURCE`;
7. malformed or mixed schemas remain fail-closed;
8. a fresh proof does not invoke self-healing repair.

---

## 5. Change Log / Verification

### Batch PR #247

Branch: `fix/snapshot-integrity-record-contract`

Verified code head before handoff commit:

`83adbf475c41041ba99af8f24f227937771e661c`

Files changed in runtime/test scope:

- `src/services/snapshotIntegrity.js`
- `tests/frontend_snapshot_integrity.test.mjs`
- `tests/frontend_snapshot_self_healing.test.mjs`
- `tests/frontend_user_reported_product_defects.test.mjs`

Implementation:

- API/D1 records are normalized into the same manifest projection used by Python.
- No store data shape is mutated.
- No stale state is force-cleared.
- Unknown/mixed/invalid contracts still fail closed.

Verification completed on code head `83adbf4...`:

- targeted canonical SHA/integrity regression: PASS;
- PR CI #870 (`31800319339`): **SUCCESS**;
- frontend contracts: PASS, including real API-record integrity/self-healing regressions;
- frontend production build: PASS;
- Python tests + branch coverage gate: PASS;
- Worker security/deployment tests: PASS;
- Worker config / Recovery Evidence Gate / local D1 schema gate: PASS;
- diff review: runtime change remains isolated to `snapshotIntegrity.js`; no Worker/D1/Python/store/UI runtime change.

Final PR head after this handoff-only commit must rerun required CI before Ready/Merge.

Rollback:

- squash/revert PR #247 if regression is observed;
- no schema/data migration rollback is required;
- reverting restores the previous browser integrity behavior without changing D1 or published snapshots.

Deployment:

- **NOT DEPLOYED YET**.
- This is frontend-only runtime code; after merge, normal protected-main Pages deployment is required.
- Production Worker deploy is **not required** because Worker source/D1 contract are unchanged.

---

## 6. Decision Log

### D-2026-08-14-01 — Fix the schema boundary, not the stale UI symptom

- **Evidence:** successful backend calculation/publication plus deterministic frontend `UNVERIFIABLE_RECORDS` path.
- **Alternatives rejected:** force `snapshotFreshness` to fresh; hide warning after `succeeded`; add another calculation retry; change Worker API field names; change Python manifest format.
- **Reason:** those alternatives either conceal unverifiable data or broaden impact without addressing the mismatched contract.
- **Trade-off:** frontend supports two explicit source input shapes at the canonicalization boundary (real API shape and calculation projection shape) and rejects mixed objects.
- **Status:** ACTIVE in PR #247.
- **Reopen Condition:** production evidence proves another valid Worker record shape or Python manifest contract version that is not represented by this boundary.

### D-2026-08-14-02 — Keep fail-closed integrity semantics

A successful job status alone is not proof that the displayed snapshot matches current records. Freshness still requires source SHA/count/max-id and benchmark agreement. Job success must never directly clear the stale warning.

---

## 7. Known Issues / Risks / Technical Debt

### Current risk

The main risk is cross-layer canonicalization drift if Worker/Python field contracts change in the future. The new API-shaped SHA parity tests reduce this risk but do not replace versioning discipline.

### Known non-blocking documentation drift

- `docs/DEPLOYMENT.md` historical/current-live text can lag remote deployment truth; deployment methodology remains authoritative but live identity must be revalidated from Actions/contracts.
- Issue #97 staging status has historical stale wording; it is not part of this product batch.

### Technical Debt / Deferred Candidates

Do not promote without new evidence:

1. generalized UPDATE / DELETE outcome-ambiguity durable intents;
2. calculation polling beyond 20 minutes;
3. broad cross-group dividend pending filtering;
4. broad `portfolio.js` refactor;
5. Worker/D1 changes for this snapshot incident.

---

## 8. NOW / NEXT / BACKLOG / REJECT

**NOW**

- complete final exact-head PR #247 CI after handoff commit;
- perform independent third-party PR review;
- classify review findings as BLOCKER / FOLLOW-UP / BACKLOG / REJECT;
- only BLOCKER can prevent merge.

**NEXT**

- mark PR #247 Ready once final gates pass;
- squash merge to protected `main`;
- verify post-main CI and Pages production deployment;
- verify normal browser full-read can classify a matching production snapshot without the stale banner/pill.

**BACKLOG**

- documentation/status hygiene listed above;
- unrelated deferred product candidates already reviewed.

**REJECT**

- force-clearing stale state because the job says `succeeded`;
- adding retries to mask integrity verification failure;
- changing Worker/D1/Python for this root cause without new evidence;
- broad refactor during this incident batch.

---

## 9. Next Actions

1. Wait for exact final PR head CI after this handoff commit.
2. Run independent review on the final diff.
3. Resolve only BLOCKER findings in this Batch; classify other findings without expanding scope.
4. If final CI + review pass, mark Ready and squash merge.
5. Verify protected-main CI and Cloudflare Pages deployment.
6. Confirm production UI convergence; if it still remains stale, reopen from fresh evidence rather than adding speculative recovery machinery.

