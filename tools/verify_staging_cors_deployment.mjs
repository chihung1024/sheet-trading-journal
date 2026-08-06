import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const STAGING_ORIGIN = 'https://staging.sheet-trading-journal.pages.dev';
export const REJECTED_ORIGINS = Object.freeze([
  ['production', 'https://sheet-trading-journal.pages.dev'],
  ['arbitrary-preview', 'https://feature-123.sheet-trading-journal.pages.dev'],
  ['github-pages', 'https://chihung1024.github.io'],
  ['localhost', 'http://localhost:5173'],
]);

const EXPECTED_ENVIRONMENT = 'staging';
const EXPECTED_SERVICE = 'journal-backend-staging';

export function validateStagingCorsDeployment(input = {}) {
  const errors = [];
  validateAllowedProbe(input.allowed, errors);

  const rejected = Array.isArray(input.rejected) ? input.rejected : [];
  const rejectedByOrigin = new Map(rejected.map((probe) => [probe?.origin, probe]));
  if (rejected.length !== REJECTED_ORIGINS.length) {
    errors.push(`expected ${REJECTED_ORIGINS.length} rejected-origin probes, received ${rejected.length}`);
  }
  for (const [, origin] of REJECTED_ORIGINS) {
    validateRejectedProbe(rejectedByOrigin.get(origin), origin, errors);
  }

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export async function loadStagingCorsProbeDirectory(directory) {
  const root = resolve(directory);
  const allowed = await readProbe(root, 'allowed', STAGING_ORIGIN);
  const rejected = [];
  for (const [label, origin] of REJECTED_ORIGINS) {
    rejected.push(await readProbe(root, label, origin));
  }
  return { allowed, rejected };
}

function validateAllowedProbe(probe, errors) {
  if (!probe || probe.origin !== STAGING_ORIGIN) {
    errors.push('missing exact staging-origin probe');
    return;
  }
  const headers = parseHeaders(probe.headers);
  if (probe.status !== 204) errors.push(`staging origin returned HTTP ${probe.status}, expected 204`);
  requireExactHeader(headers, 'access-control-allow-origin', STAGING_ORIGIN, 'staging origin', errors);
  requireTokenHeader(headers, 'access-control-allow-methods', 'GET', 'staging origin', errors);
  requireTokenHeader(headers, 'vary', 'Origin', 'staging origin', errors);
  requireIdentityHeaders(headers, 'staging origin', errors);
  if (String(probe.body || '').trim()) errors.push('staging preflight response body must be empty');
}

function validateRejectedProbe(probe, origin, errors) {
  if (!probe) {
    errors.push(`missing rejected-origin probe for ${origin}`);
    return;
  }
  const headers = parseHeaders(probe.headers);
  if (probe.status !== 403) errors.push(`${origin} returned HTTP ${probe.status}, expected 403`);
  if (headers.has('access-control-allow-origin')) {
    errors.push(`${origin} exposed Access-Control-Allow-Origin`);
  }
  requireIdentityHeaders(headers, origin, errors);

  let body;
  try {
    body = JSON.parse(String(probe.body || ''));
  } catch {
    errors.push(`${origin} returned malformed JSON`);
    return;
  }
  if (body?.error_meta?.code !== 'ORIGIN_FORBIDDEN') {
    errors.push(`${origin} returned error code ${String(body?.error_meta?.code)}, expected ORIGIN_FORBIDDEN`);
  }
}

function requireIdentityHeaders(headers, label, errors) {
  requireExactHeader(headers, 'x-deployment-environment', EXPECTED_ENVIRONMENT, label, errors);
  requireExactHeader(headers, 'x-worker-service', EXPECTED_SERVICE, label, errors);
}

function requireExactHeader(headers, name, expected, label, errors) {
  const actual = headers.get(name);
  if (actual !== expected) errors.push(`${label} header ${name} was ${String(actual)}, expected ${expected}`);
}

function requireTokenHeader(headers, name, expected, label, errors) {
  const tokens = String(headers.get(name) || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.includes(expected.toLowerCase())) {
    errors.push(`${label} header ${name} does not include ${expected}`);
  }
}

function parseHeaders(rawHeaders) {
  const headers = new Map();
  for (const line of String(rawHeaders || '').split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!name) continue;
    headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value);
  }
  return headers;
}

async function readProbe(root, label, origin) {
  const [statusText, headers, body] = await Promise.all([
    readFile(resolve(root, `${label}.status`), 'utf8'),
    readFile(resolve(root, `${label}.headers`), 'utf8'),
    readFile(resolve(root, `${label}.body`), 'utf8'),
  ]);
  const normalizedStatus = statusText.trim();
  if (!/^\d{3}$/.test(normalizedStatus)) {
    throw new Error(`Invalid HTTP status for ${label}: ${normalizedStatus}`);
  }
  return { origin, status: Number(normalizedStatus), headers, body };
}

async function main() {
  const probeDirectory = String(process.env.STAGING_CORS_PROBE_DIR || '').trim();
  if (!probeDirectory) throw new Error('STAGING_CORS_PROBE_DIR is required');
  const result = validateStagingCorsDeployment(
    await loadStagingCorsProbeDirectory(probeDirectory),
  );
  if (!result.ok) {
    for (const error of result.errors) console.error(`Staging CORS verification failed: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('Live staging browser-origin isolation verified');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
