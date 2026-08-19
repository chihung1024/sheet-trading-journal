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

test('ordinary local and CI builds remain compatible without deployment variables', () => {
  const result = validateFrontendEnvironment(cleanEnvironment());
  assert.equal(result.context, 'local-or-ci');
  assert.equal(result.configurationMode, 'explicit');

  const cli = runCli();
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /local-or-ci/);
});

test('main Pages production build retains the current production fallback', () => {
  const result = validateFrontendEnvironment(cleanEnvironment({
    CF_PAGES: '1',
    CF_PAGES_BRANCH: DEPLOYMENT_CONTRACT.main_branch,
  }));
  assert.equal(result.context, 'pages-production');
  assert.equal(result.configurationMode, 'legacy-production-fallback');
});

test('all non-main Cloudflare Pages builds are disabled in the frozen terminal source', () => {
  for (const pagesBranch of ['staging', 'feature/isolated-preview', 'pull/392']) {
    const cli = runCli({
      CF_PAGES: '1',
      CF_PAGES_BRANCH: pagesBranch,
      VITE_DEPLOY_ENV: 'production',
      VITE_API_URL: PRODUCTION_API,
      VITE_GOOGLE_CLIENT_ID: PRODUCTION_CLIENT_ID,
    });
    assert.notEqual(cli.status, 0, pagesBranch);
    assert.match(cli.stderr, /non-main builds are disabled/, pagesBranch);
  }
});

test('only production is an accepted explicit deploy environment', () => {
  for (const deployEnvironment of ['staging', 'preview', 'qa', 'test', 'development']) {
    assert.throws(
      () => validateFrontendEnvironment(cleanEnvironment({ VITE_DEPLOY_ENV: deployEnvironment })),
      (error) => error instanceof FrontendEnvironmentPolicyError
        && error.errors.some((message) => message.includes('not one of the terminal deployment environments')),
      deployEnvironment,
    );
  }
  assert.deepEqual(DEPLOYMENT_CONTRACT.allowed_deploy_environments, ['production']);
  assert.equal(Object.hasOwn(DEPLOYMENT_CONTRACT, 'staging'), false);
  assert.equal(Object.hasOwn(DEPLOYMENT_CONTRACT, 'non_production'), false);
});

test('explicit production requires exact reviewed API and Google OAuth identities', () => {
  const accepted = validateFrontendEnvironment(cleanEnvironment({
    VITE_DEPLOY_ENV: 'production',
    VITE_API_URL: PRODUCTION_API,
    VITE_GOOGLE_CLIENT_ID: PRODUCTION_CLIENT_ID,
  }));
  assert.equal(accepted.context, 'explicit-production');

  for (const overrides of [
    { VITE_DEPLOY_ENV: 'production' },
    {
      VITE_DEPLOY_ENV: 'production',
      VITE_API_URL: 'https://unreviewed.example.com',
      VITE_GOOGLE_CLIENT_ID: PRODUCTION_CLIENT_ID,
    },
    {
      VITE_DEPLOY_ENV: 'production',
      VITE_API_URL: PRODUCTION_API,
      VITE_GOOGLE_CLIENT_ID: '123456789012-unreviewed.apps.googleusercontent.com',
    },
  ]) {
    assert.throws(
      () => validateFrontendEnvironment(cleanEnvironment(overrides)),
      FrontendEnvironmentPolicyError,
    );
  }
});

test('production API must be an exact HTTPS non-local origin', () => {
  const invalidUrls = [
    'http://journal-backend.chired.workers.dev',
    'https://localhost',
    'https://127.0.0.1',
    `${PRODUCTION_API}/api`,
    `${PRODUCTION_API}/`,
    `${PRODUCTION_API}?environment=production`,
    `${PRODUCTION_API}#production`,
    'https://user:password@journal-backend.chired.workers.dev',
  ];

  for (const apiUrl of invalidUrls) {
    assert.throws(
      () => validateFrontendEnvironment(cleanEnvironment({
        VITE_DEPLOY_ENV: 'production',
        VITE_API_URL: apiUrl,
        VITE_GOOGLE_CLIENT_ID: PRODUCTION_CLIENT_ID,
      })),
      FrontendEnvironmentPolicyError,
      apiUrl,
    );
  }
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
