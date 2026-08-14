# Product Audit — Three User-Reported Defects (2026-08-14)

## Scope

This batch fixes three normal-use defects reported from production UI screenshots. The fixes are root-cause/general contracts, not one-off handling for one symbol, one banner height, or one viewport.

Base production main before the batch:

`f00c5616a1d9eca819e6c7cccda181fe6be322e8` (PR #244)

Code-bearing candidate reviewed before this handoff:

`7ebba7c0e6a6b3344dee9abce1bb20b5cfbdf61c`

Exact-head CI #862 / run `31795590198`: Frontend, Worker/D1 and Python/coverage all SUCCESS.

## 1. Snapshot stays stale after backend calculation succeeds

### Production evidence

`Update Portfolio Data #3275` / run `31792620418` completed successfully on production main. The job's calculation/upload step and result-reporting step both succeeded, yet the frontend could remain in `持倉與績效快照待重新計算`.

### Root cause class

Phase 3 snapshot reconciliation can discover that the just-read snapshot still does not cryptographically cover current authoritative records or the requested benchmark. It correctly creates a newer Phase 2 dirty generation and hands back through a fresh full read.

Two lifecycle races existed around that handoff:

1. a `loaded` transition arriving while snapshot reconciliation was already running could be coalesced into the existing promise and never be assessed as a newer generation;
2. the newer durable dirty generation could be created while the original successful calculation/fresh-read stack was still unwinding. During that window Phase 2 correctly yields to the active calculation intent, but there was no guaranteed later edge to re-offer the new dirty token.

The correct response is not to hide the stale banner. The stale state remains fail-closed until the lifecycle can prove a fresh snapshot.

### Fix

`installSnapshotSelfHealing()` now:

- remembers a newer loaded transition while reconciliation is in flight and reruns assessment after the current reconciliation finishes;
- performs one bounded post-success full-read handoff per durable dirty token when a succeeded calculation, loaded read, stale snapshot, and same-owner dirty Phase 2 generation coexist;
- uses existing `portfolio.fetchAll()` only. It does not directly dispatch a calculation or perform financial work; the existing Phase 2 scheduler remains authoritative;
- retains the durable dirty state if the handoff read itself fails, allowing existing read recovery/reload recovery to continue safely.

### Invariants

- no stale banner suppression;
- no new financial authority;
- one automatic terminal handoff per dirty token per installed controller lifetime;
- unknown/integrity failures remain fail-closed;
- owner-bound automatic-recalculation state remains the source of recovery eligibility.

## 2. Desktop transaction panel overlaps notices/banners

### Root cause class

The right transaction panel visually lived inside the two-column workspace, but `.fixed-panel` used viewport `position: fixed` plus a viewport-right offset. It therefore left normal grid flow. A reliability banner or future notice inserted above the grid could not push the panel downward, so the panel floated over the notice.

Changing only `z-index` would preserve the structural bug.

### Fix

Desktop transaction rail now:

- remains inside the existing 360px grid column;
- uses `position: sticky` instead of `fixed`;
- inherits `width: 100%` from the grid track rather than hardcoding a second independent 360px viewport geometry;
- keeps the header offset only as its scroll-sticky threshold;
- uses `overflow-x: clip` on the relevant workspace ancestors so the sticky rail is not turned into a child of an accidental horizontal scroll container.

Mobile behavior is intentionally unchanged: the mobile sheet remains a fixed overlay and its `.fixed-panel` child remains static inside the sheet.

### Invariants

- desktop notices/banners/toolbars participate in normal document flow;
- transaction rail still remains accessible during vertical scrolling;
- mobile sheet/backdrop semantics remain unchanged;
- no viewport-specific coordinates are used to avoid this one screenshot.

## 3. Strategy TWR and benchmark start from different dates

### Root cause class

The chart previously chose a range baseline row and rebased the benchmark from that row independently. Strategy TWR correctly returned `null` until a reliable strategy TWR existed. Therefore any selected interval whose baseline preceded the first reliable strategy TWR showed benchmark history before strategy history.

This was a comparison-window bug, not a 0050-specific calculation problem.

### Fix

`twrState.js` now owns a shared `buildComparableTwrComparison()` contract:

1. find the first row where strategy TWR is reliable and benchmark TWR is finite/present;
2. use that row as the common comparison anchor;
3. slice both comparison series from the same anchor;
4. rebase strategy and benchmark to exactly 0% on that date;
5. if strategy TWR later becomes unreliable, benchmark is also `null` for that comparison row, preventing a benchmark-only continuation;
6. missing benchmark values are rejected explicitly rather than allowing JavaScript `Number(null) === 0` coercion;
7. if no common reliable anchor exists, the comparison fails closed with no fabricated values.

Python TWR, benchmark acquisition, snapshot data, and financial methodology are unchanged. This is a frontend comparison normalization contract only.

## Executable regression coverage

- `tests/frontend_twr_reliability.test.mjs`
  - common reliable anchor;
  - both series start at 0%;
  - relative returns after anchor;
  - benchmark stops through strategy reliability gaps;
  - missing benchmark values fail closed;
  - no common anchor fails closed;
  - chart consumes shared comparison contract.

- `tests/frontend_user_reported_product_defects.test.mjs`
  - stale snapshot after a succeeded job creates durable dirty state and receives one bounded follow-up lifecycle handoff;
  - the same dirty token is not repeatedly handed off;
  - desktop panel is sticky/in-flow and no longer viewport-fixed;
  - mobile sheet remains an intentional fixed overlay.

Existing full frontend contracts/build, Worker/D1 tests, and Python tests/coverage also remain required.

## Closure gates

Before merge:

1. docs-bearing exact-head full CI SUCCESS;
2. final compare against protected `main`, `behind_by=0`, expected scope only;
3. R2 PASS / 0 blocker;
4. ordinary merge with expected head SHA.

After merge:

1. post-main CI SUCCESS for exact merge SHA;
2. GitHub Pages build/report/deploy SUCCESS for exact merge SHA;
3. no Worker deployment or D1 migration is required for this frontend/service batch.

Do not reopen this work for theoretical retry expansion. Reopen only with a reproducible remaining symptom or new production evidence.
