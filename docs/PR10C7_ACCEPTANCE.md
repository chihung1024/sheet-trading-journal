# PR-10C7 Acceptance — Cross-Tab Automatic Refresh Leadership

## Purpose

This B02 frontend-only batch prevents multiple visible browser tabs or windows for the same signed user from independently owning automatic market-hours timers and dispatching duplicate calculation triggers.

Tracking issue: #89  
Pull request: #90

## Exact baseline and recovery

- Repository: `chihung1024/sheet-trading-journal`
- Main SHA before change: `8a05bdc2cf1eb13e66c35f8693fa0580497bd2a8`
- Main tree before change: `d45b6e8daf8776691c3407d1d4587df3a5daad58`
- Worker release/API/schema: `4.07` / `2.60` / `2`
- Pre-change backup: `backup-pre-pr10c7-8a05bdc`
- Work branch: `pr10c7-cross-tab-refresh-leader`
- Runtime scope: frontend browser coordination only

## Root causes

### Independent per-tab timers

Every mounted `useMarketHoursRefresh()` instance previously created its own one-minute eligibility check, three-minute automatic-refresh timer, and countdown. Page visibility removed hidden tabs but did not coordinate two simultaneously visible windows.

### Process-local duplicate protection

`triggerUpdatePromise` and Pinia state are local to one JavaScript runtime. They cannot stop another tab from generating a different idempotency key before either tab publishes its pending request.

### Leadership failover without shared cooldown

A replacement tab could immediately trigger after the old leader closed unless the last automatic action time survived lease release.

### Local-only pause semantics

A local pause that merely released leadership allowed another tab to continue the same tenant-wide backend update. The UI could therefore report “paused” while automatic calculation still continued elsewhere.

## Permanent controls

### Opaque tenant scope

- The signed Google JWT `sub` claim defines the browser coordination scope.
- The subject is hashed to a fixed 16-character scope key.
- Raw token, email, and `sub` are never stored in lease or pause keys or records.
- Missing or malformed signed subject fails closed.

### Stabilized renewable lease

- A contender writes a random owner/lease record and confirms it after a settlement window.
- Simultaneous stale reads converge to the last confirmed writer; only one contender returns leader status.
- The lease renews every five seconds and expires after fifteen seconds.
- A crashed tab therefore cannot hold leadership indefinitely.
- Storage events accelerate re-election; renewal polling remains the fallback.
- Hidden, logged-out, disabled, token-changed, and unmounted tabs release only their own lease.

### Invocation and scope invalidation

- Every queued election, renewal, pause, and action claim captures the lifecycle epoch and exact storage keys at invocation time.
- Stop or tenant-scope change invalidates queued work before it can operate on a new session.
- Old-session operations cannot borrow a new token scope or storage key.

### Shared automatic-action claim and cooldown

- Only the confirmed leader may claim an automatic action.
- The claim is written with a random claim ID and confirmed after settlement before `triggerUpdate()` is reachable.
- `lastActionAt` survives lease release in a tombstone.
- Failover cannot dispatch again inside the existing three-minute automatic interval.
- Existing Worker calculation idempotency remains defense in depth.

### Shared pause control

- Pause is stored separately from lease/action records so an in-flight action write cannot overwrite user control intent.
- Any same-scope tab may pause or resume.
- Pausing releases the active lease and blocks all contenders in the same browser profile.
- Paused tabs keep the storage listener so resume propagates without reload.
- Closing or hiding a tab releases its lease but does not erase shared pause intent.
- Corrupt pause state fails closed; an explicit resume rewrites a valid control record.
- Pause mutation is serialized against startup election so stale local UI state cannot reverse the intended toggle or trigger during synchronization.

### Leadership-aware UI and scheduling

- All eligible tabs may observe and compete, but only the leader may create the three-minute timer and countdown.
- Missing leadership fails closed at both timer-creation and dispatch boundaries.
- Followers display `其他分頁處理中` instead of a false `0:00` countdown.
- The existing market-hours and daylight-saving formulas are unchanged.
- The existing one-minute eligibility check, three-minute interval, and 60-second UI timeout are unchanged.

## Manual trigger compatibility

The formal manual trigger in `App.vue` continues to call `portfolioStore.triggerUpdate()` directly and is not gated by browser leadership. This batch coordinates automatic market-hours work only.

## Storage governance

Reviewed prefixes were added to `docs/governance/browser-storage-baseline.json`:

- `sheet_trading_journal.market_refresh_leader.` — expiring lease, action claim, and cooldown tombstone;
- `sheet_trading_journal.market_refresh_pause.` — cross-tab pause intent.

Both use only the opaque scope hash. Deterministic privacy tests inspect actual persisted key and record values and reject raw token, email, or signed subject leakage.

## Test-first and correction history

### Initial test-first CI `31085792083`

The first service-only run failed three frontend contracts:

1. the contention harness did not yet model simultaneous stale reads;
2. the cooldown harness advanced virtual time beyond its test lease TTL;
3. the storage governance baseline correctly rejected the unregistered dynamic prefix.

The lease algorithm was not weakened. The tests were corrected to model the intended independent conditions, and the storage prefix was formally inventoried.

### Integrated CI `31086333577`

Passed:

- cross-tab lease service tests;
- leadership-aware refresh policy and composable contracts;
- frontend production build;
- Python suite and measured coverage;
- Worker security/config/deployment metadata;
- local D1 baseline.

### Privacy CI `31086463299`

Passed after adding deterministic persisted-value privacy inspection.

### Shared-pause CI `31087321363`

All shared-pause and action-race tests passed. One older contention harness failed because the new pause-key reads consumed its two synthetic stale reads before lease reads.

### Corrected shared-pause CI `31087473809`

Passed all frontend contracts/build, Python coverage, Worker/security/config, and local D1 gates after the harness modeled two empty pause reads plus two empty lease reads. Production logic was unchanged by that correction.

The final exact-head CI is the workflow attached to the commit containing this acceptance document and is recorded in the PR review and merge evidence.

## Deterministic acceptance coverage

Tests cover:

- stable opaque scope derivation from signed `sub`;
- simultaneous contender convergence;
- renewal and lease expiry failover;
- displaced-owner fail-closed behavior;
- release and cooldown tombstones;
- stop and scope-change invalidation;
- corrupt lease/pause records and storage failures;
- storage-event and interval cleanup;
- shared pause/resume propagation;
- pause versus in-flight action claim;
- explicit recovery from corrupt pause control;
- persisted-value privacy;
- leader-only timer creation and automatic dispatch;
- stale leadership-sync rejection;
- pause mutation serialization;
- follower ownership text.

## Compatibility and exclusions

Preserved:

- market-hours and daylight-saving calculations;
- one-minute eligibility cadence;
- three-minute automatic interval;
- 60-second frontend timeout;
- formal manual trigger behavior;
- Worker calculation-job and idempotency behavior;
- Worker release/API/schema `4.07` / `2.60` / `2`.

No change was made to:

- Worker or D1 code/data;
- server-side calculation-job coalescing;
- OAuth/session protocol;
- records, snapshots, market data, benchmarks, or IBKR logic;
- dependencies or workflows;
- release, API, or schema versions;
- paid or potentially metered services.

## Validation boundary

This batch coordinates tabs/windows that share the same browser localStorage profile. It does **not** provide cross-device leadership or global pause across different browsers/devices. Cross-device duplicate prevention remains dependent on existing server-side calculation idempotency/coalescing and later job-protocol work.

CI verifies deterministic coordination contracts and the production frontend build. This document does not claim that a new Cloudflare Pages revision was independently verified from this environment.

## Rollback

Revert the frontend-only merge or restore the prior Pages source/deployment from `backup-pre-pr10c7-8a05bdc`.

The new storage records are non-authoritative coordination hints. Reverting leaves harmless opaque lease/pause records that older code ignores. No Worker, D1, OAuth, IBKR, record, snapshot, or data rollback is required.
