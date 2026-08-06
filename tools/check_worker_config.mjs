import { readFile } from "node:fs/promises";

const [
  manifestRaw,
  config,
  stagingConfig,
  worker,
  stagingWorker,
  baselineMigration,
  latestMigration,
] = await Promise.all([
  readFile("worker-manifest.json", "utf8"),
  readFile("wrangler.toml", "utf8"),
  readFile("wrangler.staging.toml", "utf8"),
  readFile("worker.js", "utf8"),
  readFile("staging-worker.js", "utf8"),
  readFile("migrations/0001_baseline.sql", "utf8"),
  readFile("migrations/0002_calculation_jobs.sql", "utf8"),
]);
const manifest = JSON.parse(manifestRaw);
const errors = [];

expect(config, `name = "${manifest.service}"`, "Worker service name");
expect(config, `main = "${manifest.canonicalSource}"`, "canonical source");
expect(config, `binding = "${manifest.d1Binding}"`, "D1 binding");
expect(config, `binding = "${manifest.versionMetadataBinding}"`, "version metadata binding");
expect(config, `RELEASE_VERSION = "${manifest.releaseVersion}"`, "release version variable");
expect(config, `API_VERSION = "${manifest.apiVersion}"`, "API version variable");
expect(config, `SCHEMA_VERSION = "${manifest.schemaVersion}"`, "schema version variable");
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

expect(stagingConfig, 'name = "journal-backend-staging"', "staging Worker service name");
expect(stagingConfig, 'main = "staging-worker.js"', "staging wrapper source");
expect(stagingConfig, `binding = "${manifest.d1Binding}"`, "staging D1 binding");
expect(
  stagingConfig,
  `binding = "${manifest.versionMetadataBinding}"`,
  "staging version metadata binding",
);
expect(
  stagingConfig,
  `RELEASE_VERSION = "${manifest.releaseVersion}"`,
  "staging release version variable",
);
expect(
  stagingConfig,
  `API_VERSION = "${manifest.apiVersion}"`,
  "staging API version variable",
);
expect(
  stagingConfig,
  `SCHEMA_VERSION = "${manifest.schemaVersion}"`,
  "staging schema version variable",
);
expect(stagingConfig, 'DEPLOYMENT_ENVIRONMENT = "staging"', "staging environment marker");
expect(
  stagingConfig,
  'ALLOWED_ORIGINS = "https://staging.sheet-trading-journal.pages.dev"',
  "staging frontend origin",
);
expect(stagingConfig, 'database_name = "trading-journal-staging"', "staging D1 name");
expect(
  stagingConfig,
  'GOOGLE_CLIENT_ID = "000000000000-staging-placeholder.apps.googleusercontent.com"',
  "staging OAuth placeholder",
);
expect(stagingWorker, "import canonicalWorker from './worker.js'", "canonical Worker delegation");
expect(stagingWorker, "GITHUB_TOKEN is forbidden in the staging Worker", "staging dispatch boundary");

if (!stagingConfig.includes('database_id = "00000000-0000-0000-0000-000000000000"')) {
  errors.push("Tracked wrangler.staging.toml must retain the safe D1 sentinel");
}
if (!stagingConfig.includes('SOURCE_COMMIT = "development"')) {
  errors.push("Tracked wrangler.staging.toml must not claim a deployed source SHA");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log("Worker production and staging manifests, sources, configs, and migrations are synchronized.");

function expect(content, needle, label) {
  if (!content.includes(needle)) errors.push(`Missing or inconsistent ${label}: ${needle}`);
}
