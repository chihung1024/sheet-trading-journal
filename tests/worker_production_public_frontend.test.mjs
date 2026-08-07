import assert from "node:assert/strict";
import test from "node:test";

import { validateProductionPublicSnapshot } from "../tools/verify_production_public_frontend.mjs";

const PROD_API = "https://journal-backend.chired.workers.dev";
const STAGING_API = "https://journal-backend-staging.chired.workers.dev";
const PROD_CLIENT = "951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com";
const SOURCE = "1234567890abcdef1234567890abcdef12345678";

const contract = {
  production: {
    api_origins: [PROD_API],
    google_client_ids: [PROD_CLIENT],
    frontend_origins: ["https://sheet-trading-journal.pages.dev", "https://chihung1024.github.io"],
  },
  staging: { api_origin: STAGING_API },
};

function snapshot(overrides = {}) {
  const csp = `default-src 'self'; connect-src 'self' ${PROD_API}; script-src 'self' https://accounts.google.com`;
  return {
    pageUrl: "https://sheet-trading-journal.pages.dev/",
    html: `<html><head><meta http-equiv="Content-Security-Policy" content="${csp}"></head><body><script type="module" src="/assets/index.js"></script></body></html>`,
    headers: { "content-security-policy": csp },
    assets: [{ url: "https://sheet-trading-journal.pages.dev/assets/index.js", body: `const api="${PROD_API}";const client="${PROD_CLIENT}";` }],
    workerVersion: {
      success: true,
      status: "ok",
      service: "trading-journal-api",
      source_commit: SOURCE,
      release_version: "4.07",
      api_version: "2.60",
      schema_version: 2,
      worker_version: { id: "worker-version-id" },
    },
    workerHealth: {
      success: true,
      status: "ok",
      source_commit: SOURCE,
      observed_schema_version: 2,
      checks: { database: "ok", schema: "ok" },
    },
    contract,
    ...overrides,
  };
}

test("public production proof passes exact CSP, bundle, and Worker health identity", () => {
  const result = validateProductionPublicSnapshot(snapshot());
  assert.equal(result.ok, true);
  assert.equal(result.evidence.status, "passed");
  assert.equal(result.evidence.worker.source_commit, SOURCE);
  assert.equal(result.evidence.page.asset_count, 1);
  assert.match(result.evidence.page.html_sha256, /^[0-9a-f]{64}$/);
});

test("public production proof fails if either CSP surface authorizes staging", () => {
  const base = snapshot();
  const result = validateProductionPublicSnapshot({
    ...base,
    headers: { "content-security-policy": `${base.headers["content-security-policy"]} ${STAGING_API}` },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /header CSP authorizes staging API origin/);
});

test("public production proof fails if served bundle falls back to staging or omits production identity", () => {
  const base = snapshot();
  const result = validateProductionPublicSnapshot({
    ...base,
    assets: [{ url: base.assets[0].url, body: `const api="${STAGING_API}";` }],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /does not contain the production API origin/);
  assert.match(result.errors.join("\n"), /does not contain the reviewed production Google client ID/);
  assert.match(result.errors.join("\n"), /contains the staging API origin/);
});

test("public production proof fails closed for unhealthy or non-exact Worker identity", () => {
  const base = snapshot();
  const result = validateProductionPublicSnapshot({
    ...base,
    workerVersion: { ...base.workerVersion, source_commit: "short", release_version: "4.08" },
    workerHealth: { ...base.workerHealth, source_commit: "different", observed_schema_version: 3 },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /source_commit is not an exact 40-character SHA/);
  assert.match(result.errors.join("\n"), /release is not 4.07/);
  assert.match(result.errors.join("\n"), /observed D1 schema is not exactly 2/);
});

test("public evidence never stores served JavaScript or OAuth/API values", () => {
  const result = validateProductionPublicSnapshot(snapshot());
  const serialized = JSON.stringify(result.evidence);
  assert.equal(serialized.includes(PROD_CLIENT), false);
  assert.equal(serialized.includes(PROD_API), false);
  assert.equal(serialized.includes("const api="), false);
});
