import { readdir, readFile } from "node:fs/promises";

const MIGRATION_FILE_RE = /^\d+.*\.sql$/;
const SCHEMA_METADATA_UPDATE_RE = /UPDATE\s+schema_metadata\s+SET\s+([\s\S]*?)\s+WHERE\s+id\s*=\s*1\b[\s\S]*?;/gi;
const SCHEMA_VERSION_RE = /\bschema_version\s*=\s*(\d+)\b/i;
const RELEASE_VERSION_RE = /\brelease_version\s*=\s*'([^']+)'/i;
const RELEASE_TOKEN_RE = /^\d+\.\d+$/;

export async function readLatestSchemaActivation(migrationsDirectory = "migrations") {
  const files = (await readdir(migrationsDirectory))
    .filter((name) => MIGRATION_FILE_RE.test(name))
    .sort();

  let latest = null;
  for (const file of files) {
    const sql = await readFile(`${migrationsDirectory}/${file}`, "utf8");
    for (const match of sql.matchAll(SCHEMA_METADATA_UPDATE_RE)) {
      const assignments = match[1];
      const schemaMatch = assignments.match(SCHEMA_VERSION_RE);
      const releaseMatch = assignments.match(RELEASE_VERSION_RE);
      if (!schemaMatch && !releaseMatch) continue;
      if (!schemaMatch || !releaseMatch) {
        throw new Error(`Schema activation update in ${file} must set both schema_version and release_version`);
      }

      const schemaVersion = Number(schemaMatch[1]);
      const releaseVersion = releaseMatch[1];
      if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
        throw new Error(`Invalid schema activation version in ${file}`);
      }
      if (!RELEASE_TOKEN_RE.test(releaseVersion)) {
        throw new Error(`Invalid schema activation release token in ${file}`);
      }
      latest = Object.freeze({ schemaVersion, releaseVersion, migration: file });
    }
  }

  if (!latest) {
    throw new Error("No schema_metadata activation update found in migrations");
  }
  return latest;
}
