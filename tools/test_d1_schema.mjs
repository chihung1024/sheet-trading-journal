import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await rm(".wrangler/state", { recursive: true, force: true });
run(["wrangler", "d1", "migrations", "apply", "DB", "--local", "--config", "wrangler.toml"]);
const result = run([
  "wrangler",
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  "wrangler.toml",
  "--command",
  "SELECT schema_version, release_version FROM schema_metadata WHERE id = 1;",
  "--json",
], true);

const parsed = JSON.parse(result.stdout);
const row = parsed?.[0]?.results?.[0];
if (Number(row?.schema_version) !== 2 || row?.release_version !== "4.07") {
  throw new Error(`Unexpected schema metadata: ${JSON.stringify(row)}`);
}

const tablesResult = run([
  "wrangler",
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  "wrangler.toml",
  "--command",
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('records','portfolio_snapshots','user_settings','schema_metadata','calculation_jobs') ORDER BY name;",
  "--json",
], true);
const tables = JSON.parse(tablesResult.stdout)?.[0]?.results?.map((item) => item.name) || [];
const expected = ["calculation_jobs", "portfolio_snapshots", "records", "schema_metadata", "user_settings"];
if (JSON.stringify(tables) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected D1 tables: ${JSON.stringify(tables)}`);
}
const indexesResult = run([
  "wrangler", "d1", "execute", "DB", "--local", "--config", "wrangler.toml",
  "--command", "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_calculation_jobs_user_created','idx_calculation_jobs_status_created') ORDER BY name;",
  "--json",
], true);
const indexes = JSON.parse(indexesResult.stdout)?.[0]?.results?.map((item) => item.name) || [];
if (JSON.stringify(indexes) !== JSON.stringify(["idx_calculation_jobs_status_created", "idx_calculation_jobs_user_created"])) {
  throw new Error(`Unexpected calculation job indexes: ${JSON.stringify(indexes)}`);
}

const idempotencyResult = run([
  "wrangler", "d1", "execute", "DB", "--local", "--config", "wrangler.toml",
  "--command", `
    INSERT OR IGNORE INTO calculation_jobs
      (public_id, user_id, idempotency_hash, status, benchmark)
    VALUES
      ('job_ABCDEFGHIJKLMNOPQRSTUV', 'duplicate@example.com', '${"a".repeat(64)}', 'queued', 'SPY');
    INSERT OR IGNORE INTO calculation_jobs
      (public_id, user_id, idempotency_hash, status, benchmark)
    VALUES
      ('job_ZYXWVUTSRQPONMLKJIHGFE', 'duplicate@example.com', '${"a".repeat(64)}', 'queued', 'SPY');
    SELECT COUNT(*) AS total FROM calculation_jobs
    WHERE user_id = 'duplicate@example.com' AND idempotency_hash = '${"a".repeat(64)}';
  `,
  "--json",
], true);
const duplicateCount = Number(JSON.parse(idempotencyResult.stdout)?.at(-1)?.results?.[0]?.total);
if (duplicateCount !== 1) {
  throw new Error(`Calculation job idempotency uniqueness failed: ${duplicateCount}`);
}

console.log("D1 migrations applied and calculation job schema verified locally.");

function run(args, capture = false) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, CI: "true" },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: npx ${args.join(" ")}\n${result.stderr || ""}`);
  }
  return result;
}
