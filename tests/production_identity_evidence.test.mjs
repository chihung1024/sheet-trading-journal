import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { collectProductionIdentityEvidence } from '../tools/collect_production_identity_evidence.mjs';

const ACCOUNT_ID = '0123456789abcdef0123456789abcdef';
const D1_ID = '11111111-1111-4111-8111-111111111111';
const SHA = '3024dde0ea148a3997782614da5ca8100462d010';
const STALE_SHA = '6bf0f4002ac6ed7fead64d49084ac31c1d33fb39';
const TOKEN = 'cf-test-token-abcdefghijklmnopqrstuvwxyz';
const PROD_FRONTEND = 'https://sheet-trading-journal.pages.dev';
const PROD_API = 'https://journal-backend.chired.workers.dev';
const STAGING_API = 'https://journal-backend-staging.chired.workers.dev';
const CLIENT_ID = '951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com';
const WORKER_SCRIPT = 'journal-backend';
const D1_BINDING = 'DB';
const VERSION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VERSION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function contract() {
  return {
    main_branch: 'main',
    production: {
      frontend_origins: [PROD_FRONTEND],
      api_origins: [PROD_API],
      google_client_ids: [CLIENT_ID],
    },
    staging: {
      api_origin: STAGING_API,
      d1_database_name: 'trading-journal-staging',
    },
  };
}

function pagesProject(overrides = {}) {
  return {
    name: 'sheet-trading-journal',
    subdomain: 'sheet-trading-journal.pages.dev',
    production_branch: 'main',
    deployment_configs: {
      production: {
        env_vars: {
          VITE_DEPLOY_ENV: { type: 'plain_text', value: 'production' },
          VITE_API_URL: { type: 'plain_text', value: PROD_API },
          VITE_GOOGLE_CLIENT_ID: { type: 'plain_text', value: CLIENT_ID },
        },
      },
    },
    canonical_deployment: {
      environment: 'production',
      latest_stage: { status: 'success' },
      deployment_trigger: {
        metadata: { branch: 'main', commit_hash: SHA },
      },
    },
    ...overrides,
  };
}

function liveHtml() {
  const csp = `default-src 'self'; connect-src 'self' ${PROD_API}; object-src 'none'`;
  return {
    html: `<html><head><meta content="${csp}" http-equiv="Content-Security-Policy"></head></html>`,
    csp,
  };
}

function versionDetail(databaseId = D1_ID) {
  return {
    success: true,
    result: {
      resources: {
        bindings: [
          { type: 'd1', name: D1_BINDING, database_id: databaseId },
          { type: 'plain_text', name: 'DEPLOYMENT_ENVIRONMENT', text: 'production' },
        ],
      },
    },
  };
}

function mockFetch({
  d1Name = 'trading-journal-production',
  pages = pagesProject(),
  frontendStatus = 200,
  versionDatabaseIds = { [VERSION_A]: D1_ID, [VERSION_B]: D1_ID },
} = {}) {
  const { html, csp } = liveHtml();
  return async (url, options = {}) => {
    const target = String(url);
    assert.equal(options.method || 'GET', 'GET', `non-GET request attempted: ${target}`);

    if (target.includes('/d1/database/')) {
      return new Response(JSON.stringify({ success: true, result: { uuid: D1_ID, name: d1Name } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.includes('/pages/projects/')) {
      return new Response(JSON.stringify({ success: true, result: pages }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith(`/workers/scripts/${WORKER_SCRIPT}/deployments`)) {
      return new Response(JSON.stringify({
        success: true,
        result: {
          deployments: [
            {
              versions: [
                { percentage: 80, version_id: VERSION_A },
                { percentage: 20, version_id: VERSION_B },
              ],
            },
          ],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const versionMatch = target.match(/\/workers\/scripts\/journal-backend\/versions\/([^/?]+)$/);
    if (versionMatch) {
      const versionId = decodeURIComponent(versionMatch[1]);
      const databaseId = versionDatabaseIds[versionId];
      if (!databaseId) throw new Error(`unexpected Worker version: ${versionId}`);
      return new Response(JSON.stringify(versionDetail(databaseId)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target === PROD_FRONTEND) {
      assert.equal(options.redirect, 'manual');
      return new Response(html, {
        status: frontendStatus,
        headers: { 'content-type': 'text/html', 'content-security-policy': csp },
      });
    }
    throw new Error(`unexpected fetch: ${target}`);
  };
}

async function collect(overrides = {}) {
  return collectProductionIdentityEvidence({
    contract: contract(),
    accountId: ACCOUNT_ID,
    apiToken: TOKEN,
    d1DatabaseId: D1_ID,
    evidenceSourceSha: SHA,
    workerScriptName: WORKER_SCRIPT,
    d1BindingName: D1_BINDING,
    collectedAt: '2026-08-07T08:50:00.000Z',
    fetchImpl: mockFetch(),
    ...overrides,
  });
}

test('read-only collector triangulates D1 identity across secret lookup, D1 API, and all active Worker versions', async () => {
  const result = await collect();
  assert.equal(result.status, 'passed', JSON.stringify(result.errors));
  assert.deepEqual(result.errors, []);
  assert.equal(result.production_d1.database_name, 'trading-journal-production');
  assert.match(result.production_d1.database_id_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.production_d1.worker_binding_name, D1_BINDING);
  assert.equal(result.production_d1.active_versions_checked, 2);
  assert.equal(result.production_worker.active_versions, 2);
  assert.equal(result.production_worker.binding_versions_matched, 2);
  assert.equal(result.production_pages.project_name, 'sheet-trading-journal');
  assert.equal(result.production_pages.canonical_deployment_commit, SHA);
  assert.equal(result.checks.worker_active_d1_bindings_match_protected_id, true);
  assert.equal(result.checks.canonical_deployment_exact_audited_sha, true);
  assert.equal(result.checks.pages_explicit_production_environment, true);
  assert.equal(result.checks.live_csp_allows_production_api, true);
  assert.equal(result.checks.live_csp_rejects_staging_api, true);

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, new RegExp(D1_ID.replaceAll('-', '\\-')));
  assert.doesNotMatch(serialized, new RegExp(ACCOUNT_ID));
  assert.doesNotMatch(serialized, new RegExp(TOKEN));
  assert.doesNotMatch(serialized, new RegExp(VERSION_A));
  assert.doesNotMatch(serialized, new RegExp(VERSION_B));
});

test('collector rejects a mixed gradual deployment when any serving Worker version uses another D1', async () => {
  const result = await collect({
    fetchImpl: mockFetch({
      versionDatabaseIds: {
        [VERSION_A]: D1_ID,
        [VERSION_B]: '22222222-2222-4222-8222-222222222222',
      },
    }),
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.production_worker.binding_versions_matched, 1);
  assert.match(result.errors.join('\n'), /active Worker DB binding does not match/);
});

test('collector rejects Pages production fallback, wrong explicit values, or a stale canonical deployment', async () => {
  const missingEnv = pagesProject();
  delete missingEnv.deployment_configs.production.env_vars.VITE_DEPLOY_ENV;
  const missing = await collect({ fetchImpl: mockFetch({ pages: missingEnv }) });
  assert.equal(missing.status, 'failed');
  assert.match(missing.errors.join('\n'), /VITE_DEPLOY_ENV/);

  const wrongApi = pagesProject();
  wrongApi.deployment_configs.production.env_vars.VITE_API_URL.value = STAGING_API;
  const wrong = await collect({ fetchImpl: mockFetch({ pages: wrongApi }) });
  assert.equal(wrong.status, 'failed');
  assert.match(wrong.errors.join('\n'), /VITE_API_URL/);

  const stale = pagesProject({
    canonical_deployment: {
      environment: 'production',
      latest_stage: { status: 'success' },
      deployment_trigger: { metadata: { branch: 'main', commit_hash: STALE_SHA } },
    },
  });
  const staleResult = await collect({ fetchImpl: mockFetch({ pages: stale }) });
  assert.equal(staleResult.status, 'failed');
  assert.match(staleResult.errors.join('\n'), /does not equal the audited protected-main SHA/);
});

test('collector rejects staging D1 identity and missing live CSP enforcement', async () => {
  const stagingD1 = await collect({ fetchImpl: mockFetch({ d1Name: 'trading-journal-staging' }) });
  assert.equal(stagingD1.status, 'failed');
  assert.match(stagingD1.errors.join('\n'), /staging D1 name/);

  const noHeader = async (url, options = {}) => {
    const base = mockFetch();
    if (String(url) !== PROD_FRONTEND) return base(url, options);
    const { html } = liveHtml();
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const missingCsp = await collect({ fetchImpl: noHeader });
  assert.equal(missingCsp.status, 'failed');
  assert.match(missingCsp.errors.join('\n'), /missing Content-Security-Policy header/);
});

test('workflow is reviewer-protected, GET-only, and does not trust the D1 name secret as authority', async () => {
  const workflow = await readFile('.github/workflows/production-identity-evidence.yml', 'utf8');
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /source_sha:/);
  assert.match(workflow, /test "\$\(git rev-parse refs\/remotes\/origin\/main\)" = "\$REQUESTED_SHA"/);
  assert.match(workflow, /collect_production_identity_evidence\.mjs/);
  assert.match(workflow, /actions\/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f/);
  assert.doesNotMatch(workflow, /CLOUDFLARE_D1_DATABASE_NAME/);
  assert.doesNotMatch(workflow, /wrangler\s+(?:deploy|d1)/i);
  assert.doesNotMatch(workflow, /\b(?:POST|PATCH|PUT|DELETE)\b/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
});
