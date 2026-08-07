import { appendFileSync, readFileSync } from "node:fs";

const manifestPath = process.env.WORKER_MANIFEST_PATH || "worker-manifest.json";
const outputPath = process.env.GITHUB_OUTPUT;

if (!outputPath) {
  throw new Error("GITHUB_OUTPUT is required");
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  throw new Error(`Unable to read Worker manifest: ${error instanceof Error ? error.name : "UnknownError"}`);
}

if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
  throw new Error("Worker manifest must be a JSON object");
}

const runtimeService = requireIdentifier(manifest.runtimeService, "runtimeService");
const releaseVersion = requireVersion(manifest.releaseVersion, "releaseVersion");
const apiVersion = requireVersion(manifest.apiVersion, "apiVersion");
const schemaVersion = requireSchemaVersion(manifest.schemaVersion);

appendFileSync(
  outputPath,
  [
    `runtime_service=${runtimeService}`,
    `release_version=${releaseVersion}`,
    `api_version=${apiVersion}`,
    `schema_version=${schemaVersion}`,
    "",
  ].join("\n"),
  "utf8",
);

console.log(`Validated Worker manifest: service=${runtimeService} release=${releaseVersion} api=${apiVersion} schema=${schemaVersion}`);

function requireIdentifier(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new Error(`Worker manifest ${field} is invalid`);
  }
  return value;
}

function requireVersion(value, field) {
  if (typeof value !== "string" || !/^\d+\.\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`Worker manifest ${field} is invalid`);
  }
  return value;
}

function requireSchemaVersion(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Worker manifest schemaVersion is invalid");
  }
  return value;
}
