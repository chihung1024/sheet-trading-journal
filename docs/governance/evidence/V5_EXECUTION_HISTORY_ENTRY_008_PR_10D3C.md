# V5 Execution History — Entry 008 — PR-10D3C authenticated staging browser closeout

Status: **CLOSED / PASS**

- Original D3C baseline: `479dd6783a645abd8f8df406cc44c70be184af33`
- Infrastructure PR: `#123`
- Infrastructure merge: `a1bfc40a1e22ee2624e9cff7d6324f13215ea35c`
- Workflow compile-fix PR: `#124`
- Current exact source / compile-fix merge: `09a741abaf581bfb20d4a59eaffcda345776757b`
- Post-browser recovery branch: `backup-d3c-browser-smoke-pass-09a741a`
- Runtime/data/schema change in this closeout entry: **none**

## Infrastructure and pre-activation result

PR #123 added the authenticated fixed-staging Chromium smoke infrastructure with no authentication bypass. It uses a real Google-issued ID token for a dedicated staging identity, verifies the deployed frontend's Google client ID, requires the live staging Worker to report the exact requested source SHA, and performs authenticated browser-origin record CRUD plus cleanup/logout and production-origin isolation.

The final reviewed infrastructure head was `a5a8b1ca69c46066395599c8ac9cd80a7ef0a11f` and merged as `a1bfc40a1e22ee2624e9cff7d6324f13215ea35c`.

## Post-merge workflow compiler defect preserved

The first merged workflow exposed a GitHub Actions compiler-context defect: `${{ runner.temp }}` was used at job-level `env`, where the runner context is unavailable during workflow compilation.

- Failing post-merge workflow run: `31151484724`
- Result: failure with zero jobs
- Historical finding is retained; it is not rewritten as if the initial merge had been clean.

PR #124 repaired the context boundary by binding the temporary ID-token path only at the execution-time steps that need it and added a static regression guard.

- Final PR #124 reviewed head: `f6b7f3a709994c1a669e69404a73fa99c694257c`
- Merge SHA: `09a741abaf581bfb20d4a59eaffcda345776757b`
- Post-merge CI: `31152189249`, PASS
- Post-merge Pages: `31152188674`, PASS

## Fixed staging alignment at the exact source

The fixed staging frontend and Worker were then aligned to the same exact source SHA `09a741abaf581bfb20d4a59eaffcda345776757b`.

### Cloudflare Pages

- Fixed staging source: `09a741abaf581bfb20d4a59eaffcda345776757b`
- External deployment id: `fdf06697-6ff7-480a-aca4-ef5b17a88ef3`
- Completed success check: `92784471873`
- Fixed frontend: `https://staging.sheet-trading-journal.pages.dev`

### Staging Worker

- Deploy Staging Worker run: `31152810991` (run #3)
- Job: `92785841332`
- GitHub deployment: `5789693600`
- Cloudflare Worker version: `bbd55ac6-bbcb-48e9-9ea2-155f4c636512`
- Worker release: `4.07`
- API: `2.60`
- D1 schema: `2`
- Remote D1: no migrations to apply
- Secret isolation: API_SECRET present; GITHUB_TOKEN absent
- Live CORS/origin isolation: PASS
- Readiness did not accept stale source propagation; it waited until the exact requested source was live.

## Browser Smoke attempt #17 — expected operational fail-closed

- Workflow run: `31153666032`
- Job: `92788401745`
- Result: FAILURE
- First failing step: `Mint fresh Google ID token for synthetic staging account`
- Cause: staging E2E Google OAuth bootstrap secrets had not yet been provisioned.
- Chromium/browser test did not start.
- No synthetic transaction was created.
- Temporary-token cleanup step completed successfully.

This failure is retained as evidence that the external smoke fails closed when required credentials are absent.

## Browser Smoke attempt #18 — authoritative PASS

- Workflow run: `31156230969` (run #18)
- Job: `92796212558`
- GitHub staging deployment: `5790316215`
- Event: `workflow_dispatch`
- Exact source: `09a741abaf581bfb20d4a59eaffcda345776757b`
- GitHub environment: `staging`
- `production_environment=false`

The log proved:

- live staging Worker source/release/API/schema identity matched the exact requested source;
- the dedicated staging Google OAuth client was non-production;
- a fresh Google ID token was minted and locally validated, with a 3600-second lifetime observed;
- Playwright packages resolved to exact `1.62.0`;
- Chromium installed and executed;
- one real browser E2E test passed in 5.6 seconds;
- deployed frontend GIS initialization used the staging client ID;
- login through the existing application callback succeeded;
- authenticated browser-origin GET `/api/records` succeeded;
- POST created one uniquely tagged minimal synthetic AAPL BUY record;
- subsequent GET found exactly one matching record;
- PUT updated only known allowlisted transaction fields plus id;
- subsequent GET verified the deterministic update;
- DELETE succeeded;
- final GET verified the unique synthetic marker count returned to zero;
- real semantic logout restored the login overlay and removed the canonical browser token from localStorage;
- browser traffic to production frontend/API origins remained zero;
- the only production activity was a read-only `/api/version` probe through Playwright's non-browser request context;
- the temporary Google ID-token file was removed in the unconditional cleanup step.

## D3C result

PR-10D3C is therefore **CLOSED / PASS** at the browser-level acceptance gate. The result is not based solely on a green workflow conclusion; it is supported by exact-SHA staging alignment, real Google token issuance, real Chromium execution, authenticated CRUD, deterministic cleanup, logout verification and production-origin exclusion.

## Explicit carry-forward

D3C does not close later V5 work:

- B01: the isolated E2E package still lacks a committed npm lockfile/integrity graph;
- B05: revocable application sessions and true logout-all remain open;
- B06/B07: ledger revision and snapshot publication consistency remain open;
- B08/B09: instrument master / unsupported-asset and currency truth remain open;
- B11/N31: corporate-action economic correctness remains open;
- B14: remaining CSP `unsafe-inline` / `unsafe-eval` and PWA/service-worker hardening remain open.

Schema 3 remains blocked until the Recovery Evidence Gate is closed.

## Next gate

Proceed to production explicit environment/CORS/CSP validation and the first exact-SHA production deployment. Production environment approval remains a separate protected gate. Do **not** begin Schema 3 from this closeout.
