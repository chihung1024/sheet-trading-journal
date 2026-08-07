import assert from "node:assert/strict";
import test from "node:test";

import { validateCloudflareProductionPredeploy } from "../tools/verify_cloudflare_production_predeploy.mjs";

const PROD_API = "https://journal-backend.chired.workers.dev";
const PROD_FRONTEND = "https://sheet-trading-journal.pages.dev";
const PROD_CLIENT = "951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com";
const STAGING_API = "https://journal-backend-staging.chired.workers.dev";
const D1_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE = "1234567890abcdef1234567890abcdef12345678";
const PAGES_SOURCE = "abcdef1234567890abcdef1234567890abcdef12";

const base = {
  contract: {
    production: {
      api_origins: [PROD_API],
      frontend_origins: [PROD_FRONTEND, "https://chihung1024.github.io"],
      google_client_ids: [PROD_CLIENT],
    },
    staging: {
      api_origin: STAGING_API,
      d1_database_name: "trading-journal-staging",
    },
  },
  manifest: { service: "journal-backend", d1Binding: "DB" },
  publicWorkerVersion: {
    source_commit: SOURCE,
    worker_version: { id: "worker-version-id" },
  },
  workerVersionPayload: {
    success: true,
    result: {
      id: "worker-version-id",
      resources: {
        bindings: [
          { name: "DB", type: "d1", id: D1_ID },
          { name: "API_SECRET", type: "secret_text" },
        ],
      },
    },
  },
  pagesProjectPayload: {
    success: true,
    result: {
      name: "sheet-trading-journal",
      subdomain: "sheet-trading-journal.pages.dev",
      deployment_configs: {
        production: {
          env_vars: {
            VITE_API_URL: { type: "plain_text", value: PROD_API },
            VITE_GOOGLE_CLIENT_ID: { type: "plain_text", value: PROD_CLIENT },
            OTHER_SECRET: { type: "secret_text", value: "must-not-leak" },
          },
        },
      },
    },
  },
  pagesDeploymentsPayload: {
    success: true,
    result: [
      {
        id: "pages-deployment-id",
        environment: "production",
        created_on: "2026-08-07T08:00:00.000Z",
        deployment_trigger: { metadata: { commit_hash: PAGES_SOURCE } },
      },
    ],
  },
  d1DatabasePayload: {
    success: true,
    result: { uuid: D1_ID, name: "real-production-db" },
  },
};

test("Cloudflare predeploy proof links live Worker version to D1 and exact Pages production env", () => {
  const result = validateCloudflareProductionPredeploy(base);
  assert.equal(result.ok, true);
  assert.equal(result.evidence.status, "passed");
  assert.equal(result.evidence.pages.latest_production_commit_sha, PAGES_SOURCE);
  assert.equal(result.evidence.worker.public_worker_version_id, "worker-version-id");
  assert.equal(result.evidence.d1.database_name, "real-production-db");
  assert.match(result.evidence.d1.database_id_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.evidence.d1.database_id_matches_deployed_binding, true);
});

test("Cloudflare predeploy proof rejects absent or mismatched explicit Pages env vars", () => {
  const result = validateCloudflareProductionPredeploy({
    ...base,
    pagesProjectPayload: {
      success: true,
      result: {
        ...base.pagesProjectPayload.result,
        deployment_configs: { production: { env_vars: { VITE_API_URL: { type: "plain_text", value: STAGING_API } } } },
      },
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /VITE_API_URL/);
  assert.match(result.errors.join("\n"), /VITE_GOOGLE_CLIENT_ID/);
});

test("Cloudflare predeploy proof rejects D1 binding or metadata mismatch and staging DB", () => {
  const mismatch = validateCloudflareProductionPredeploy({
    ...base,
    d1DatabasePayload: { success: true, result: { uuid: "22222222-2222-4222-8222-222222222222", name: "other" } },
  });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.errors.join("\n"), /differs from Cloudflare D1 metadata UUID/);

  const staging = validateCloudflareProductionPredeploy({
    ...base,
    d1DatabasePayload: { success: true, result: { uuid: D1_ID, name: "trading-journal-staging" } },
  });
  assert.equal(staging.ok, false);
  assert.match(staging.errors.join("\n"), /reviewed staging D1 database name/);
});

test("Cloudflare predeploy proof rejects a Worker control-plane version not serving the live endpoint", () => {
  const result = validateCloudflareProductionPredeploy({
    ...base,
    workerVersionPayload: {
      success: true,
      result: { ...base.workerVersionPayload.result, id: "different-version" },
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /does not match the live public Worker version ID/);
});

test("sanitized evidence omits raw D1 UUID, Pages env values, and unrelated env secret values", () => {
  const result = validateCloudflareProductionPredeploy(base);
  const serialized = JSON.stringify(result.evidence);
  assert.equal(serialized.includes(D1_ID), false);
  assert.equal(serialized.includes(PROD_CLIENT), false);
  assert.equal(serialized.includes(PROD_API), false);
  assert.equal(serialized.includes("must-not-leak"), false);
  assert.equal(result.evidence.pages.vite_api_url.exact_plain_text_value, true);
  assert.equal(result.evidence.pages.vite_google_client_id.exact_plain_text_value, true);
});
