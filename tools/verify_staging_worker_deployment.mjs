import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { validateWorkerDeployment } from './verify_worker_deployment.mjs';

const EXPECTED_ENVIRONMENT = 'staging';
const EXPECTED_WORKER_SERVICE = 'journal-backend-staging';

export function validateStagingWorkerDeployment(input) {
  const base = validateWorkerDeployment(input);
  const errors = [...base.errors];
  const versionHeaders = parseHeaders(input.versionHeaders);
  const healthHeaders = parseHeaders(input.healthHeaders);

  for (const [label, headers] of [
    ['version', versionHeaders],
    ['health', healthHeaders],
  ]) {
    if (headers.get('x-deployment-environment') !== EXPECTED_ENVIRONMENT) {
      errors.push(`${label} endpoint is not identified as staging`);
    }
    if (headers.get('x-worker-service') !== EXPECTED_WORKER_SERVICE) {
      errors.push(`${label} endpoint has the wrong staging Worker service identity`);
    }
  }

  return {
    ...base,
    ok: errors.length === 0,
    errors,
  };
}

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

function parseJsonEnv(name) {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is required`);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} is not valid JSON: ${error.message}`);
  }
}

function runCli() {
  let result;
  try {
    result = validateStagingWorkerDeployment({
      version: parseJsonEnv('VERSION_JSON'),
      health: parseJsonEnv('HEALTH_JSON'),
      versionHeaders: process.env.VERSION_HEADERS,
      healthHeaders: process.env.HEALTH_HEADERS,
      expectedSha: process.env.EXPECTED_SHA,
      expectedService: process.env.EXPECTED_RUNTIME_SERVICE,
      expectedReleaseVersion: process.env.EXPECTED_RELEASE_VERSION,
      expectedApiVersion: process.env.EXPECTED_API_VERSION,
      expectedSchemaVersion: process.env.EXPECTED_SCHEMA_VERSION,
    });
  } catch (error) {
    console.error(`Staging deployment readiness check failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`Staging deployment not ready: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Staging source verified: ${result.sourceCommit}`);
  console.log(`Staging Cloudflare Worker version verified: ${result.workerVersionId}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) runCli();
