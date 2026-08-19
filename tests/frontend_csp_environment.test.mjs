import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VITE_BIN = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const CONTRACT = JSON.parse(
  await readFile(new URL('../config/deployment-environments.json', import.meta.url), 'utf8'),
);
const TOKEN = '__TRADING_JOURNAL_API_ORIGIN__';
const PRODUCTION_API = CONTRACT.production.api_origins[0];
const PRODUCTION_CLIENT_ID = CONTRACT.production.google_client_ids[0];
const DEPLOYMENT_KEYS = [
  'CF_PAGES',
  'CF_PAGES_BRANCH',
  'VITE_DEPLOY_ENV',
  'VITE_API_URL',
  'VITE_GOOGLE_CLIENT_ID',
];

function cleanEnvironment(overrides = {}) {
  const environment = { ...process.env };
  for (const key of DEPLOYMENT_KEYS) delete environment[key];
  return { ...environment, ...overrides };
}

function extractMetaCsp(html) {
  const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)">/i);
  assert.ok(match, 'index.html must contain a meta Content-Security-Policy');
  return match[1].replace(/\s+/g, ' ').trim();
}

function extractHeaderCsp(headers) {
  const match = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m);
  assert.ok(match, '_headers must contain Content-Security-Policy');
  return match[1].trim();
}

function connectSources(policy) {
  const match = policy.match(/(?:^|;)\s*connect-src\s+([^;]+)/);
  assert.ok(match, 'CSP must contain connect-src');
  return new Set(match[1].trim().split(/\s+/));
}

async function buildFrontend(overrides = {}) {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), 'journal-csp-build-'));
  const result = spawnSync(
    process.execPath,
    [VITE_BIN, 'build', '--outDir', outputDirectory],
    {
      cwd: ROOT,
      env: cleanEnvironment(overrides),
      encoding: 'utf8',
      timeout: 120_000,
    },
  );

  try {
    assert.equal(
      result.status,
      0,
      `Vite build failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
    return {
      html: await readFile(path.join(outputDirectory, 'index.html'), 'utf8'),
      headers: await readFile(path.join(outputDirectory, '_headers'), 'utf8'),
    };
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

function assertProductionCsp({ html, headers }) {
  const metaPolicy = extractMetaCsp(html);
  const headerPolicy = extractHeaderCsp(headers);
  const metaConnect = connectSources(metaPolicy);
  const headerConnect = connectSources(headerPolicy);

  assert.ok(metaConnect.has(PRODUCTION_API), `meta CSP must allow ${PRODUCTION_API}`);
  assert.ok(headerConnect.has(PRODUCTION_API), `header CSP must allow ${PRODUCTION_API}`);
  assert.doesNotMatch(html, new RegExp(TOKEN));
  assert.doesNotMatch(headers, new RegExp(TOKEN));
}

test('source CSP surfaces use one API-origin token instead of a hardcoded production identity', async () => {
  const [indexHtml, headers] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/_headers', import.meta.url), 'utf8'),
  ]);

  for (const [label, source] of [['index.html', indexHtml], ['public/_headers', headers]]) {
    assert.equal(source.split(TOKEN).length - 1, 1, `${label} must contain the CSP API token exactly once`);
    assert.doesNotMatch(source, new RegExp(PRODUCTION_API.replaceAll('.', '\\.')));
  }

  assert.match(indexHtml, /'unsafe-inline'/);
  assert.match(indexHtml, /'unsafe-eval'/);
  assert.match(headers, /'unsafe-inline'/);
  assert.match(headers, /'unsafe-eval'/);
});

test('production-compatible build renders the reviewed production API into both enforced CSP surfaces', async () => {
  const output = await buildFrontend();
  assertProductionCsp(output);
});

test('explicit production build renders the same reviewed production API', async () => {
  const output = await buildFrontend({
    VITE_DEPLOY_ENV: 'production',
    VITE_API_URL: PRODUCTION_API,
    VITE_GOOGLE_CLIENT_ID: PRODUCTION_CLIENT_ID,
  });
  assertProductionCsp(output);
});

test('CSP wiring keeps non-main Pages builds fail-closed after staging retirement', async () => {
  const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(viteConfig, /createFrontendCspPlugin/);
  assert.match(viteConfig, /validateFrontendEnvironment\(process\.env\)/);
  assert.match(viteConfig, /plugins:\s*\[vue\(\),\s*createFrontendCspPlugin/);

  const previewOutput = await mkdtemp(path.join(tmpdir(), 'journal-csp-preview-'));
  const result = spawnSync(
    process.execPath,
    [VITE_BIN, 'build', '--outDir', previewOutput],
    {
      cwd: ROOT,
      env: cleanEnvironment({
        CF_PAGES: '1',
        CF_PAGES_BRANCH: 'feature/arbitrary-preview',
        VITE_DEPLOY_ENV: 'production',
        VITE_API_URL: PRODUCTION_API,
        VITE_GOOGLE_CLIENT_ID: PRODUCTION_CLIENT_ID,
      }),
      encoding: 'utf8',
      timeout: 120_000,
    },
  );
  await rm(previewOutput, { recursive: true, force: true });

  assert.notEqual(result.status, 0, 'non-main Pages build must remain fail-closed');
  assert.match(`${result.stdout}\n${result.stderr}`, /non-main builds are disabled/);
});
