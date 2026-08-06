import { readFile } from "node:fs/promises";

const [
  manifestRaw,
  config,
  deploymentEntry,
  worker,
  baselineMigration,
  latestMigration,
] = await Promise.all([
  readFile("worker-manifest.json", "utf8"),
  readFile("wrangler.toml", "utf8"),
  readFile("worker-entry.js", "utf8"),
  readFile("worker.js", "utf8"),
  readFile("migrations/0001_baseline.sql", "utf8"),
  readFile("migrations/0002_calculation_jobs.sql", "utf8"),
]);
const manifest = JSON.parse(manifestRaw);
const errors = [];

expect(config, `name = "${manifest.service}"`, "Worker service name");
expect(config, `main = "${manifest.deploymentEntry}"`, "deployment entry");
expect(config, `binding = "${manifest.d1Binding}"`, "D1 binding");
expect(config, `binding = "${manifest.versionMetadataBinding}"`, "version metadata binding");
expect(config, `RELEASE_VERSION = "${manifest.releaseVersion}"`, "release version variable");
expect(config, `API_VERSION = "${manifest.apiVersion}"`, "API version variable");
expect(config, `SCHEMA_VERSION = "${manifest.schemaVersion}"`, "schema version variable");
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
console.log("Worker manifest, deployment entry, canonical source, Wrangler config, and migrations are synchronized.");

function expect(content, needle, label) {
  if (!content.includes(needle)) errors.push(`Missing or inconsistent ${label}: ${needle}`);
}
