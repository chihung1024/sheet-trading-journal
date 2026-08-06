import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const WORKFLOW_PATH = '.github/workflows/deploy-worker-staging.yml';

test('staging deploy workflow is manual, protected, and exact-SHA locked', async () => {
  const workflow = await readFile(WORKFLOW_PATH, 'utf8');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /source_sha:/);
  assert.match(workflow, /confirm_environment:/);
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /confirm_environment must equal staging/);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test('staging deploy workflow uses isolated resource identities and no compute dispatch token', async () => {
  const workflow = await readFile(WORKFLOW_PATH, 'utf8');

  for (const name of [
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_D1_DATABASE_ID',
    'CLOUDFLARE_D1_DATABASE_NAME',
    'STAGING_GOOGLE_CLIENT_ID',
  ]) {
    assert.match(workflow, new RegExp(name));
  }
  assert.match(workflow, /trading-journal-staging/);
  assert.match(workflow, /journal-backend-staging\.chired\.workers\.dev/);
  assert.doesNotMatch(workflow, /GITHUB_TOKEN/);
  assert.doesNotMatch(workflow, /github\.token/);
  assert.doesNotMatch(workflow, /journal-backend\.chired\.workers\.dev/);
  assert.doesNotMatch(workflow, /STAGING_API_SECRET/);
});

test('staging secrets are scoped to required steps and never exposed at job level', async () => {
  const workflow = await readFile(WORKFLOW_PATH, 'utf8');
  const jobPrefix = workflow.split('    steps:')[0];

  assert.doesNotMatch(jobPrefix, /secrets\./);
  assert.match(workflow, /Verify protected staging configuration[\s\S]*secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /Verify pre-provisioned staging secret inventory/);
  assert.match(workflow, /wrangler secret list/);
  assert.match(workflow, /verify_staging_secret_inventory\.mjs/);
  assert.doesNotMatch(workflow, /wrangler secret put/);
});

test('staging deploy workflow refuses automatic provisioning and uses rendered staging config only', async () => {
  const workflow = await readFile(WORKFLOW_PATH, 'utf8');

  assert.match(workflow, /node tools\/render_staging_wrangler_config\.mjs/);
  assert.match(workflow, /\.wrangler\/staging\.toml/);
  assert.match(workflow, /--experimental-provision=false/);
  assert.match(workflow, /--experimental-auto-create=false/);
  assert.match(workflow, /wrangler d1 migrations apply DB --remote/);
  assert.match(workflow, /npx wrangler deploy/);
  assert.doesNotMatch(workflow, /\.wrangler\/deploy\.toml/);
  assert.doesNotMatch(workflow, /wrangler\.staging\.toml/);
});

test('staging deploy workflow verifies exact version, schema, environment, and service readiness', async () => {
  const workflow = await readFile(WORKFLOW_PATH, 'utf8');

  assert.match(workflow, /id: manifest/);
  assert.match(workflow, /node tools\/export_worker_manifest\.mjs/);
  assert.match(workflow, /for attempt in \$\(seq 1 20\)/);
  assert.match(workflow, /\/api\/version/);
  assert.match(workflow, /\/api\/health/);
  assert.match(workflow, /verify_staging_worker_deployment\.mjs/);
  assert.match(workflow, /EXPECTED_SHA:/);
  assert.match(workflow, /EXPECTED_RELEASE_VERSION:/);
  assert.match(workflow, /EXPECTED_API_VERSION:/);
  assert.match(workflow, /EXPECTED_SCHEMA_VERSION:/);
});
