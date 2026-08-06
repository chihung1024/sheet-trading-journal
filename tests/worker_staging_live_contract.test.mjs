import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const STAGING_ORIGIN = 'https://staging.sheet-trading-journal.pages.dev';
const PRODUCTION_ORIGIN = 'https://sheet-trading-journal.pages.dev';
const ARBITRARY_PREVIEW_ORIGIN = 'https://feature-123.sheet-trading-journal.pages.dev';
const GITHUB_PAGES_ORIGIN = 'https://chihung1024.github.io';
const LOCAL_ORIGIN = 'http://localhost:5173';

test('staging Wrangler template explicitly disables version preview URLs', async () => {
  const config = await readFile('ops/staging/wrangler.toml', 'utf8');
  assert.match(config, /^workers_dev = true$/m);
  assert.match(config, /^preview_urls = false$/m);
});

test('staging deployment verifies the live browser-origin boundary after readiness', async () => {
  const workflow = await readFile('.github/workflows/deploy-worker-staging.yml', 'utf8');
  const readinessIndex = workflow.indexOf('Verify exact staging deployment readiness');
  const liveCorsIndex = workflow.indexOf('Verify live staging browser-origin isolation');

  assert.notEqual(readinessIndex, -1);
  assert.ok(liveCorsIndex > readinessIndex);
  assert.match(workflow, /tools\/verify_staging_cors_deployment\.mjs/);

  for (const origin of [
    STAGING_ORIGIN,
    PRODUCTION_ORIGIN,
    ARBITRARY_PREVIEW_ORIGIN,
    GITHUB_PAGES_ORIGIN,
    LOCAL_ORIGIN,
  ]) {
    assert.ok(workflow.includes(origin), `missing live CORS probe for ${origin}`);
  }
});
