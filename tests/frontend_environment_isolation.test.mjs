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
const STAGING_BRANCH = DEPLOYMENT_CONTRACT.staging.pages_branch;
const STAGING_API = DEPLOYMENT_CONTRACT.staging.api_origin;
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

test('current main Pages production build retains the legacy production fallback', () => {
  const result = validateFrontendEnvironment(cleanEnvironment({
    CF_PAGES: '1',
    CF_PAGES_BRANCH: DEPLOYMENT_CONTRACT.main_branch,
  }));
  assert.equal(result.context, 'pages-production');
  assert.equal(result.configurationMode, 'legacy-production-fallback');
});

test('main Pages build rejects staging or unsupported environment declarations', () => {
  for (const deployEnvironment of ['staging', 'preview', 'qa']) {
    assert.throws(
      () => validateFrontendEnvironment(cleanEnvironment({
        CF_PAGES: '1',
        CF_PAGES_BRANCH: DEPLOYMENT_CONTRACT.main_branch,
        VITE_DEPLOY_ENV: deployEnvironment,
        VITE_API_URL: STAGING_API,
        VITE_GOOGLE_CLIENT_ID: STAGING_CLIENT_ID,
      })),
      FrontendEnvironmentPolicyError,
      deployEnvironment,
    );
  }
});

test('fixed staging Pages branch fails closed when explicit configuration is missing', () => {
  const cli = runCli({
    CF_PAGES: '1',
    CF_PAGES_BRANCH: STAGING_BRANCH,
  });
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /requires VITE_DEPLOY_ENV=staging/);
  assert.match(cli.stderr, /VITE_API_URL is required/);
  assert.match(cli.stderr, /VITE_GOOGLE_CLIENT_ID is required/);
});

test('fixed staging Pages branch accepts only the reviewed staging configuration', () => {
  const result = validateFrontendEnvironment(cleanEnvironment(validStaging()));
  assert.equal(result.context, 'pages-staging');
  assert.equal(result.deployEnvironment, 'staging');
  assert.equal(result.pagesBranch, STAGING_BRANCH);

  const cli = runCli(validStaging());
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /pages-staging/);
});

test('arbitrary feature and pull-request Pages branches remain disabled even with valid staging values', () => {
  for (const pagesBranch of ['feature/isolated-preview', 'pull/102', 'pr10d2b-fixed-staging-frontend']) {
    const cli = runCli(validStaging({ CF_PAGES_BRANCH: pagesBranch }));
    assert.notEqual(cli.status, 0, pagesBranch);
    assert.match(cli.stderr, /disabled except for the fixed staging branch/, pagesBranch);
  }
});

test('fixed staging branch rejects arbitrary and production API origins', () => {
  for (const apiUrl of [
    'https://another-staging-worker.example.workers.dev',
    PRODUCTION_API,
  ]) {
    const cli = runCli(validStaging({ VITE_API_URL: apiUrl }));
    assert.notEqual(cli.status, 0, apiUrl);
    assert.match(cli.stderr, /fixed staging API origin/, apiUrl);
  }
});

test('fixed staging branch rejects the production or malformed Google OAuth client', () => {
  for (const clientId of [PRODUCTION_CLIENT_ID, 'not-a-google-client']) {
    assert.throws(
      () => validateFrontendEnvironment(cleanEnvironment(validStaging({
        VITE_GOOGLE_CLIENT_ID: clientId,
      }))),
      FrontendEnvironmentPolicyError,
      clientId,
    );
  }
});

test('staging API must be an exact HTTPS non-local origin', () => {
  const invalidUrls = [
    'http://journal-backend-staging.chired.workers.dev',
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

test('dedicated staging builds outside Pages use the same fixed staging policy', () => {
  const result = validateFrontendEnvironment(cleanEnvironment({
    VITE_DEPLOY_ENV: 'staging',
    VITE_API_URL: STAGING_API,
    VITE_GOOGLE_CLIENT_ID: STAGING_CLIENT_ID,
  }));
  assert.equal(result.context, 'staging');
});

test('preview mode is no longer a reviewed deploy environment', () => {
  assert.throws(
    () => validateFrontendEnvironment(cleanEnvironment({
      VITE_DEPLOY_ENV: 'preview',
      VITE_API_URL: STAGING_API,
      VITE_GOOGLE_CLIENT_ID: STAGING_CLIENT_ID,
    })),
    (error) => error instanceof FrontendEnvironmentPolicyError
      && error.errors.some((message) => message.includes('not one of the reviewed')),
  );
});

test('generic preview environment example is retired and cannot re-enable preview mode', async () => {
  const example = await readFile(new URL('../.env.preview.example', import.meta.url), 'utf8');
  assert.match(example, /arbitrary Cloudflare Pages preview branches are intentionally disabled/);
  assert.match(example, /STAGING_FRONTEND_CONTRACT\.md/);
  assert.doesNotMatch(example, /^VITE_DEPLOY_ENV=/m);
  assert.doesNotMatch(example, /^VITE_API_URL=/m);
  assert.doesNotMatch(example, /^VITE_GOOGLE_CLIENT_ID=/m);
});

test('machine-readable contract fixes staging branch, frontend, and API identities', () => {
  assert.equal(DEPLOYMENT_CONTRACT.staging.pages_branch, 'staging');
  assert.equal(
    DEPLOYMENT_CONTRACT.staging.frontend_origin,
    'https://staging.sheet-trading-journal.pages.dev',
  );
  assert.equal(
    DEPLOYMENT_CONTRACT.staging.api_origin,
    'https://journal-backend-staging.chired.workers.dev',
  );
  assert.equal(DEPLOYMENT_CONTRACT.non_production.allow_arbitrary_pages_branches, false);
  assert.deepEqual(DEPLOYMENT_CONTRACT.non_production.allowed_deploy_environments, ['staging']);
  assert.ok(!DEPLOYMENT_CONTRACT.allowed_deploy_environments.includes('preview'));
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
