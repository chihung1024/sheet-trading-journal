import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import worker, { __test } from "../worker.js";

const UNVERIFIED_PRODUCTION_D1_NAME = "journal-production";

function healthyDb(schemaVersion = 2) {
  return {
    prepare(sql) {
      return {
        bind() {
          return this;
        },
        async all() {
          if (sql.includes("sqlite_master")) {
            return {
              results: [
                { name: "records" },
                { name: "portfolio_snapshots" },
                { name: "user_settings" },
                { name: "calculation_jobs" },
              ],
            };
          }
          return { results: [] };
        },
        async first() {
          if (sql.includes("schema_metadata")) {
            return schemaVersion === null ? null : { schema_version: schemaVersion };
          }
          return null;
        },
      };
    },
  };
}

test("public version endpoint exposes source and runtime traceability without authentication", async () => {
  const request = new Request("https://api.example.test/api/version");
  const response = await worker.fetch(request, {
    SOURCE_COMMIT: "7B5686157975AB2295D74F9EDF5DDB985978D706",
    CF_VERSION_METADATA: {
      id: "worker-version-id",
      tag: "release-4.07",
      timestamp: "2026-08-05T06:45:05Z",
    },
  }, {});
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.release_version, "4.07");
  assert.equal(body.api_version, "2.60");
  assert.equal(body.schema_version, 2);
  assert.equal(body.source_commit, "7b5686157975ab2295d74f9edf5ddb985978d706");
  assert.equal(body.worker_version.id, "worker-version-id");
  assert.equal(response.headers.get("X-Release-Version"), "4.07");
  assert.equal(response.headers.get("X-API-Version"), "2.60");
  assert.equal(response.headers.get("X-Worker-Version-Id"), "worker-version-id");
});

test("public health endpoint verifies D1 tables and schema metadata", async () => {
  const request = new Request("https://api.example.test/api/health");
  const response = await worker.fetch(request, { DB: healthyDb() }, {});
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.observed_schema_version, 2);
  assert.deepEqual(body.checks, { database: "ok", schema: "ok" });
});

test("health endpoint fails closed when schema metadata is missing", async () => {
  const request = new Request("https://api.example.test/api/health");
  const response = await worker.fetch(request, { DB: healthyDb(null) }, {});
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.status, "degraded");
  assert.deepEqual(body.checks, { database: "ok", schema: "degraded" });
});

test("public operational endpoints reject unsupported methods", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/api/version", { method: "POST" }),
    {},
    {},
  );
  const body = await response.json();
  assert.equal(response.status, 405);
  assert.equal(body.error_meta.code, "METHOD_NOT_ALLOWED");
});

test("build metadata sanitizes untrusted deployment variables", () => {
  const metadata = __test.getBuildMetadata({
    RELEASE_VERSION: "4.05\r\nInjected",
    API_VERSION: "2.58",
    SCHEMA_VERSION: "not-a-number",
    SOURCE_COMMIT: "not a commit",
  });
  assert.equal(metadata.release_version, "4.07");
  assert.equal(metadata.api_version, "2.60");
  assert.equal(metadata.schema_version, 2);
  assert.equal(metadata.source_commit, "development");
});

test("production config renderer rejects sentinel IDs, reviewed staging D1, and non-exact commit SHAs", () => {
  const validId = "11111111-1111-4111-8111-111111111111";
  const exactSha = "7b5686157975ab2295d74f9edf5ddb985978d706";
  const sentinel = runRenderer({
    CLOUDFLARE_D1_DATABASE_ID: "00000000-0000-0000-0000-000000000000",
    CLOUDFLARE_D1_DATABASE_NAME: UNVERIFIED_PRODUCTION_D1_NAME,
    SOURCE_COMMIT: exactSha,
  });
  assert.notEqual(sentinel.status, 0);
  assert.match(sentinel.stderr, /non-sentinel D1 UUID/);

  const stagingName = runRenderer({
    CLOUDFLARE_D1_DATABASE_ID: validId,
    CLOUDFLARE_D1_DATABASE_NAME: "trading-journal-staging",
    SOURCE_COMMIT: exactSha,
  });
  assert.notEqual(stagingName.status, 0);
  assert.match(stagingName.stderr, /reviewed staging D1 database name/);

  const shortSha = runRenderer({
    CLOUDFLARE_D1_DATABASE_ID: validId,
    CLOUDFLARE_D1_DATABASE_NAME: UNVERIFIED_PRODUCTION_D1_NAME,
    SOURCE_COMMIT: exactSha.slice(0, 12),
  });
  assert.notEqual(shortSha.status, 0);
  assert.match(shortSha.stderr, /exact 40-character Git commit SHA/);
});

test("production config renderer follows the tracked D1 authority state", async () => {
  const contract = JSON.parse(await readFile("config/deployment-environments.json", "utf8"));
  const directory = await mkdtemp(join(tmpdir(), "pr05-wrangler-"));
  const output = join(directory, "deploy.toml");
  const exactSha = "7b5686157975ab2295d74f9edf5ddb985978d706";
  try {
    const result = runRenderer({
      CLOUDFLARE_D1_DATABASE_ID: "11111111-1111-4111-8111-111111111111",
      CLOUDFLARE_D1_DATABASE_NAME: UNVERIFIED_PRODUCTION_D1_NAME,
      SOURCE_COMMIT: exactSha.toUpperCase(),
      WRANGLER_OUTPUT: output,
    });

    if (contract.production.d1_identity_status === "verified") {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /does not match reviewed authority/);
      return;
    }

    assert.equal(contract.production.d1_identity_status, "unverified");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Production D1 authority status: unverified/);
    const rendered = await readFile(output, "utf8");
    const mainMatch = rendered.match(/^main = "([^"]+)"$/m);
    const migrationsMatch = rendered.match(/^migrations_dir = "([^"]+)"$/m);
    assert.ok(mainMatch, "rendered config must contain exactly one main path");
    assert.ok(migrationsMatch, "rendered config must contain exactly one migrations path");
    assert.equal(resolve(dirname(output), mainMatch[1]), resolve("worker-entry.js"));
    assert.equal(resolve(dirname(output), migrationsMatch[1]), resolve("migrations"));
    assert.match(rendered, new RegExp(`database_name = "${UNVERIFIED_PRODUCTION_D1_NAME}"`));
    assert.match(rendered, /database_id = "11111111-1111-4111-8111-111111111111"/);
    assert.match(rendered, new RegExp(`SOURCE_COMMIT = "${exactSha}"`));
    assert.doesNotMatch(rendered, /00000000-0000-0000-0000-000000000000/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("tracked production environment contract is internally consistent across the identity transition", async () => {
  const contract = JSON.parse(await readFile("config/deployment-environments.json", "utf8"));
  const production = contract.production;
  const stagingName = contract.staging.d1_database_name;

  assert.ok(["unverified", "verified"].includes(production.d1_identity_status));
  assert.equal(stagingName, "trading-journal-staging");

  if (production.d1_identity_status === "unverified") {
    assert.equal(production.d1_database_name, null);
    assert.equal(production.d1_database_id_sha256, null);
    return;
  }

  assert.match(production.d1_database_name, /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
  assert.match(production.d1_database_id_sha256, /^[0-9a-f]{64}$/i);
  assert.notEqual(production.d1_database_name, stagingName);
});

test("tracked Worker manifest distinguishes deployment entry from one canonical source", async () => {
  const manifest = JSON.parse(await readFile("worker-manifest.json", "utf8"));
  const config = await readFile("wrangler.toml", "utf8");
  const entry = await readFile("worker-entry.js", "utf8");

  assert.equal(manifest.deploymentEntry, "worker-entry.js");
  assert.equal(manifest.canonicalSource, "worker.js");
  assert.equal(manifest.legacyArchive, "cloudflare worker/");
  assert.match(config, /main = "worker-entry\.js"/);
  assert.match(entry, /from '\.\/worker\.js'/);
  assert.match(entry, /ALLOWED_ORIGINS/);
  assert.match(config, /database_id = "00000000-0000-0000-0000-000000000000"/);
});

function runRenderer(extraEnv) {
  return spawnSync(process.execPath, ["tools/render_wrangler_config.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
}
