import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker, { __test } from "../worker.js";

function healthyDb(schemaVersion = 1) {
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
      tag: "release-4.05",
      timestamp: "2026-08-05T06:45:05Z",
    },
  }, {});
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.release_version, "4.05");
  assert.equal(body.api_version, "2.57");
  assert.equal(body.schema_version, 1);
  assert.equal(body.source_commit, "7b5686157975ab2295d74f9edf5ddb985978d706");
  assert.equal(body.worker_version.id, "worker-version-id");
  assert.equal(response.headers.get("X-Release-Version"), "4.05");
  assert.equal(response.headers.get("X-API-Version"), "2.57");
  assert.equal(response.headers.get("X-Worker-Version-Id"), "worker-version-id");
});

test("public health endpoint verifies D1 tables and schema metadata", async () => {
  const request = new Request("https://api.example.test/api/health");
  const response = await worker.fetch(request, { DB: healthyDb() }, {});
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.observed_schema_version, 1);
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
    API_VERSION: "2.57",
    SCHEMA_VERSION: "not-a-number",
    SOURCE_COMMIT: "not a commit",
  });
  assert.equal(metadata.release_version, "4.05Injected");
  assert.equal(metadata.schema_version, 1);
  assert.equal(metadata.source_commit, "development");
});

test("tracked Worker manifest keeps one canonical source and archived legacy files", async () => {
  const manifest = JSON.parse(await readFile("worker-manifest.json", "utf8"));
  const config = await readFile("wrangler.toml", "utf8");
  assert.equal(manifest.canonicalSource, "worker.js");
  assert.equal(manifest.legacyArchive, "cloudflare worker/");
  assert.match(config, /main = "worker\.js"/);
  assert.match(config, /database_id = "00000000-0000-0000-0000-000000000000"/);
});
