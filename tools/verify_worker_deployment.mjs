import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export function validateWorkerDeployment({
  version,
  health,
  expectedSha,
  expectedService,
  expectedReleaseVersion,
  expectedApiVersion,
  expectedSchemaVersion,
}) {
  const errors = [];
  const normalizedSha = String(expectedSha || "").trim().toLowerCase();
  const service = String(expectedService || "").trim();
  const releaseVersion = String(expectedReleaseVersion || "").trim();
  const apiVersion = String(expectedApiVersion || "").trim();
  const schemaVersion = Number(expectedSchemaVersion);

  if (!/^[0-9a-f]{40}$/.test(normalizedSha)) {
    errors.push("expected source SHA must be an exact 40-character Git commit SHA");
  }
  if (!service) {
    errors.push("expected runtime service is required");
  }
  if (!releaseVersion) {
    errors.push("expected release version is required");
  }
  if (!apiVersion) {
    errors.push("expected API version is required");
  }
  if (!Number.isInteger(schemaVersion) || schemaVersion < 0) {
    errors.push("expected schema version must be a non-negative integer");
  }
  if (!version || typeof version !== "object" || Array.isArray(version)) {
    errors.push("version response must be a JSON object");
  }
  if (!health || typeof health !== "object" || Array.isArray(health)) {
    errors.push("health response must be a JSON object");
  }

  if (errors.length === 0) {
    const reportedSchemaVersion = Number(version.schema_version);
    const observedSchemaVersion = Number(health.observed_schema_version);

    if (version.service !== service) {
      errors.push(
        `runtime service mismatch: ${String(version.service || "missing")} != ${service}`,
      );
    }
    if (version.source_commit !== normalizedSha) {
      errors.push(
        `source commit has not propagated: ${String(version.source_commit || "missing")} != ${normalizedSha}`,
      );
    }
    if (health.source_commit && health.source_commit !== normalizedSha) {
      errors.push(
        `health source commit mismatch: ${String(health.source_commit)} != ${normalizedSha}`,
      );
    }
    if (version.release_version !== releaseVersion) {
      errors.push(
        `release version mismatch: ${String(version.release_version || "missing")} != ${releaseVersion}`,
      );
    }
    if (version.api_version !== apiVersion) {
      errors.push(
        `API version mismatch: ${String(version.api_version || "missing")} != ${apiVersion}`,
      );
    }
    if (!Number.isInteger(reportedSchemaVersion) || reportedSchemaVersion < 0) {
      errors.push(
        `version endpoint schema is missing or invalid: ${String(version.schema_version)}`,
      );
    } else if (reportedSchemaVersion !== schemaVersion) {
      errors.push(
        `version endpoint schema mismatch: ${reportedSchemaVersion} != ${schemaVersion}`,
      );
    }
    if (!version.worker_version?.id) {
      errors.push("Cloudflare Worker version ID is missing");
    }
    if (health.status !== "ok") {
      errors.push(`health status is not ready: ${String(health.status || "missing")}`);
    }
    if (!Number.isInteger(observedSchemaVersion) || observedSchemaVersion < 0) {
      errors.push(
        `observed D1 schema is missing or invalid: ${String(health.observed_schema_version)}`,
      );
    } else if (observedSchemaVersion !== schemaVersion) {
      errors.push(
        `observed D1 schema mismatch: ${observedSchemaVersion} != ${schemaVersion}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    sourceCommit: version?.source_commit || null,
    workerVersionId: version?.worker_version?.id || null,
  };
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
    result = validateWorkerDeployment({
      version: parseJsonEnv("VERSION_JSON"),
      health: parseJsonEnv("HEALTH_JSON"),
      expectedSha: process.env.EXPECTED_SHA,
      expectedService: process.env.EXPECTED_RUNTIME_SERVICE,
      expectedReleaseVersion: process.env.EXPECTED_RELEASE_VERSION,
      expectedApiVersion: process.env.EXPECTED_API_VERSION,
      expectedSchemaVersion: process.env.EXPECTED_SCHEMA_VERSION,
    });
  } catch (error) {
    console.error(`Deployment readiness check failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`Deployment not ready: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Production source verified: ${result.sourceCommit}`);
  console.log(`Cloudflare Worker version verified: ${result.workerVersionId}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  runCli();
}
