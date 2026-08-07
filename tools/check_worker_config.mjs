import { readFile } from "node:fs/promises";

const [
  manifestRaw,
  environmentContractRaw,
  config,
  deploymentEntry,
  worker,
  baselineMigration,
  latestMigration,
] = await Promise.all([
  readFile("worker-manifest.json", "utf8"),
  readFile("config/deployment-environments.json", "utf8"),
  readFile("wrangler.toml", "utf8"),
  readFile("worker-entry.js", "utf8"),
  readFile("worker.js", "utf8"),
  readFile("migrations/0001_baseline.sql", "utf8"),
  readFile("migrations/0002_calculation_jobs.sql", "utf8"),
]);
const manifest = JSON.parse(manifestRaw);
const environmentContract = JSON.parse(environmentContractRaw);
const errors = [];
const production = environmentContract?.production;
const productionOrigins = production?.frontend_origins;
const productionGoogleClientIds = production?.google_client_ids;

expect(config, `name = "${manifest.service}"`, "Worker service name");
expect(config, `main = "${manifest.deploymentEntry}"`, "deployment entry");
expect(config, `binding = "${manifest.d1Binding}"`, "D1 binding");
expect(config, `binding = "${manifest.versionMetadataBinding}"`, "version metadata binding");
expect(config, `RELEASE_VERSION = "${manifest.releaseVersion}"`, "release version variable");
expect(config, `API_VERSION = "${manifest.apiVersion}"`, "API version variable");
expect(config, `SCHEMA_VERSION = "${manifest.schemaVersion}"`, "schema version variable");
expect(config, 'DEPLOYMENT_ENVIRONMENT = "production"', "production environment identity");
expect(config, "preview_urls = false", "disabled production Worker preview URLs");
expect(config, "keep_vars = false", "explicit Wrangler source-of-truth policy");
expect(config, 'required = ["API_SECRET"]', "required API secret declaration");
if (!Array.isArray(productionOrigins) || productionOrigins.length === 0) {
  errors.push("Production frontend origin contract must be a non-empty array");
} else {
  expect(
    config,
    `ALLOWED_ORIGINS = "${productionOrigins.join(",")}"`,
    "production origin allowlist",
  );
}
if (!Array.isArray(productionGoogleClientIds) || productionGoogleClientIds.length !== 1) {
  errors.push("Production Google client contract must contain exactly one client ID");
} else {
  expect(
    config,
    `GOOGLE_CLIENT_ID = "${productionGoogleClientIds[0]}"`,
    "production Google OAuth client",
  );
}
if (!production || !new Set(["unverified", "verified"]).has(production.d1_identity_status)) {
  errors.push("Production D1 identity status must be unverified or verified");
} else if (production.d1_identity_status === "unverified") {
  if (production.d1_database_name !== null || production.d1_database_id_sha256 !== null) {
    errors.push("Unverified production D1 identity must not contain guessed authority values");
  }
} else {
  if (typeof production.d1_database_name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(production.d1_database_name)) {
    errors.push("Verified production D1 identity requires a valid database name");
  }
  if (typeof production.d1_database_id_sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(production.d1_database_id_sha256)) {
    errors.push("Verified production D1 identity requires a SHA-256 database ID fingerprint");
  }
}
expect(
  deploymentEntry,
  `from './${manifest.canonicalSource}'`,
  "deployment entry canonical source import",
);
expect(deploymentEntry, "ALLOWED_ORIGINS", "deployment entry CORS binding");
expect(deploymentEntry, "ORIGIN_FORBIDDEN", "deployment entry fail-closed response");
expect(worker, `const RELEASE_VERSION = "${manifest.releaseVersion}"`, "Worker release constant");
expect(worker, `const API_VERSION = "${manifest.apiVersion}"`, "Worker API constant");
expect(worker, `const REQUIRED_SCHEMA_VERSION = ${manifest.schemaVersion}`, "Worker schema constant");
expect(baselineMigration, `schema_version, release_version`, "schema metadata columns");
expect(baselineMigration, `VALUES (1, 1, '4.05'`, "baseline schema metadata row");
expect(latestMigration, `schema_version = ${manifest.schemaVersion}`, "latest schema version update");
expect(latestMigration, `release_version = '${manifest.releaseVersion}'`, "latest release version update");
expect(latestMigration, `CREATE TABLE IF NOT EXISTS calculation_jobs`, "calculation jobs table");

if (!config.includes('database_id = "00000000-0000-0000-0000-000000000000"')) {
  errors.push("Tracked wrangler.toml must retain the safe local-only D1 sentinel");
}
if (!config.includes('SOURCE_COMMIT = "development"')) {
  errors.push("Tracked wrangler.toml must not claim a production source SHA");
}
if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log("Worker manifest, environment identity, deployment entry, Wrangler config, and migrations are synchronized.");

function expect(content, needle, label) {
  if (!content.includes(needle)) errors.push(`Missing or inconsistent ${label}: ${needle}`);
}
