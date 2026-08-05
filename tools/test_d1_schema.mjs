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
if (Number(row?.schema_version) !== 1 || row?.release_version !== "4.05") {
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
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('records','portfolio_snapshots','user_settings','schema_metadata') ORDER BY name;",
  "--json",
], true);
const tables = JSON.parse(tablesResult.stdout)?.[0]?.results?.map((item) => item.name) || [];
const expected = ["portfolio_snapshots", "records", "schema_metadata", "user_settings"];
if (JSON.stringify(tables) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected D1 tables: ${JSON.stringify(tables)}`);
}
console.log("D1 baseline migration applied and verified locally.");

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
