import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const EXPECTED_ENVIRONMENT = 'staging';
const EXPECTED_WORKER_SERVICE = 'journal-backend-staging';
const SOURCE_COMMIT_RE = /^[0-9a-f]{40}$/;

function parseHeaders(raw) {
  const headers = new Map();
  for (const line of String(raw || '').split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name) headers.set(name, value);
  }
  return headers;
}

function safeField(value, maxLength = 160) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, maxLength);
}

function parseBody(body) {
  if (body && typeof body === 'object') return body;
  const raw = String(body || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function formatStagingResponseDiagnostic({ status, headers, payload } = {}) {
  const parsedHeaders = headers instanceof Headers
    ? new Map([...headers.entries()].map(([name, value]) => [name.toLowerCase(), value]))
    : parseHeaders(headers);
  const parts = [`HTTP ${Number(status) || 0}`];
  const source = safeField(parsedHeaders.get('x-source-commit'));
  const environment = safeField(parsedHeaders.get('x-deployment-environment'));
  const workerService = safeField(parsedHeaders.get('x-worker-service'));
  const code = safeField(payload?.error_meta?.code);
  const error = safeField(payload?.error);
  if (source) parts.push(`source=${source}`);
  if (environment) parts.push(`environment=${environment}`);
  if (workerService) parts.push(`worker=${workerService}`);
  if (code) parts.push(`code=${code}`);
  if (error) parts.push(`error=${JSON.stringify(error)}`);
  return parts.join(' ');
}

export function validateStagingRestoreRoute({ status, headers, body, expectedSha } = {}) {
  const errors = [];
  const normalizedExpectedSha = String(expectedSha || '').trim().toLowerCase();
  if (!SOURCE_COMMIT_RE.test(normalizedExpectedSha)) {
    errors.push('expected source SHA is not an exact lowercase 40-character commit');
  }

  if (Number(status) !== 405) {
    errors.push(`restore route returned HTTP ${Number(status) || 0} instead of 405`);
  }

  const parsedHeaders = parseHeaders(headers);
  if (parsedHeaders.get('x-deployment-environment') !== EXPECTED_ENVIRONMENT) {
    errors.push('restore route is not identified as staging');
  }
  if (parsedHeaders.get('x-worker-service') !== EXPECTED_WORKER_SERVICE) {
    errors.push('restore route has the wrong staging Worker service identity');
  }
  if (
    SOURCE_COMMIT_RE.test(normalizedExpectedSha)
    && parsedHeaders.get('x-source-commit') !== normalizedExpectedSha
  ) {
    errors.push('restore route was served by a different source commit');
  }

  const payload = parseBody(body);
  if (!payload || payload.error !== 'Method not allowed') {
    errors.push('restore route did not return the expected non-mutating method rejection');
  }

  return {
    ok: errors.length === 0,
    errors,
    sourceCommit: parsedHeaders.get('x-source-commit') || null,
    diagnostic: formatStagingResponseDiagnostic({ status, headers, payload }),
  };
}

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function runCli() {
  let result;
  try {
    result = validateStagingRestoreRoute({
      status: required('RESTORE_ROUTE_STATUS'),
      headers: required('RESTORE_ROUTE_HEADERS'),
      body: required('RESTORE_ROUTE_BODY'),
      expectedSha: required('EXPECTED_SHA'),
    });
  } catch (error) {
    console.error(`Staging restore route readiness check failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`Staging restore route not ready: ${error}`);
    }
    console.error(`Staging restore route diagnostic: ${result.diagnostic}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Staging restore route verified on exact source ${result.sourceCommit}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) runCli();
