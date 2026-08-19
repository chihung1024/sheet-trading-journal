# Product Surface Convergence + UX Priority Decision — 2026-08-19

Status: **CLOSED DECISION / CURRENT PRODUCT AUTHORITY FOR UX-R1**

This document closes the 2026-08-19 discussion about high-risk import/restore development so the project can return to a single UI/UX implementation line without carrying unresolved product ambiguity.

Remote truth at decision time:

- protected `main`: `97e2a7a582334518a18732237a0c686baaa547e0`;
- active UX branch: `feat/ux-r1-adaptive-workspace`;
- active Draft PR: **#387 — UX-R1 Adaptive Workspace & Responsive Interaction**;
- PR #387 implementation head before this documentation closeout: `dc1af19a4ab6683cb68a80688d339c55ce2582c6`;
- latest exact-head CI on that implementation head: run `32203363240`, Frontend contract job failed while Python and Worker suites succeeded;
- R3.3B PR #367 is **CLOSED / NOT MERGED / NOT PLANNED FOR CURRENT RELEASE**; its branch/history remain reference material only.

Always refresh GitHub remote truth before implementation, merge, deployment, or any conclusion about current CI.

---

## 1. Product priority decision

After this documentation closeout, **UI/UX architecture and the directly experienced product interface are the highest active development priority**.

The priority order for the current product phase is:

1. **UI/UX architecture, usability, responsiveness, interaction clarity, accessibility, and user-visible workflow quality.**
2. Preserve user-facing functional correctness and continuity while improving the interface.
3. Preserve financial/data correctness and security invariants as non-negotiable safety gates.
4. Perform technical/debug work only when required to enable the above.
5. Defer or reject optional refactors, methodology expansion, dormant adapters, and maintenance work that do not materially improve the current user experience or required correctness.

This does **not** mean UI may bypass financial/data safety. It means technical complexity is no longer allowed to become an independent product roadmap that displaces user-facing value.

---

## 2. Final data-feature surface decision

### 2.1 Backup JSON export — KEEP

Status: **KEEP / READ-ONLY SUPPORTING SAFETY FEATURE**.

Reason:

- authoritative tenant-scoped reads only;
- no D1 mutation;
- no parser-derived trade identity;
- no restore behavior;
- production verified;
- provides useful data portability and disaster-recovery material at low ongoing risk.

The Backup export remains a normal product action and may receive ordinary UX adaptation as part of the Records surface.

### 2.2 Transaction import adapters — PRODUCT RETIRED / FROZEN

The following are no longer active product-development obligations:

- IBKR trade import;
- Canonical CSV import;
- mapped/broker-neutral CSV import;
- mapping presets;
- import reconciliation receipt UX;
- CSV import template UX;
- ambiguous import batch retry / R3.3B.

Current policy:

- remove/hide their normal product entry points when Records is revised in UX-R1.4;
- do not continue feature development or polish;
- do not purge already-reviewed source code merely to make the repository look smaller;
- do not allow retired importer tests to force new importer feature work unless they expose a still-relevant core invariant;
- future re-entry requires an explicit product decision, fresh current-main tracing, and a new threat/correctness review rather than automatically resuming old roadmap work.

### 2.3 Journal Restore — PRODUCT UI RETIRED / BACKEND MAINTENANCE-ONLY

Current policy:

- remove/hide the Restore entry point from the normal product UI during UX-R1.4;
- freeze Restore feature expansion;
- retain the already-reviewed Worker route, migration, tests, and recovery implementation for now;
- do not launch a backend purge inside UX-R1.

Important boundary:

**Removing the UI does not eliminate the production server mutation surface.** The existing Restore route remains a residual security/mutation surface while enabled. If the project later wants minimum production mutation exposure, perform a separate post-UX `Production Mutation Surface Review` to decide whether the route should be server-side feature-gated/default-disabled. That review is not part of UX-R1.

### 2.4 Historical imported-data compatibility — KEEP

Retiring new import does not permit breaking data already imported in the past.

Preserve:

- existing IBKR/IMPORT record readability;
- historical durable note-envelope projection compatibility;
- `event_source`, execution metadata, and schema compatibility required by existing records;
- authoritative record pagination/readback;
- Backup serialization of historical durable fields.

Rule:

> **Retire write adapters; retain read compatibility.**

### 2.5 Generic record-create safety infrastructure — CORE / DO NOT REMOVE

The following are core ledger safety, not importer-only infrastructure:

- `recordCreateIntent`;
- stable idempotency for normal manual record creation;
- mutation barrier / pending-intent supersession rules;
- ambiguous request outcome classification;
- pending create reconciliation/recovery;
- authoritative readback after committed mutation;
- automatic recalculation/snapshot recovery.

These remain mandatory because normal manual BUY/SELL/DIV creation can also experience a server commit followed by a client timeout or lost response.

---

## 3. R3.3B governance closure

PR #367 is no longer `DEFERRED` work.

Final status:

- **CLOSED**;
- **NOT MERGED**;
- **NOT PLANNED FOR CURRENT RELEASE**;
- branch and exact SHA retained only for history/research;
- do not rebase, revive, transplant, or merge it implicitly.

Any future import-retry work starts from current product need and current `main`, not from an assumption that #367 must be completed.

The old deferred handoff document remains historical evidence and must not override this newer decision.

---

## 4. Correct UI component boundary

Current Records UI mixes unrelated risk classes:

```text
RecordList
├─ IBKR Import
└─ JournalBackupButton
   ├─ Broker-neutral import
   ├─ CSV template
   ├─ Backup download
   └─ Restore
```

Target product boundary during UX-R1.4:

```text
RecordList
├─ Primary record find/filter/history controls
├─ Refresh
└─ Backup download
```

`JournalBackupButton.vue` should become what its name implies: a focused Backup export control. Do not introduce a replacement mega-component for retired data-mutation utilities.

---

## 5. UX-R1 sequencing after this closeout

This document is the discussion closeout. No Import/Restore product implementation should be started as a separate batch before UX-R1 resumes.

### NOW — UX-R1.3 closure

1. Refresh PR #387 current head and current exact-head CI.
2. Reproduce/identify the Frontend contract failure from evidence.
3. Fix only the true R1.3 root cause or stale/brittle contract, preserving the single `activeView` authority.
4. Require exact-head Frontend + Python + Worker success.
5. Document R1.3 completion.

Do **not** mix Records/Import retirement into the R1.3 implementation diff merely because this product decision is now known.

### NEXT — UX-R1.4 Holdings + Records

R1.4 is intentionally reduced from the earlier plan.

Records target:

- container-aware search/filter/date/result context;
- responsive table/card/detail behavior;
- refresh;
- Backup JSON download;
- retire normal UI entry points for IBKR Import, Canonical/mapped CSV utilities, CSV import template, import receipt/retry actions, and Journal Restore;
- keep historical imported records readable and exportable;
- do not delete backend Restore or generic ledger-recovery infrastructure.

Holdings target remains:

- container-aware table/card/detail presentation;
- preserve concentration facts;
- recompose analytical context without hiding material portfolio information;
- prioritize the primary holdings work surface.

### THEN — UX-R1.5 through UX-R1.8

Continue without opening a second implementation line:

- R1.5 Overview + Charts;
- R1.6 Dividends + Cash + Groups;
- R1.7 accessibility / keyboard / zoom / reflow / reduced motion / safe-area verification;
- R1.8 exact-head CI, frozen multi-perspective review, expected-head merge, Pages/deployment verification, responsive matrix verification, and stable closeout.

---

## 6. UX architecture principles locked for the phase

1. Actual usable workspace is more important than raw viewport width for component presentation.
2. Viewport media queries are reserved primarily for real app-shell transitions; use container authority for component/work-surface adaptation where practical.
3. One canonical `TradeForm` remains the create/edit authority.
4. One `activeView`/URL/localStorage navigation authority remains; responsive presentation must not create a second router or selected state.
5. Do not solve density by shrinking core financial typography or hiding business facts.
6. Touch targets, keyboard focus, Escape/restore-focus behavior, zoom/reflow, reduced motion, and mobile safe-area are product requirements.
7. Prefer composition/reflow over horizontal overflow and page-specific breakpoint patches.
8. Keep high-frequency actions visually primary; low-frequency utilities must not dominate the workspace.
9. A retired feature must not receive new responsive/polish investment merely because its code still exists.
10. Data/security correctness remains fail-closed even when UX is the highest development priority.

---

## 7. Retired-feature test governance

The current frontend test suite includes tests for import and Restore features that will become product-retired/maintenance-only.

When a future shared UI/architecture change causes one of those tests to fail, classify the failure before modifying product code:

```text
Does the failure prove a still-required core invariant is broken?
├─ YES → fix the core invariant and retain regression coverage.
└─ NO  → retire/isolate/update the obsolete product-surface contract; do not resurrect the retired feature.
```

Examples of still-required invariants:

- historical imported records remain readable;
- normal record creation remains idempotent/recoverable;
- Backup remains read-only and authoritative;
- tenant/security boundaries remain intact.

Examples that are no longer acceptance requirements after R1.4 retirement:

- retired Import buttons must remain visible;
- retired Restore UI must remain reachable;
- import mapping/template presentation must receive responsive polish;
- ambiguous import retry must be completed.

---

## 8. Verification matrix remains mandatory

At minimum verify representative widths:

`320 / 360 / 390 / 430 / 600 / 768 / 820 / 1024 / 1280 / 1440 / 1680 / 2048 CSS px`.

Also verify:

- light/dark themes;
- trade surface closed/open/editing;
- long content;
- empty/small/large datasets;
- pending dividends;
- Records filters;
- large Group datasets;
- keyboard-only interaction;
- 200% zoom/narrow reflow;
- reduced motion and mobile safe-area behavior.

Use existing deterministic/E2E/visual infrastructure where it materially proves user behavior. Do not build heavy infrastructure only for process completeness.

---

## 9. NOW / NEXT / BACKLOG / REJECT

### NOW

- finish this documentation/governance closeout;
- then close UX-R1.3 from evidence and exact-head CI.

### NEXT

- UX-R1.4 Holdings + Records with the reduced Records product surface described above;
- continue R1.5–R1.8 to complete UX-R1.

### BACKLOG

- optional `Production Mutation Surface Review` for server-side Restore feature gating after UX-R1;
- any future product discovery for broker import only if real user need returns.

### REJECT / NOT PLANNED

- R3.3B continuation;
- new Import feature work during UX-R1;
- full Import source-code purge during UX-R1;
- Restore backend/migration purge during UX-R1;
- removal of generic record-create recovery/idempotency;
- UI work that shrinks/hides core facts instead of fixing composition authority;
- separate parallel implementation phases while UX-R1 remains active.

---

## 10. AI handoff instructions

A future AI taking over this repository should:

1. read `AI_PROJECT_PLAYBOOK.md`;
2. read `README.md`;
3. read `to_do_update_list.md`;
4. read this decision document;
5. read `UX_R1_ADAPTIVE_WORKSPACE_PLAN_2026-08-19.md` and the breakpoint/container authority map;
6. refresh current `main`, PR #387 head, CI, open PRs, and deployment truth;
7. treat PR #367 as closed history, not an active/deferred task;
8. keep exactly one implementation batch active;
9. resume from the current UX-R1 batch rather than restarting import/restore analysis;
10. update handoff docs after each completed UX-R1 batch and stop after UX-R1 phase closeout before opening a new development phase.

If a stale older document conflicts with this decision on Import/Restore/R3.3B product priority, **this document is the newer product decision**, subject only to fresh remote truth and later explicit user decisions.
