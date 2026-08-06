import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { validateStagingWorkerDeployment } from '../tools/verify_staging_worker_deployment.mjs';

const EXACT_SHA = '3f5f3d385bbfe0137d17b1e681ece2e963c6c0c0';
const D1_ID = '11111111-1111-4111-8111-111111111111';
const D1_NAME = 'trading-journal-staging';
const STAGING_CLIENT_ID = '123456789012-stagingclient.apps.googleusercontent.com';
const PRODUCTION_CLIENT_ID =
  '951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com';
const TEST_OUTPUT = resolve('.wrangler/pr10d2a-staging-render-test.toml');

function render(overrides = {}) {
  return spawnSync(process.execPath, ['tools/render_staging_wrangler_config.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLOUDFLARE_D1_DATABASE_ID: D1_ID,
      CLOUDFLARE_D1_DATABASE_NAME: D1_NAME,
      STAGING_GOOGLE_CLIENT_ID: STAGING_CLIENT_ID,
      SOURCE_COMMIT: EXACT_SHA,
      WRANGLER_STAGING_OUTPUT: TEST_OUTPUT,
      ...overrides,
    },
  });
}

test('staging renderer produces the exact isolated Worker configuration and dry-runs', async () => {
  await rm(TEST_OUTPUT, { force: true });
  try {
    const result = render();
    assert.equal(result.status, 0, result.stderr);

    const config = await readFile(TEST_OUTPUT, 'utf8');
    assert.match(config, /^name = "journal-backend-staging"$/m);
    assert.match(config, /^main = "\.\.\/ops\/staging\/staging-worker\.js"$/m);
    assert.match(config, /^migrations_dir = "\.\.\/migrations"$/m);
    assert.match(config, /^database_name = "trading-journal-staging"$/m);
    assert.match(config, new RegExp(`^database_id = "${D1_ID}"$`, 'm'));
    assert.match(config, new RegExp(`^SOURCE_COMMIT = "${EXACT_SHA}"$`, 'm'));
    assert.match(config, /^DEPLOYMENT_ENVIRONMENT = "staging"$/m);
    assert.match(
      config,
      /^ALLOWED_ORIGINS = "https:\/\/staging\.sheet-trading-journal\.pages\.dev"$/m,
    );
    assert.match(config, new RegExp(`^GOOGLE_CLIENT_ID = "${STAGING_CLIENT_ID}"$`, 'm'));
    assert.doesNotMatch(config, /journal-backend\.chired\.workers\.dev/);
    assert.doesNotMatch(config, /951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i/);

    assert.equal(
      resolve(dirname(TEST_OUTPUT), '../ops/staging/staging-worker.js'),
      resolve('ops/staging/staging-worker.js'),
    );
    assert.equal(resolve(dirname(TEST_OUTPUT), '../migrations'), resolve('migrations'));

    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const dryRun = spawnSync(
      npx,
      ['wrangler', 'deploy', '--dry-run', '--config', TEST_OUTPUT],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`);
  } finally {
    await rm(TEST_OUTPUT, { force: true });
  }
});

test('staging renderer rejects sentinel, production, malformed, and cross-environment values', () => {
  const invalidCases = [
    { CLOUDFLARE_D1_DATABASE_ID: '00000000-0000-0000-0000-000000000000' },
    { CLOUDFLARE_D1_DATABASE_NAME: 'trading-journal-production' },
    { STAGING_GOOGLE_CLIENT_ID: PRODUCTION_CLIENT_ID },
    { STAGING_GOOGLE_CLIENT_ID: 'not-a-client' },
    { SOURCE_COMMIT: 'abcdef0' },
  ];
  for (const overrides of invalidCases) {
    const result = render(overrides);
    assert.notEqual(result.status, 0, JSON.stringify(overrides));
  }
});

test('staging secret inventory requires API_SECRET and forbids GITHUB_TOKEN', () => {
  const run = (inventory) => spawnSync(
    process.execPath,
    ['tools/verify_staging_secret_inventory.mjs'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        STAGING_SECRET_LIST_JSON: JSON.stringify(inventory),
      },
    },
  );

  assert.equal(run([{ name: 'API_SECRET', type: 'secret_text' }]).status, 0);
  assert.notEqual(run([]).status, 0);
  assert.notEqual(
    run([{ name: 'API_SECRET' }, { name: 'GITHUB_TOKEN' }]).status,
    0,
  );
});

test('staging readiness requires canonical version health plus staging response identity', () => {
  const base = {
    version: {
      source_commit: EXACT_SHA,
      release_version: '4.07',
      api_version: '2.60',
      schema_version: 2,
      worker_version: { id: 'worker-version-id' },
    },
    health: {
      status: 'ok',
      observed_schema_version: 2,
    },
    versionHeaders: 'x-deployment-environment: staging\nx-worker-service: journal-backend-staging\n',
    healthHeaders: 'X-Deployment-Environment: staging\nX-Worker-Service: journal-backend-staging\n',
    expectedSha: EXACT_SHA,
    expectedReleaseVersion: '4.07',
    expectedApiVersion: '2.60',
    expectedSchemaVersion: '2',
  };

  assert.equal(validateStagingWorkerDeployment(base).ok, true);
  assert.equal(
    validateStagingWorkerDeployment({
      ...base,
      versionHeaders: 'x-deployment-environment: production\n',
    }).ok,
    false,
  );
});
