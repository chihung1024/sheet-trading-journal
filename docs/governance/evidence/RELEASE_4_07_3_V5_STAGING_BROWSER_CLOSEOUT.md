# Release 4.07.3 — V5 staging/browser closeout and deployment governance

Target: post-closeout `main` merge SHA (resolved after protected PR merge)  
Previous GitHub Release: `4.07.2` (`35e629ade1c3155ad5e44b839135d4406f9a4170`)

## Release intent

This patch release is an operational/governance milestone. It records the V5 control-plane, frontend correctness, environment-isolation, fixed-staging deployment and authenticated browser-smoke work completed after 4.07.2.

The canonical Worker runtime remains **4.07**, API remains **2.60**, and D1 schema remains **2**. This release does not claim a Worker 4.07.3 runtime binary or Schema 3 migration.

## Major updates included since 4.07.2

### 1. V5 governance and zero-downtime execution controls

- Added the V5 zero-downtime execution authority and append-only audit/evidence discipline.
- Tombstoned obsolete manual Quick Edit deployment instructions that could bypass exact-SHA deployment governance.
- Enforced protected-main workflow: PR required, merge-only path, strict required checks and no normal bypass path.
- Added/verified separate GitHub `staging` and `production` environment controls.
- Production retains an explicit reviewer gate; staging remains isolated for rapid verification.
- Added deterministic Python coverage policy and removed wall-clock dependence from coverage evidence.

### 2. Frontend residual correctness and truthful state

- Replaced overlapping interval refresh behavior with single-flight refresh loops and stale-completion protection.
- Separated connection status from snapshot freshness so the UI no longer implies a recalculation result is current before publication.
- Made record/group mutations use bounded transport and canonical response parsing while preserving existing public error contracts.
- Added cross-tab logout propagation using the canonical token storage key.
- Restored browser zoom and improved clickable-control semantics.
- Corrected `.TW` / `.TWO` transaction currency presentation to TWD/NT$.
- Added benchmark provenance/state guards and broader frontend regression coverage.

### 3. Environment-aware frontend CSP

- Removed the fixed production-API assumption from CSP generation.
- Added deployment-contract-driven API-origin rendering for both HTML meta CSP and Pages `_headers`.
- Production builds authorize only the production Worker origin.
- Fixed staging builds authorize only the staging Worker origin.
- Arbitrary preview deployments remain fail-closed.
- Remaining `unsafe-inline` / `unsafe-eval` hardening is intentionally deferred to B14 rather than silently changed here.

### 4. Fixed staging environment and Worker isolation

- Added an explicit staging deployment contract and fixed staging frontend origin.
- Added isolated staging Worker configuration and deployment workflow.
- Staging Worker deploys use exact reviewed source SHA and staging-only D1/config identities.
- Staging OAuth client is required to differ from the known production Google OAuth client.
- Staging Worker secret inventory was operationally verified with API_SECRET present and GITHUB_TOKEN absent.
- Live CORS verification allows the fixed staging Pages origin and rejects production Pages, arbitrary preview, GitHub Pages and localhost origins.
- Readiness checks verify source/release/API/schema/health/environment/service identity rather than accepting HTTP success alone.

### 5. Authenticated Chromium staging smoke

- Added a dispatch-only authenticated Playwright smoke for the fixed staging frontend + staging Worker.
- Uses a dedicated staging Google identity and a fresh Google-issued ID token; no Worker auth bypass or fake accepted token was introduced.
- Long-lived client secret / refresh token remain scoped only to the token-mint step.
- The deployed frontend's actual Google `client_id` initialization is observed and must equal the staging OAuth client before login proceeds.
- Playwright package family is runtime-verified at exact `1.62.0`.
- Real Chromium executes login, authenticated GET/POST/PUT/DELETE, deterministic cleanup and semantic logout.
- Synthetic record marker is unique per run; the successful smoke verified marker count returned to zero after DELETE.
- Browser requests to production origins are intercepted and the successful run recorded zero production-origin browser requests.
- The only production activity is a read-only `/api/version` probe outside browser context.

### 6. Workflow compiler regression found and closed

- The first merged browser-smoke workflow exposed an execution-context defect: `${{ runner.temp }}` at job-level `env` caused a zero-job GitHub compiler failure.
- The failing run is retained as historical evidence rather than erased.
- PR #124 moved the temporary-token path to execution-time step environments and added a static regression guard.
- Post-fix main CI, Pages, staging Pages, staging Worker and authenticated browser smoke all passed at the exact same source SHA.

## Exact staging/browser closeout evidence

- Exact reviewed source: `09a741abaf581bfb20d4a59eaffcda345776757b`
- Fixed staging Pages external deployment: `fdf06697-6ff7-480a-aca4-ef5b17a88ef3`
- Fixed staging Pages success check: `92784471873`
- Staging Worker deploy run: `31152810991`
- Staging Worker job: `92785841332`
- Staging Worker GitHub deployment: `5789693600`
- Cloudflare Worker version: `bbd55ac6-bbcb-48e9-9ea2-155f4c636512`
- Browser Smoke #17: `31153666032` — fail-closed before browser start because E2E OAuth bootstrap secrets were absent
- Browser Smoke #18: `31156230969` — SUCCESS
- Browser Smoke successful job: `92796212558`
- Browser Smoke successful GitHub staging deployment: `5790316215`
- Playwright result: `1 passed (5.6s)`
- Post-delete unique synthetic marker count: `0`
- Browser production-origin requests: `0`

## Recovery references

Retain all prior recovery branches. New closeout recovery point:

- `backup-d3c-browser-smoke-pass-09a741a`

Key earlier retained references include:

- `backup-pre-v5-wave0-2557fc5`
- `backup-wave0-closed-626fba8`
- `backup-10c9-closed-d78bb3c`
- `backup-10d3a-closed-bb115a0`
- `backup-post-10d3c-merge-a1bfc40`
- `backup-pre-d3c-browser-activation-bb115a0`

## Explicitly not completed by this release

- B01: committed E2E npm lockfile/integrity graph
- B05: server-revocable sessions and true logout-all
- B06/B07: ledger revision and guaranteed snapshot publication consistency
- B08/B09: authoritative instrument master / unsupported asset and currency truth
- B11/N31: corporate-action and dividend economic correctness
- B14: remaining CSP and PWA/service-worker hardening
- Recovery Evidence Gate
- Schema 3

## Next operational gate

The next isolated phase is production explicit environment/CORS/CSP verification followed by the first exact-SHA production deployment. The protected `production` environment reviewer gate must remain intact. Schema 3 remains blocked until the Recovery Evidence Gate is closed.
