# PR-10C6 Acceptance — Authentication Lifecycle Integrity

## Purpose

This B02 frontend-only batch replaces fragmented authentication request, JWT parsing, Google credential refresh, token scheduling, browser persistence, and login-overlay timer handling with explicit lifecycle owners and fail-closed contracts.

Tracking issue: #87  
Pull request: #88

## Exact baseline and recovery

- Repository: `chihung1024/sheet-trading-journal`
- Main SHA before change: `56e6cdf11a8fd14707a7daed94b9f205956eca78`
- Main tree before change: `8b0bfb249ed7cf92a181846a3fe915c5c2d847c9`
- Worker release/API/schema: `4.07` / `2.60` / `2`
- Pre-change backup: `backup-pre-pr10c6-56e6cdf`
- Work branch: `pr10c6-auth-lifecycle`
- Runtime scope: frontend only

The historical `pr10c6-token-refresh-scheduling` idea and its unreferenced draft blobs were not reused. This batch began from the verified PR-10C5 merge baseline.

## Root causes and permanent controls

### 1. Split request lifecycle

The Google credential exchange used raw `fetch()` and separately consumed JSON, so connection, response body, parsing, and validation did not share one deadline.

Control:

- `/auth/google` uses the PR-10C5 deadline service;
- the deadline remains active through JSON body consumption and explicit `success:true` validation;
- external cancellation propagates to the underlying request;
- malformed or incomplete success payloads fail closed.

### 2. Duplicated and incomplete JWT decoding

The auth store and refresh composable each decoded JWTs independently without one padding, UTF-8, claims, or expiry contract.

Control:

- one dependency-free decoder restores Base64URL payload padding;
- fatal UTF-8 decoding rejects replacement-character recovery;
- all three compact JWT segments must exist and use the Base64URL alphabet;
- claims must be an object with a positive safe-integer `exp`;
- expiry checks retain the existing five-minute skew.

### 3. Unsigned tenant identity drift

The browser could trust a mutable stored or response email without proving that it matched the signed token identity.

Control:

- a successful auth response must contain a non-empty email;
- the JWT must contain a non-empty signed email claim;
- normalized response and signed-token identities must match exactly;
- restored sessions derive tenant email from signed claims, not mutable browser storage;
- mismatched legacy browser email is ignored.

### 4. Half-published authentication state

Login previously updated reactive state before three independent browser-storage writes. A storage failure could produce a visible login with partially persisted credentials.

Control:

- authentication persistence snapshots all three prior values;
- writes are attempted as one logical unit;
- any write failure restores every prior value;
- reactive token/user state is published only after persistence succeeds;
- unrelated origin storage is never modified.

### 5. Fragmented Google refresh ownership

Two code paths initialized Google Identity Services, owned separate callbacks and timeouts, and relied on Promise idempotence for competing completion paths.

Control:

- one refresh controller owns provider lookup, initialization, prompt, callback, timeout, cancellation, and request abort;
- concurrent refresh calls share one in-flight promise;
- only literal `true` from credential exchange is success;
- duplicate credential callbacks are ignored;
- once a credential is received, a later prompt dismissal cannot override the active exchange;
- timeout, cancellation, callback failure, and provider failure settle once and release state.

### 6. Mount-time-only token scheduling

The refresh interval started only when a token existed during component mount. Login after mount could remain unscheduled, while logout or unmount could leave work active.

Control:

- Vue watches the reactive token with `{ immediate: true }`;
- restored and newly logged-in tokens start the monitor;
- empty token stops the monitor and cancels refresh work;
- component unmount stops the watcher, interval, and refresh operation;
- the five-minute interval and ten-minute refresh threshold remain unchanged;
- overlapping checks share one promise and stale observed tokens cannot initiate refresh.

### 7. Login overlay resource and transition races

The login overlay created a polling interval, timeout, and global callback without complete unmount cleanup. A naive cleanup fix could also cancel the required portfolio load when token publication caused normal overlay unmount.

Control:

- polling and timeout handles are component-owned and cleared together;
- initialization is idempotent;
- post-unmount callbacks cannot begin a new login or write UI errors;
- the local callback is passed directly to Google initialization;
- the compatibility global callback is deleted only when still owned by this component;
- an already accepted login still completes `fetchAll()` across normal token-driven overlay unmount.

## Test-first evidence

Test-first CI `31080396728` intentionally failed one contract:

- 73 frontend tests passed;
- the only failure proved that `LoginOverlay.vue` lacked unmount cleanup;
- build was correctly blocked after the contract failure.

After lifecycle and parallel root-cause corrections, CI `31084385356` passed:

- frontend contracts: success;
- frontend production build: success;
- Worker security/config/deployment metadata tests: success;
- local D1 baseline application: success;
- Python complete suite and measured coverage gates: success.

The deterministic auth suites cover JWT padding/UTF-8/claims, complete request deadline, cancellation, required fields, signed tenant identity, persistence rollback, restored token, login-after-mount, logout, unmount, near-expiry refresh, stale-token protection, single-flight, credential/prompt races, explicit success evidence, timeout, and cleanup.

## Compatibility

Preserved:

- Google client ID and allowed origins;
- Google button login UX;
- Worker `/auth/google` request and response shape;
- bearer-token session protocol;
- existing stored token/name/email keys;
- five-minute expiry skew;
- five-minute refresh check cadence;
- ten-minute refresh threshold;
- one-time portfolio 401 refresh behavior;
- Worker release/API/schema `4.07` / `2.60` / `2`.

## Explicit exclusions

No change was made to:

- Google Cloud OAuth Console;
- client ID, redirect URI, or allowed origins;
- Worker authentication verification;
- HttpOnly session migration;
- D1 schema or data;
- calculation, market data, snapshots, records, or IBKR behavior;
- dependencies or workflows;
- deployment metadata or release/API/schema versions;
- paid or potentially metered services.

## External validation boundary

CI verifies deterministic browser contracts and the production frontend build. This batch does not claim a live Google-account sign-in or a new Cloudflare Pages deployment was independently exercised from this environment. No production OAuth or Worker configuration changed.

## Rollback

Revert the frontend-only merge or restore the prior Pages deployment from the pre-change source. The exact source baseline is preserved at `backup-pre-pr10c6-56e6cdf`.

No Worker, D1, Google Cloud Console, IBKR, record, snapshot, or data rollback is required.
