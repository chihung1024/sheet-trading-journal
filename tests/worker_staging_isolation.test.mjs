import assert from 'node:assert/strict';
import test from 'node:test';
import stagingWorker, { __test } from '../ops/staging/staging-worker.js';

const STAGING_CLIENT_ID = '123456789012-stagingclient.apps.googleusercontent.com';

function validEnv(overrides = {}) {
  return {
    DEPLOYMENT_ENVIRONMENT: 'staging',
    ALLOWED_ORIGINS: __test.STAGING_FRONTEND_ORIGIN,
    GOOGLE_CLIENT_ID: STAGING_CLIENT_ID,
    API_SECRET: 'staging-api-secret-'.padEnd(48, 'x'),
    SOURCE_COMMIT: '3f5f3d385bbfe0137d17b1e681ece2e963c6c0c0',
    ...overrides,
  };
}

const ctx = { waitUntil() {} };

test('valid staging runtime has no configuration errors', () => {
  assert.deepEqual(__test.validateStagingRuntime(validEnv()), []);
});

test('staging runtime rejects production OAuth, missing API secret, and GitHub dispatch capability', () => {
  assert.ok(
    __test.validateStagingRuntime(validEnv({
      GOOGLE_CLIENT_ID: __test.PRODUCTION_GOOGLE_CLIENT_ID,
    })).some((message) => message.includes('production OAuth')),
  );
  assert.ok(
    __test.validateStagingRuntime(validEnv({ API_SECRET: '' }))
      .some((message) => message.includes('API_SECRET')),
  );
  assert.ok(
    __test.validateStagingRuntime(validEnv({ GITHUB_TOKEN: 'forbidden' }))
      .some((message) => message.includes('GITHUB_TOKEN')),
  );
});

test('staging runtime requires one exact staging frontend origin', () => {
  for (const origins of [
    '',
    'https://sheet-trading-journal.pages.dev',
    'https://feature.sheet-trading-journal.pages.dev',
    `${__test.STAGING_FRONTEND_ORIGIN},https://sheet-trading-journal.pages.dev`,
    '*',
  ]) {
    assert.ok(
      __test.validateStagingRuntime(validEnv({ ALLOWED_ORIGINS: origins })).length > 0,
      origins,
    );
  }
});

test('staging wrapper accepts only the fixed staging origin', async () => {
  const allowed = await stagingWorker.fetch(
    new Request('https://staging.invalid/api/version', {
      method: 'OPTIONS',
      headers: {
        Origin: __test.STAGING_FRONTEND_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    }),
    validEnv(),
    ctx,
  );
  assert.equal(allowed.status, 204);
  assert.equal(
    allowed.headers.get('Access-Control-Allow-Origin'),
    __test.STAGING_FRONTEND_ORIGIN,
  );
  assert.equal(allowed.headers.get('X-Deployment-Environment'), 'staging');
  assert.equal(allowed.headers.get('X-Worker-Service'), 'journal-backend-staging');

  for (const origin of [
    'https://sheet-trading-journal.pages.dev',
    'https://feature.sheet-trading-journal.pages.dev',
    'https://chihung1024.github.io',
    'http://localhost:5173',
  ]) {
    const rejected = await stagingWorker.fetch(
      new Request('https://staging.invalid/api/version', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'GET',
        },
      }),
      validEnv(),
      ctx,
    );
    assert.equal(rejected.status, 403, origin);
    assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null, origin);
    assert.equal((await rejected.json()).error_meta.code, 'ORIGIN_FORBIDDEN');
  }
});

test('staging wrapper fails closed before canonical Worker execution when configuration is incomplete', async () => {
  const response = await stagingWorker.fetch(
    new Request('https://staging.invalid/api/version'),
    validEnv({ API_SECRET: '' }),
    ctx,
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error_meta.code, 'STAGING_CONFIGURATION_ERROR');
});

test('staging version response carries exact environment and service headers', async () => {
  const response = await stagingWorker.fetch(
    new Request('https://staging.invalid/api/version'),
    validEnv(),
    ctx,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Deployment-Environment'), 'staging');
  assert.equal(response.headers.get('X-Worker-Service'), 'journal-backend-staging');
  const body = await response.json();
  assert.equal(body.source_commit, validEnv().SOURCE_COMMIT);
});
