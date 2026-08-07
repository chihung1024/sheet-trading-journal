import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config', 'deployment-environments.json'), 'utf8'),
);

const STAGING_FRONTEND = CONTRACT.staging.frontend_origin;
const STAGING_API = CONTRACT.staging.api_origin;
const PRODUCTION_FRONTENDS = new Set(CONTRACT.production.frontend_origins);
const PRODUCTION_APIS = new Set(CONTRACT.production.api_origins);

const requiredFiles = {
  workflow: '.github/workflows/staging-browser-smoke.yml',
  package: 'e2e/package.json',
  config: 'e2e/playwright.config.mjs',
  smoke: 'e2e/staging-smoke.spec.mjs',
  tokenHelper: 'tools/mint_staging_e2e_id_token.mjs',
};

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertNoProductionIdentity(source, label) {
  for (const origin of [...PRODUCTION_FRONTENDS, ...PRODUCTION_APIS]) {
    assert.ok(!source.includes(origin), `${label} must not hardcode production origin ${origin}`);
  }
}

test('PR-10D3C implementation files exist', () => {
  for (const [label, relativePath] of Object.entries(requiredFiles)) {
    assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `${label} is missing: ${relativePath}`);
  }
});

test('staging browser workflow is manual, protected, exact-SHA, and credential fail-closed', () => {
  const workflow = read(requiredFiles.workflow);

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment:\s*staging/);
  assert.match(workflow, /source_sha:/);
  assert.match(workflow, /\^\[0-9a-fA-F\]\{40\}\$/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /git rev-parse origin\/staging/);
  assert.match(workflow, /verify_staging_worker_deployment\.mjs/);
  assert.match(workflow, /EXPECTED_SHA:\s*\$\{\{ inputs\.source_sha \}\}/);
  assert.match(workflow, /STAGING_GOOGLE_CLIENT_ID/);
  assert.match(workflow, /STAGING_E2E_GOOGLE_CLIENT_SECRET/);
  assert.match(workflow, /STAGING_E2E_GOOGLE_REFRESH_TOKEN/);
  assert.match(workflow, /STAGING_E2E_EXPECTED_GOOGLE_SUB/);
  assert.match(workflow, /mint_staging_e2e_id_token\.mjs/);
  assert.match(workflow, /playwright\s+install[^\n]*chromium/);
  assert.match(workflow, /staging-smoke\.spec\.mjs/);
  assert.match(workflow, /STAGING_E2E_GOOGLE_CLIENT_ID:\s*\$\{\{ secrets\.STAGING_GOOGLE_CLIENT_ID \}\}/);
  assert.match(workflow, /always\(\)/);
  assert.match(workflow, /rm\s+-f/);
  assertNoProductionIdentity(workflow, 'staging-browser-smoke workflow');

  const jobEnv = workflow.match(/\n    env:\n([\s\S]*?)\n    steps:/);
  assert.ok(jobEnv, 'workflow must have a bounded non-secret job env block');
  assert.doesNotMatch(jobEnv[1], /STAGING_E2E_GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(jobEnv[1], /STAGING_E2E_GOOGLE_REFRESH_TOKEN/);
  assert.doesNotMatch(
    jobEnv[1],
    /\$\{\{\s*runner\./,
    'runner context is not valid in job-level env and must be resolved at step runtime',
  );
  assert.match(workflow, /- name: Mint fresh Google ID token[\s\S]*?env:[\s\S]*?STAGING_E2E_GOOGLE_CLIENT_SECRET/);
  assert.match(workflow, /- name: Mint fresh Google ID token[\s\S]*?env:[\s\S]*?STAGING_E2E_GOOGLE_REFRESH_TOKEN/);
});

test('OAuth refresh helper validates fresh Google ID-token identity without logging the token', () => {
  const helper = read(requiredFiles.tokenHelper);

  assert.match(helper, /https:\/\/oauth2\.googleapis\.com\/token/);
  assert.match(helper, /grant_type[^\n]*refresh_token/);
  assert.match(helper, /STAGING_GOOGLE_CLIENT_ID/);
  assert.match(helper, /STAGING_E2E_GOOGLE_CLIENT_SECRET/);
  assert.match(helper, /STAGING_E2E_GOOGLE_REFRESH_TOKEN/);
  assert.match(helper, /STAGING_E2E_EXPECTED_GOOGLE_SUB/);
  assert.match(helper, /payload\.aud/);
  assert.match(helper, /payload\.sub/);
  assert.match(helper, /payload\.exp/);
  assert.match(helper, /writeFile/);
  assert.doesNotMatch(helper, /console\.log\([^\n]*(?:idToken|id_token|tokenResponse\.id_token)/);
});

test('Playwright smoke derives staging identities from environment and blocks production network traffic', () => {
  const config = read(requiredFiles.config);
  const smoke = read(requiredFiles.smoke);
  const pkg = JSON.parse(read(requiredFiles.package));

  assert.equal(pkg.private, true);
  assert.equal(pkg.devDependencies['@playwright/test'], '1.62.0');
  assert.match(config, /STAGING_E2E_BASE_URL/);
  assert.match(smoke, /STAGING_E2E_API_ORIGIN/);
  assert.match(smoke, /STAGING_E2E_GOOGLE_CLIENT_ID/);
  assert.match(smoke, /__stagingE2eObservedGoogleClientId/);
  assert.match(smoke, /toBe\(stagingGoogleClientId\)/);
  assert.match(smoke, /STAGING_E2E_ID_TOKEN_FILE/);
  assert.match(smoke, /page\.addInitScript|context\.addInitScript/);
  assert.match(smoke, /google/);
  assert.match(smoke, /\/api\/records/);
  assert.match(smoke, /browserApi\(page,\s*['"]POST['"]/);
  assert.match(smoke, /browserApi\(page,\s*['"]PUT['"]/);
  assert.match(smoke, /browserApi\(page,\s*['"]DELETE['"]/);
  assert.doesNotMatch(smoke, /\.\.\.createdMatches\[0\]/);
  assert.match(smoke, /fallbackCleanup\(request,\s*createdRecordId\)/);
  assert.match(smoke, /request\.delete\(`\$\{stagingApi\}\/api\/records`/);
  assert.match(smoke, /finally/);
  assert.match(smoke, /logout/i);
  assert.match(smoke, /request/);
  assertNoProductionIdentity(config, 'Playwright config');
  assertNoProductionIdentity(smoke, 'Playwright smoke');

  assert.equal(STAGING_FRONTEND, 'https://staging.sheet-trading-journal.pages.dev');
  assert.equal(STAGING_API, 'https://journal-backend-staging.chired.workers.dev');
});
