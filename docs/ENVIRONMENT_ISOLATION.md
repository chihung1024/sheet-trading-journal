# Frontend environment isolation

## Scope

This document governs the frontend side of B03. It prevents Cloudflare Pages branch and pull-request previews from silently using production services while staging infrastructure is created separately.

PR-10D1 does **not** create or mutate Cloudflare Worker, D1, Pages, secret, or Google OAuth resources. Those resources must exist before preview builds are made usable again.

## Reviewed environments

| Frontend environment | Pages branch | API | Google OAuth client |
|---|---|---|---|
| Production | `main` | Production Worker | Production web client |
| Preview | Any non-`main` branch | Staging Worker only | Staging web client only |
| Staging | Dedicated staging build | Staging Worker only | Staging web client only |
| Development / test | Local or CI | Local/test as explicitly configured | Local/test client as needed |

The machine-readable source of truth is `config/deployment-environments.json`.

## Build-time policy

The same policy is invoked in two paths:

1. `npm run build` runs `prebuild`, which calls `tools/check_frontend_environment.mjs`.
2. `vite.config.js` invokes `validateFrontendEnvironment(process.env)` for every Vite build, including direct `vite build` calls.

For a Cloudflare Pages non-`main` branch, all of the following are mandatory:

- `VITE_DEPLOY_ENV` is `preview` or `staging`.
- `VITE_API_URL` is an HTTPS origin only.
- `VITE_API_URL` is not the production Worker origin.
- `VITE_API_URL` has no path, query, fragment, trailing slash, credentials, or localhost host.
- `VITE_GOOGLE_CLIENT_ID` is a valid Google web OAuth client ID.
- `VITE_GOOGLE_CLIENT_ID` is not the production OAuth client.

A missing or invalid value terminates the build. This is intentional: an unavailable preview is safer than a preview that can read or mutate production data.

## External staging prerequisites

Before setting Preview variables in Cloudflare Pages, create all of these as independent resources:

1. A staging Worker with a distinct service name.
2. A staging D1 database with no production tenant records.
3. Staging-only Worker secrets and service credentials.
4. A separate Google OAuth web client.
5. Exact preview/staging authorized JavaScript origins for that client.
6. A staging test account containing synthetic records only.

Do not copy production D1 data or production secrets into staging.

## Cloudflare Pages Preview variables

Set the following in the **Preview** environment, not the Production environment:

```text
VITE_DEPLOY_ENV=preview
VITE_API_URL=https://<staging-worker-origin>
VITE_GOOGLE_CLIENT_ID=<staging-google-web-client-id>
```

Use `.env.preview.example` only as a shape reference. Do not commit actual staging secrets. Google OAuth client IDs are public identifiers, but environment separation still requires different clients.

## Production compatibility window

During PR-10D1, `main` Pages builds may continue using the existing reviewed production fallback when no production Vite variables are supplied. This exception exists only to avoid interrupting the current production site before Cloudflare Pages production variables are confirmed.

A later B03 sub-batch must:

- make production values explicit;
- deploy and verify the staging Worker and D1;
- point previews to staging;
- remove permissive production Worker origin defaults;
- restrict production CORS and OAuth origins to exact production origins.

## Deterministic verification

Run:

```bash
npm run test:frontend
npm run build
```

To simulate a valid preview build:

```bash
CF_PAGES=1 \
CF_PAGES_BRANCH=feature/example \
VITE_DEPLOY_ENV=preview \
VITE_API_URL=https://staging-worker.example.workers.dev \
VITE_GOOGLE_CLIENT_ID=123456789012-stagingclient.apps.googleusercontent.com \
npm run environment:check
```

To verify fail-closed behavior, replace either staging value with the production value. The command must exit non-zero.

## Staging smoke test after provisioning

Use synthetic data only and verify:

1. Preview login succeeds with the staging OAuth client.
2. `/api/version` and `/api/health` identify the staging Worker.
3. Creating, updating, and deleting a synthetic record affects staging D1 only.
4. Triggering a calculation cannot create a production calculation job.
5. Browser network requests contain no production Worker origin.
6. The production Worker rejects the preview origin after the later CORS cutover.

## Rollback

Revert the PR-10D1 merge to remove the repository guard. No Worker, D1, OAuth, record, snapshot, or financial-data rollback is involved.
