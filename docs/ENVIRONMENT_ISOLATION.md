# Environment isolation

## Purpose

B03 separates production, staging, and local/test execution so non-production code cannot silently read or mutate production services.

The machine-readable frontend source of truth is `config/deployment-environments.json`.

Detailed contracts:

- Backend staging Worker: `docs/STAGING_WORKER_CONTRACT.md`
- Frontend staging Pages branch: `docs/STAGING_FRONTEND_CONTRACT.md`

## Reviewed environments

| Environment | Frontend identity | API identity | Status |
|---|---|---|---|
| Production | Cloudflare Pages `main` | Production Worker | Active |
| Staging | Cloudflare Pages `staging` only | `journal-backend-staging` only | Contract defined; external resources not yet evidenced |
| Development / test | Local or CI | Explicit local/test services | Active as needed |
| Arbitrary preview / PR branch | None | None | Build blocked |

The generic deployed `preview` mode is no longer reviewed. Every non-`main` Pages branch fails closed except the single fixed `staging` branch.

## Shared build gate

The same frontend environment policy runs through two independent paths:

1. `npm run build` invokes `prebuild`, which runs `tools/check_frontend_environment.mjs`.
2. `vite.config.js` invokes `validateFrontendEnvironment(process.env)` for direct Vite builds.

This prevents bypassing the environment contract by changing the build entry point.

## Production compatibility window

The Cloudflare Pages `main` branch may continue using the current reviewed production fallback when explicit production Vite values are absent. This compatibility window prevents an environment-isolation rollout from interrupting the production site.

A later B03 batch must make production values explicit only after Cloudflare production variables are independently confirmed and exact-SHA deployment remains green.

## Staging boundary

Only the fixed `staging` Pages branch may enter staging mode. It must use:

```text
VITE_DEPLOY_ENV=staging
VITE_API_URL=https://journal-backend-staging.chired.workers.dev
VITE_GOOGLE_CLIENT_ID=<dedicated staging Google web client ID>
```

The API URL must be the exact HTTPS origin shown above. The OAuth client must be valid and different from production. Temporary PR hostnames are not staging origins.

The backend staging Worker contract additionally requires a separate D1 database, separate API secret, exact staging CORS origin, and no production calculation-dispatch token.

## External resources

Repository contracts do not prove that external resources exist. Before staging is enabled, independently provision and review:

1. Staging Worker `journal-backend-staging`.
2. Staging D1 database `trading-journal-staging` with synthetic data only.
3. Dedicated staging Worker secrets.
4. Fixed Cloudflare Pages `staging` branch.
5. Separate Google OAuth web client authorizing only the fixed staging frontend origin required by the application.
6. Protected GitHub `staging` environment and least-privilege Cloudflare credentials.

Do not copy production records, D1 data, API secrets, OAuth credentials, or GitHub dispatch credentials into staging.

## Verification

Repository CI verifies:

- production `main` compatibility;
- arbitrary Pages branch rejection;
- fixed staging frontend branch/API policy;
- staging Worker runtime isolation;
- renderer and Wrangler dry-run boundaries;
- workflow permissions and immutable action pins;
- local D1 schema regression;
- exact deployment readiness metadata.

After external staging provisioning, use synthetic records only and verify login, version/health identity, CRUD isolation, and absence of production calculation dispatch.

## Rollback

Revert the specific B03 sub-batch that introduced the failing contract. Repository-only contract batches do not require cloud-data rollback unless their deployment workflows were separately executed.
