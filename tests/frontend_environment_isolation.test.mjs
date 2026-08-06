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
const STAGING_API = 'https://journal-backend-staging.example.workers.dev';
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

function validPreview(overrides = {}) {
  return {
    CF_PAGES: '1',
    CF_PAGES_BRANCH: 'feature/isolated-preview',
    VITE_DEPLOY_ENV: 'preview',
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

test('main Pages build rejects a non-production environment declaration', () => {
  assert.throws(
    () => validateFrontendEnvironment(cleanEnvironment({
      CF_PAGES: '1',
      CF_PAGES_BRANCH: 'main',
      VITE_DEPLOY_ENV: 'preview',
      VITE_API_URL: STAGING_API,
      VITE_GOOGLE_CLIENT_ID: STAGING_CLIENT_ID,
    })),
    (error) => error instanceof FrontendEnvironmentPolicyError
      && error.errors.some((message) => message.includes('main Cloudflare Pages branch')),
  );
});

test('non-main Pages builds fail closed when isolated configuration is missing', () => {
  const cli = runCli({
    CF_PAGES: '1',
    CF_PAGES_BRANCH: 'feature/missing-isolation',
  });
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /VITE_DEPLOY_ENV=preview or staging/);
  assert.match(cli.stderr, /VITE_API_URL is required/);
  assert.match(cli.stderr, /VITE_GOOGLE_CLIENT_ID is required/);
});

test('non-main Pages builds reject the production API origin', () => {
  const cli = runCli(validPreview({ VITE_API_URL: PRODUCTION_API }));
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /cannot use a production API origin/);
});

test('non-main Pages builds reject the production Google OAuth client', () => {
  const cli = runCli(validPreview({ VITE_GOOGLE_CLIENT_ID: PRODUCTION_CLIENT_ID }));
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /cannot use a production Google OAuth client/);
});

test('non-main Pages builds accept an explicit isolated staging configuration', () => {
  const result = validateFrontendEnvironment(cleanEnvironment(validPreview()));
  assert.equal(result.context, 'pages-preview');
  assert.equal(result.deployEnvironment, 'preview');

  const cli = runCli(validPreview());
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /pages-preview/);
});

test('dedicated staging builds outside Pages use the same strict policy', () => {
  const result = validateFrontendEnvironment(cleanEnvironment({
    VITE_DEPLOY_ENV: 'staging',
    VITE_API_URL: STAGING_API,
    VITE_GOOGLE_CLIENT_ID: STAGING_CLIENT_ID,
  }));
  assert.equal(result.context, 'staging');
});

test('deployed non-production API URLs must be exact HTTPS non-local origins', () => {
  const invalidUrls = [
    'http://journal-backend-staging.example.workers.dev',
    'https://localhost',
    'https://127.0.0.1',
    `${STAGING_API}/api`,
    `${STAGING_API}/`,
    `${STAGING_API}?environment=staging`,
    `${STAGING_API}#staging`,
    'https://user:password@journal-backend-staging.example.workers.dev',
  ];

  for (const apiUrl of invalidUrls) {
    assert.throws(
      () => validateFrontendEnvironment(cleanEnvironment(validPreview({ VITE_API_URL: apiUrl }))),
      FrontendEnvironmentPolicyError,
      apiUrl,
    );
  }
});

test('unsupported environment names and malformed OAuth clients fail closed', () => {
  assert.throws(
    () => validateFrontendEnvironment(cleanEnvironment(validPreview({ VITE_DEPLOY_ENV: 'qa' }))),
    FrontendEnvironmentPolicyError,
  );
  assert.throws(
    () => validateFrontendEnvironment(cleanEnvironment(validPreview({
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
