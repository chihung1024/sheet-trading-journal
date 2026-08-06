import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  DEPLOYMENT_CONTRACT,
  FrontendEnvironmentPolicyError,
  validateFrontendEnvironment,
} from '../tools/frontend_environment_policy.mjs';

const CLI_PATH = new URL('../tools/check_frontend_environment.mjs', import.meta.url);
const POLICY_KEYS = [
  'CF_PAGES',
  'CF_PAGES_BRANCH',
  'VITE_DEPLOY_ENV',
  'VITE_API_URL',
  'VITE_GOOGLE_CLIENT_ID',
];
const PRODUCTION_API = DEPLOYMENT_CONTRACT.production.api_origins[0];
const PRODUCTION_CLIENT_ID = DEPLOYMENT_CONTRACT.production.google_client_ids[0];
const STAGING_API = DEPLOYMENT_CONTRACT.staging.api_origin;
const STAGING_BRANCH = DEPLOYMENT_CONTRACT.staging.pages_branch;
const STAGING_CLIENT_ID = '123456789012-stagingclient.apps.googleusercontent.com';

function cleanEnvironment(overrides = {}) {
  const environment = { ...process.env };
  for (const key of POLICY_KEYS) delete environment[key];
  return { ...environment, ...overrides };
}

function runCli(overrides = {}) {
  return spawnSync(process.execPath, [CLI_PATH.pathname], {
    cwd: new URL('..', import.meta.url),
    env: cleanEnvironment(overrides),
    encoding: 'utf8',
  });
}

function validStaging(overrides = {}) {
  return {
    CF_PAGES: '1',
    CF_PAGES_BRANCH: STAGING_BRANCH,
    VITE_DEPLOY_ENV: 'staging',
    VITE_API_URL: STAGING_API,
    VITE_GOOGLE_CLIENT_ID: STAGING_CLIENT_ID,
    ...overrides,
  };
}

test('ordinary local and CI builds remain compatible without deployment variables', () => {
  const result = validateFrontendEnvironment(cleanEnvironment());
  assert.equal(result.context, 'local-or-ci');
  assert.equal(result.configurationMode, 'explicit');

  const cli = runCli();
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /local-or-ci/);
});

test('current main Pages production build remains compatible during staged rollout', () => {
  const result = validateFrontendEnvironment(cleanEnvironment({
    CF_PAGES: '1',
    CF_PAGES_BRANCH: 'main',
  }));
  assert.equal(result.context, 'pages-production');
  assert.equal(result.configurationMode, 'legacy-production-fallback');
});

test('main Pages build rejects a staging environment declaration', () => {
  assert.throws(
    () => validateFrontendEnvironment(cleanEnvironment({
      ...validStaging(),
      CF_PAGES_BRANCH: 'main',
    })),
    (error) => error instanceof FrontendEnvironmentPolicyError
      && error.errors.some((message) => message.includes('main Cloudflare Pages branch')),
  );
});

test('arbitrary non-main Pages branches remain disabled even with valid-looking staging values', () => {
  const cli = runCli({
    ...validStaging(),
    CF_PAGES_BRANCH: 'feature/unreviewed-preview',
  });
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /Only the reviewed staging Pages branch/);
});

test('the fixed staging branch fails closed when isolated configuration is missing', () => {
  const cli = runCli({
    CF_PAGES: '1',
    CF_PAGES_BRANCH: STAGING_BRANCH,
  });
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /VITE_DEPLOY_ENV=staging/);
  assert.match(cli.stderr, /VITE_API_URL is required/);
  assert.match(cli.stderr, /VITE_GOOGLE_CLIENT_ID is required/);
});

test('staging rejects the production API origin and production OAuth client', () => {
  const productionApi = runCli(validStaging({ VITE_API_URL: PRODUCTION_API }));
  assert.notEqual(productionApi.status, 0);
  assert.match(productionApi.stderr, /cannot use a production API origin/);

  const productionClient = runCli(validStaging({
    VITE_GOOGLE_CLIENT_ID: PRODUCTION_CLIENT_ID,
  }));
  assert.notEqual(productionClient.status, 0);
  assert.match(productionClient.stderr, /cannot use a production Google OAuth client/);
});

test('the fixed staging branch accepts only the reviewed staging API and a distinct OAuth client', () => {
  const result = validateFrontendEnvironment(cleanEnvironment(validStaging()));
  assert.equal(result.context, 'pages-staging');
  assert.equal(result.deployEnvironment, 'staging');

  const cli = runCli(validStaging());
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /pages-staging/);

  assert.throws(
    () => validateFrontendEnvironment(cleanEnvironment(validStaging({
      VITE_API_URL: 'https://other-staging.example.workers.dev',
    }))),
    (error) => error instanceof FrontendEnvironmentPolicyError
      && error.errors.some((message) => message.includes('reviewed staging API origin')),
  );
});

test('dedicated staging builds outside Pages use the same strict policy', () => {
  const result = validateFrontendEnvironment(cleanEnvironment({
    VITE_DEPLOY_ENV: 'staging',
    VITE_API_URL: STAGING_API,
    VITE_GOOGLE_CLIENT_ID: STAGING_CLIENT_ID,
  }));
  assert.equal(result.context, 'staging');
});

test('staging API URLs must be exact HTTPS non-local origins', () => {
  const invalidUrls = [
    STAGING_API.replace('https:', 'http:'),
    'https://localhost',
    'https://127.0.0.1',
    `${STAGING_API}/api`,
    `${STAGING_API}/`,
    `${STAGING_API}?environment=staging`,
    `${STAGING_API}#staging`,
    'https://user:password@journal-backend-staging.chired.workers.dev',
  ];

  for (const apiUrl of invalidUrls) {
    assert.throws(
      () => validateFrontendEnvironment(cleanEnvironment(validStaging({ VITE_API_URL: apiUrl }))),
      FrontendEnvironmentPolicyError,
      apiUrl,
    );
  }
});

test('unsupported environment names and malformed OAuth clients fail closed', () => {
  assert.throws(
    () => validateFrontendEnvironment(cleanEnvironment(validStaging({ VITE_DEPLOY_ENV: 'preview' }))),
    FrontendEnvironmentPolicyError,
  );
  assert.throws(
    () => validateFrontendEnvironment(cleanEnvironment(validStaging({
      VITE_GOOGLE_CLIENT_ID: 'not-a-google-client',
    }))),
    FrontendEnvironmentPolicyError,
  );
});

test('npm lifecycle and direct Vite builds share the same validator', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['environment:check'], 'node tools/check_frontend_environment.mjs');
  assert.equal(packageJson.scripts.prebuild, 'npm run environment:check');
  assert.match(viteConfig, /validateFrontendEnvironment\(process\.env\)/);
  assert.match(viteConfig, /if \(command === 'build'\)/);
});
