import { readFile } from "node:fs/promises";

const [manifestRaw, config, worker, migration] = await Promise.all([
  readFile("worker-manifest.json", "utf8"),
  readFile("wrangler.toml", "utf8"),
  readFile("worker.js", "utf8"),
  readFile("migrations/0001_baseline.sql", "utf8"),
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
expect(migration, `schema_version, release_version`, "schema metadata columns");
expect(migration, `VALUES (1, ${manifest.schemaVersion}, '${manifest.releaseVersion}'`, "schema metadata version row");

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
console.log("Worker manifest, source, Wrangler config, and migration are synchronized.");

function expect(content, needle, label) {
  if (!content.includes(needle)) errors.push(`Missing or inconsistent ${label}: ${needle}`);
}
