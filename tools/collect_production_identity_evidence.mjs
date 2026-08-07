import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ACCOUNT_RE = /^[0-9a-f]{32}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_RE = /^[0-9a-f]{40}$/;
const API_ROOT = 'https://api.cloudflare.com/client/v4';

export async function collectProductionIdentityEvidence({
  contract,
  accountId,
  apiToken,
  d1DatabaseId,
  evidenceSourceSha,
  fetchImpl = fetch,
  collectedAt = new Date().toISOString(),
}) {
  const errors = [];
  const production = contract?.production;
  const staging = contract?.staging;

  if (!production || typeof production !== 'object' || Array.isArray(production)) {
    errors.push('production deployment contract is missing');
  }
  if (!ACCOUNT_RE.test(String(accountId || ''))) errors.push('Cloudflare account ID is invalid');
  if (!UUID_RE.test(String(d1DatabaseId || ''))) errors.push('production D1 database ID is invalid');
  if (!SHA_RE.test(String(evidenceSourceSha || ''))) errors.push('evidence source SHA must be an exact lowercase Git SHA');
  if (typeof apiToken !== 'string' || apiToken.length < 20) errors.push('Cloudflare API token is missing or invalid');

  const primaryFrontendOrigin = production?.frontend_origins?.[0];
  const productionApiOrigin = production?.api_origins?.[0];
  const productionClientId = production?.google_client_ids?.[0];
  const stagingApiOrigin = staging?.api_origin;

  let frontendUrl;
  let pagesProjectName;
  try {
    frontendUrl = new URL(primaryFrontendOrigin);
    if (frontendUrl.protocol !== 'https:' || !frontendUrl.hostname.endsWith('.pages.dev')) {
      errors.push('primary production frontend origin must be an HTTPS pages.dev origin');
    } else {
      pagesProjectName = frontendUrl.hostname.slice(0, -'.pages.dev'.length);
    }
  } catch {
    errors.push('primary production frontend origin is invalid');
  }

  if (errors.length) return failedResult(errors, evidenceSourceSha, collectedAt);

  const authHeaders = Object.freeze({ Authorization: `Bearer ${apiToken}` });
  const d1Envelope = await getCloudflareJson(
    `${API_ROOT}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(d1DatabaseId)}`,
    authHeaders,
    fetchImpl,
    'D1 database',
  );
  const pagesEnvelope = await getCloudflareJson(
    `${API_ROOT}/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(pagesProjectName)}`,
    authHeaders,
    fetchImpl,
    'Pages project',
  );

  const d1 = d1Envelope.result;
  const pages = pagesEnvelope.result;
  const observedD1Id = String(d1?.uuid || '').toLowerCase();
  const observedD1Name = String(d1?.name || '').trim();
  if (!UUID_RE.test(observedD1Id) || observedD1Id !== String(d1DatabaseId).toLowerCase()) {
    errors.push('Cloudflare D1 response UUID does not match the protected production D1 ID');
  }
  if (!observedD1Name) errors.push('Cloudflare D1 response is missing database name');
  if (observedD1Name && observedD1Name === staging?.d1_database_name) {
    errors.push('Cloudflare production D1 resolves to the reviewed staging D1 name');
  }

  if (String(pages?.name || '') !== pagesProjectName) errors.push('Cloudflare Pages project name mismatch');
  if (String(pages?.subdomain || '') !== frontendUrl.hostname) errors.push('Cloudflare Pages project subdomain mismatch');
  if (String(pages?.production_branch || '') !== contract.main_branch) errors.push('Cloudflare Pages production branch is not protected main');

  const productionVars = pages?.deployment_configs?.production?.env_vars;
  const deployEnv = readPlainTextVar(productionVars, 'VITE_DEPLOY_ENV');
  const apiUrl = readPlainTextVar(productionVars, 'VITE_API_URL');
  const clientId = readPlainTextVar(productionVars, 'VITE_GOOGLE_CLIENT_ID');
  if (deployEnv !== 'production') errors.push('Cloudflare Pages production VITE_DEPLOY_ENV is not explicit production');
  if (apiUrl !== productionApiOrigin) errors.push('Cloudflare Pages production VITE_API_URL does not match reviewed production API origin');
  if (clientId !== productionClientId) errors.push('Cloudflare Pages production VITE_GOOGLE_CLIENT_ID does not match reviewed production client');

  const canonical = pages?.canonical_deployment;
  const canonicalCommit = String(canonical?.deployment_trigger?.metadata?.commit_hash || '').toLowerCase();
  const canonicalBranch = String(canonical?.deployment_trigger?.metadata?.branch || '');
  const canonicalEnvironment = String(canonical?.environment || '');
  const canonicalStatus = String(canonical?.latest_stage?.status || '');
  if (canonicalEnvironment !== 'production') errors.push('Cloudflare Pages canonical deployment is not production');
  if (canonicalBranch !== contract.main_branch) errors.push('Cloudflare Pages canonical deployment was not triggered from protected main');
  if (!SHA_RE.test(canonicalCommit)) errors.push('Cloudflare Pages canonical deployment commit hash is missing or malformed');
  if (canonicalStatus !== 'success') errors.push('Cloudflare Pages canonical deployment latest stage is not successful');

  const frontendResponse = await fetchImpl(primaryFrontendOrigin, {
    method: 'GET',
    headers: { Accept: 'text/html' },
    redirect: 'follow',
  });
  const frontendHtml = await frontendResponse.text();
  const headerCsp = normalizePolicy(frontendResponse.headers.get('content-security-policy'));
  const metaCsp = normalizePolicy(extractMetaCsp(frontendHtml));
  const headerConnect = connectSources(headerCsp);
  const metaConnect = connectSources(metaCsp);
  const liveAllowsProductionApi = Boolean(
    headerCsp
      && metaCsp
      && headerConnect.has(productionApiOrigin)
      && metaConnect.has(productionApiOrigin),
  );
  const liveRejectsStagingApi = Boolean(
    headerCsp
      && metaCsp
      && (
        !stagingApiOrigin
        || (!headerConnect.has(stagingApiOrigin) && !metaConnect.has(stagingApiOrigin))
      ),
  );

  if (frontendResponse.status !== 200) errors.push(`live production frontend returned HTTP ${frontendResponse.status}`);
  if (!headerCsp) errors.push('live Cloudflare Pages response is missing Content-Security-Policy header');
  if (!metaCsp) errors.push('live production HTML is missing meta Content-Security-Policy');
  if (headerCsp && !headerConnect.has(productionApiOrigin)) {
    errors.push('live header CSP does not allow reviewed production API origin');
  }
  if (metaCsp && !metaConnect.has(productionApiOrigin)) {
    errors.push('live meta CSP does not allow reviewed production API origin');
  }
  if (stagingApiOrigin && headerConnect.has(stagingApiOrigin)) {
    errors.push('live header CSP incorrectly allows staging API origin');
  }
  if (stagingApiOrigin && metaConnect.has(stagingApiOrigin)) {
    errors.push('live meta CSP incorrectly allows staging API origin');
  }

  const result = {
    schema_version: 1,
    evidence_type: 'production-identity-readonly-audit',
    status: errors.length === 0 ? 'passed' : 'failed',
    collected_at: collectedAt,
    evidence_source_sha: evidenceSourceSha,
    checks: {
      cloudflare_d1_get: d1Envelope.success === true,
      cloudflare_pages_get: pagesEnvelope.success === true,
      pages_explicit_production_environment: deployEnv === 'production',
      pages_explicit_api_url_match: apiUrl === productionApiOrigin,
      pages_explicit_google_client_match: clientId === productionClientId,
      pages_production_branch_match: String(pages?.production_branch || '') === contract.main_branch,
      canonical_deployment_production: canonicalEnvironment === 'production',
      canonical_deployment_main_branch: canonicalBranch === contract.main_branch,
      canonical_deployment_success: canonicalStatus === 'success',
      live_frontend_http_200: frontendResponse.status === 200,
      live_csp_header_present: Boolean(headerCsp),
      live_csp_meta_present: Boolean(metaCsp),
      live_csp_allows_production_api: liveAllowsProductionApi,
      live_csp_rejects_staging_api: liveRejectsStagingApi,
    },
    production_d1: {
      database_name: observedD1Name || null,
      database_id_sha256: observedD1Id ? sha256(observedD1Id) : null,
    },
    production_pages: {
      project_name: pagesProjectName,
      subdomain: frontendUrl.hostname,
      production_branch: String(pages?.production_branch || '') || null,
      canonical_deployment_commit: SHA_RE.test(canonicalCommit) ? canonicalCommit : null,
    },
    live_frontend: {
      origin: primaryFrontendOrigin,
      final_url: sanitizeUrl(frontendResponse.url),
      status: frontendResponse.status,
    },
    errors,
  };
  return Object.freeze(result);
}

async function getCloudflareJson(url, headers, fetchImpl, label) {
  const response = await fetchImpl(url, { method: 'GET', headers });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${label} API did not return JSON (HTTP ${response.status})`);
  }
  if (!response.ok || body?.success !== true || !body?.result) {
    const codes = Array.isArray(body?.errors)
      ? body.errors.map((item) => item?.code).filter(Boolean).join(',')
      : '';
    throw new Error(`${label} API failed (HTTP ${response.status}${codes ? `; codes=${codes}` : ''})`);
  }
  return body;
}

function readPlainTextVar(envVars, name) {
  const entry = envVars && typeof envVars === 'object' ? envVars[name] : null;
  if (!entry || entry.type !== 'plain_text' || typeof entry.value !== 'string') return null;
  return entry.value.trim();
}

function extractMetaCsp(html) {
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!/http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag)) continue;
    const content = tag.match(/content\s*=\s*["']([\s\S]*?)["']/i);
    if (content?.[1]) return content[1];
  }
  return '';
}

function normalizePolicy(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function connectSources(policy) {
  const match = String(policy || '').match(/(?:^|;)\s*connect-src\s+([^;]+)/);
  return new Set(match ? match[1].trim().split(/\s+/).filter(Boolean) : []);
}

function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function sanitizeUrl(raw) {
  try {
    const parsed = new URL(raw);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function failedResult(errors, evidenceSourceSha, collectedAt) {
  return Object.freeze({
    schema_version: 1,
    evidence_type: 'production-identity-readonly-audit',
    status: 'failed',
    collected_at: collectedAt,
    evidence_source_sha: SHA_RE.test(String(evidenceSourceSha || '')) ? evidenceSourceSha : null,
    checks: {},
    production_d1: { database_name: null, database_id_sha256: null },
    production_pages: {},
    live_frontend: {},
    errors,
  });
}

export async function runCli() {
  const contractPath = resolve(process.env.DEPLOYMENT_CONTRACT_PATH || 'config/deployment-environments.json');
  const outputPath = resolve(process.env.AUDIT_OUTPUT || 'production-identity-evidence.json');
  const contract = JSON.parse(await readFile(contractPath, 'utf8'));
  let result;
  try {
    result = await collectProductionIdentityEvidence({
      contract,
      accountId: String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim(),
      apiToken: String(process.env.CLOUDFLARE_API_TOKEN || '').trim(),
      d1DatabaseId: String(process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim(),
      evidenceSourceSha: String(process.env.EVIDENCE_SOURCE_SHA || '').trim(),
    });
  } catch (error) {
    result = failedResult(
      [error instanceof Error ? error.message : 'production identity evidence collection failed'],
      String(process.env.EVIDENCE_SOURCE_SHA || '').trim(),
      new Date().toISOString(),
    );
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  if (result.status !== 'passed') {
    console.error(`Production identity read-only audit failed:\n${result.errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Production identity read-only audit passed; evidence=${outputPath}`);
  console.log(`D1 name=${result.production_d1.database_name}`);
  console.log(`D1 UUID SHA-256=${result.production_d1.database_id_sha256}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
