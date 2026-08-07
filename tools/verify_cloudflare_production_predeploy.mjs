#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const SHA_RE = /^[0-9a-f]{40}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sha256(value) {
  return createHash("sha256").update(String(value).toLowerCase()).digest("hex");
}

function unwrapCloudflare(payload, label) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${label} response must be a JSON object`);
  }
  if (payload.success !== true) {
    throw new Error(`${label} Cloudflare API response is not successful`);
  }
  if (payload.result === undefined || payload.result === null) {
    throw new Error(`${label} Cloudflare API result is missing`);
  }
  return payload.result;
}

function envVarEntry(envVars, name) {
  if (!envVars || typeof envVars !== "object" || Array.isArray(envVars)) return null;
  const entry = envVars[name];
  return entry && typeof entry === "object" && !Array.isArray(entry) ? entry : null;
}

function exactPlainTextEnv(envVars, name, expected) {
  const entry = envVarEntry(envVars, name);
  return {
    present: Boolean(entry),
    type: entry?.type || null,
    exact_plain_text_value: entry?.type === "plain_text" && entry?.value === expected,
  };
}

function findD1Binding(versionResult, bindingName) {
  const bindings = versionResult?.resources?.bindings;
  if (!Array.isArray(bindings)) return null;
  return bindings.find((binding) => binding?.name === bindingName && binding?.type === "d1") || null;
}

function extractDatabaseId(binding) {
  const candidate = binding?.id ?? binding?.database_id ?? binding?.databaseId;
  return typeof candidate === "string" ? candidate.trim().toLowerCase() : "";
}

function extractDatabaseIdentity(d1Result) {
  const id = String(d1Result?.uuid ?? d1Result?.id ?? d1Result?.database_id ?? "").trim().toLowerCase();
  const name = String(d1Result?.name ?? d1Result?.database_name ?? "").trim();
  return { id, name };
}

function firstProductionDeployment(result) {
  if (!Array.isArray(result) || result.length === 0) return null;
  return result.find((item) => item?.environment === "production") || result[0];
}

export function validateCloudflareProductionPredeploy({
  contract,
  manifest,
  publicWorkerVersion,
  workerVersionPayload,
  pagesProjectPayload,
  pagesDeploymentsPayload,
  d1DatabasePayload,
}) {
  const errors = [];
  const production = contract?.production;
  const staging = contract?.staging;
  const productionApiOrigin = String(production?.api_origins?.[0] || "").trim();
  const productionFrontendOrigin = String(production?.frontend_origins?.[0] || "").trim();
  const productionGoogleClientId = String(production?.google_client_ids?.[0] || "").trim();
  const stagingApiOrigin = String(staging?.api_origin || "").trim();
  const workerScriptName = String(manifest?.service || "").trim();
  const expectedD1Binding = String(manifest?.d1Binding || "DB").trim();
  const publicWorkerVersionId = String(publicWorkerVersion?.worker_version?.id || "").trim();

  let workerVersionResult;
  let pagesProjectResult;
  let pagesDeploymentsResult;
  let d1Result;
  try {
    workerVersionResult = unwrapCloudflare(workerVersionPayload, "Worker version");
    pagesProjectResult = unwrapCloudflare(pagesProjectPayload, "Pages project");
    pagesDeploymentsResult = unwrapCloudflare(pagesDeploymentsPayload, "Pages deployments");
    d1Result = unwrapCloudflare(d1DatabasePayload, "D1 database");
  } catch (error) {
    return Object.freeze({ ok: false, errors: Object.freeze([error.message]), evidence: null });
  }

  if (!productionApiOrigin || !productionFrontendOrigin || !productionGoogleClientId || !stagingApiOrigin) {
    errors.push("deployment environment contract is incomplete");
  }
  if (!workerScriptName) errors.push("worker manifest service is missing");
  if (!publicWorkerVersionId) errors.push("public Worker version ID is missing");

  const cloudflareWorkerVersionId = String(workerVersionResult?.id || "").trim();
  if (!cloudflareWorkerVersionId || cloudflareWorkerVersionId !== publicWorkerVersionId) {
    errors.push("Cloudflare Worker version detail does not match the live public Worker version ID");
  }

  const binding = findD1Binding(workerVersionResult, expectedD1Binding);
  if (!binding) errors.push(`deployed Worker version has no ${expectedD1Binding} D1 binding`);
  const boundDatabaseId = extractDatabaseId(binding);
  if (!UUID_RE.test(boundDatabaseId)) errors.push("deployed Worker D1 binding has no valid database UUID");

  const d1Identity = extractDatabaseIdentity(d1Result);
  if (!UUID_RE.test(d1Identity.id)) errors.push("Cloudflare D1 metadata has no valid database UUID");
  if (!d1Identity.name) errors.push("Cloudflare D1 metadata has no database name");
  if (UUID_RE.test(boundDatabaseId) && UUID_RE.test(d1Identity.id) && boundDatabaseId !== d1Identity.id) {
    errors.push("deployed Worker D1 binding UUID differs from Cloudflare D1 metadata UUID");
  }
  if (d1Identity.name === staging?.d1_database_name) {
    errors.push("production Worker is bound to the reviewed staging D1 database name");
  }

  const expectedProjectName = new URL(productionFrontendOrigin).hostname.replace(/\.pages\.dev$/i, "");
  const projectName = String(pagesProjectResult?.name || "").trim();
  const projectSubdomain = String(pagesProjectResult?.subdomain || "").trim();
  if (projectName !== expectedProjectName) errors.push("Cloudflare Pages project name does not match production pages.dev origin");
  if (projectSubdomain && new URL(`https://${projectSubdomain}`).origin !== productionFrontendOrigin) {
    errors.push("Cloudflare Pages project subdomain does not match production frontend origin");
  }

  const productionConfig = pagesProjectResult?.deployment_configs?.production;
  if (!productionConfig || typeof productionConfig !== "object" || Array.isArray(productionConfig)) {
    errors.push("Cloudflare Pages production deployment configuration is missing");
  }
  const envVars = productionConfig?.env_vars;
  const apiEnv = exactPlainTextEnv(envVars, "VITE_API_URL", productionApiOrigin);
  const googleEnv = exactPlainTextEnv(envVars, "VITE_GOOGLE_CLIENT_ID", productionGoogleClientId);
  if (!apiEnv.exact_plain_text_value) {
    errors.push("Cloudflare Pages production VITE_API_URL is absent or not exact reviewed plain text");
  }
  if (!googleEnv.exact_plain_text_value) {
    errors.push("Cloudflare Pages production VITE_GOOGLE_CLIENT_ID is absent or not exact reviewed plain text");
  }

  const latestProductionDeployment = firstProductionDeployment(pagesDeploymentsResult);
  if (!latestProductionDeployment) {
    errors.push("Cloudflare Pages production deployment list is empty");
  } else if (latestProductionDeployment.environment !== "production") {
    errors.push("latest selected Cloudflare Pages deployment is not production");
  }
  const pagesCommitSha = String(latestProductionDeployment?.deployment_trigger?.metadata?.commit_hash || "").trim().toLowerCase();
  if (!SHA_RE.test(pagesCommitSha)) errors.push("Cloudflare Pages production deployment commit hash is not an exact 40-character SHA");

  const publicWorkerSource = String(publicWorkerVersion?.source_commit || "").trim().toLowerCase();
  if (!SHA_RE.test(publicWorkerSource)) errors.push("public production Worker source_commit is not exact");

  const evidence = {
    schema_version: 1,
    status: errors.length === 0 ? "passed" : "failed",
    observed_at: new Date().toISOString(),
    read_only: true,
    checks: {
      production_frontend_explicit_environment: errors.some((error) => error.includes("VITE_")) ? "failed" : "passed",
      production_d1_identity: errors.some((error) => /D1|database UUID|database name/i.test(error)) ? "failed" : "passed",
      production_worker_control_plane_link: cloudflareWorkerVersionId === publicWorkerVersionId && Boolean(publicWorkerVersionId) ? "passed" : "failed",
    },
    pages: {
      project_name: projectName || null,
      production_origin: productionFrontendOrigin || null,
      latest_production_deployment_id: latestProductionDeployment?.id || null,
      latest_production_commit_sha: SHA_RE.test(pagesCommitSha) ? pagesCommitSha : null,
      deployment_created_on: latestProductionDeployment?.created_on || null,
      vite_api_url: apiEnv,
      vite_google_client_id: googleEnv,
    },
    worker: {
      script_name: workerScriptName || null,
      public_source_commit: SHA_RE.test(publicWorkerSource) ? publicWorkerSource : null,
      public_worker_version_id: publicWorkerVersionId || null,
      cloudflare_worker_version_id: cloudflareWorkerVersionId || null,
      d1_binding_name: binding?.name || null,
      d1_binding_type: binding?.type || null,
    },
    d1: {
      database_name: d1Identity.name || null,
      database_id_sha256: UUID_RE.test(d1Identity.id) ? sha256(d1Identity.id) : null,
      bound_database_id_sha256: UUID_RE.test(boundDatabaseId) ? sha256(boundDatabaseId) : null,
      database_id_matches_deployed_binding: UUID_RE.test(d1Identity.id) && d1Identity.id === boundDatabaseId,
    },
    proof: {
      result: errors.length === 0 ? "pass" : "fail",
      summary: errors.length === 0
        ? "Cloudflare production Pages explicit env and live Worker-to-D1 control-plane identity passed without writes."
        : "Cloudflare production predeploy read-only verification failed.",
    },
    errors,
  };

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), evidence });
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} cannot be read as JSON: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function main() {
  const requiredPaths = {
    contract: process.env.DEPLOYMENT_CONTRACT_JSON || "config/deployment-environments.json",
    manifest: process.env.WORKER_MANIFEST_JSON || "worker-manifest.json",
    publicWorkerVersion: process.env.PUBLIC_WORKER_VERSION_JSON,
    workerVersionPayload: process.env.CLOUDFLARE_WORKER_VERSION_JSON,
    pagesProjectPayload: process.env.CLOUDFLARE_PAGES_PROJECT_JSON,
    pagesDeploymentsPayload: process.env.CLOUDFLARE_PAGES_DEPLOYMENTS_JSON,
    d1DatabasePayload: process.env.CLOUDFLARE_D1_DATABASE_JSON,
  };
  for (const [name, path] of Object.entries(requiredPaths)) {
    if (!path) throw new Error(`${name} input path is required`);
  }

  const input = {};
  for (const [name, path] of Object.entries(requiredPaths)) input[name] = await readJson(path, name);
  const result = validateCloudflareProductionPredeploy(input);
  const output = String(process.env.AUDIT_OUTPUT || "production-cloudflare-evidence.json").trim();
  if (result.evidence) await writeFile(output, `${JSON.stringify(result.evidence, null, 2)}\n`, { mode: 0o600 });
  if (!result.ok) throw new Error(result.errors.map((error) => `- ${error}`).join("\n"));
  console.log(`Cloudflare production read-only proof PASS: Pages commit=${result.evidence.pages.latest_production_commit_sha}; Worker version=${result.evidence.worker.public_worker_version_id}; D1=${result.evidence.d1.database_name}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`Cloudflare production predeploy verification failed:\n${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
}
