import assert from "node:assert/strict";
import test from "node:test";

import worker from "../worker.js";

function makeDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, binds: [] };
      calls.push(call);
      return {
        bind(...args) {
          call.binds = args;
          return this;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };
}

function representativeManifest() {
  return {
    manifest_version: 1,
    deterministic_identity: {
      identity_version: 1,
      engine_source_commit: "1".repeat(40),
      calculation_as_of: "2026-01-05",
      combined_sha256: "a".repeat(64),
    },
    market_inputs: {
      canonicalization_version: 1,
      sha256: "b".repeat(64),
      symbol_count: 2,
      row_count: 10,
      synthetic_row_counts: { transaction_price_seed: 1 },
    },
    fx_inputs: {
      canonicalization_version: 1,
      sha256: "c".repeat(64),
      currency_count: 2,
      historical_row_count: 4,
      includes_realtime: true,
      realtime_currency_count: 1,
    },
    provider_diagnostics: {
      diagnostics_version: 1,
      price_sources: { NVDA: "Close", "2330.TW": "Close" },
      selection_reasons: { NVDA: "Scheme A", "2330.TW": "Scheme A" },
      realtime_overlay_symbols: ["NVDA"],
    },
    calculated_at: "2026-01-05T15:00:00+08:00",
  };
}

async function postPortfolio(data, db) {
  const request = new Request("https://api.example.test/api/portfolio", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": "system-secret",
    },
    body: JSON.stringify({
      target_user_id: "user@example.com",
      data,
    }),
  });
  return worker.fetch(request, { API_SECRET: "system-secret", DB: db }, {});
}

test("Worker stores calculation_manifest opaquely inside snapshot JSON", async () => {
  const db = makeDb();
  const data = {
    updated_at: "2026-01-05 15:00",
    summary: {},
    holdings: [],
    history: [],
    calculation_manifest: representativeManifest(),
  };

  const response = await postPortfolio(data, db);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);

  const insert = db.calls.find(call => call.sql.includes("INSERT INTO portfolio_snapshots"));
  assert.ok(insert, "portfolio snapshot insert must occur");
  assert.equal(insert.binds[0], "user@example.com");
  assert.deepEqual(JSON.parse(insert.binds[1]), data);
});

test("Worker retains the one MiB request boundary for manifest-bearing snapshots", async () => {
  const db = makeDb();
  const data = {
    summary: {},
    holdings: [],
    history: [],
    calculation_manifest: {
      ...representativeManifest(),
      oversized_test_padding: "x".repeat(1_048_576),
    },
  };

  const response = await postPortfolio(data, db);
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.match(payload.error, /too large/i);
  assert.equal(db.calls.some(call => call.sql.includes("INSERT INTO portfolio_snapshots")), false);
});
