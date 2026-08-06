import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const EXACT_SHA = "3f5f3d385bbfe0137d17b1e681ece2e963c6c0c0";
const TEST_OUTPUT = resolve(".wrangler/pr05-rendered-path-test.toml");

test("rendered Wrangler config preserves deployment entry and migration paths", async () => {
  await rm(TEST_OUTPUT, { force: true });
  try {
    const render = spawnSync(process.execPath, ["tools/render_wrangler_config.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        CLOUDFLARE_D1_DATABASE_ID: "11111111-1111-4111-8111-111111111111",
        CLOUDFLARE_D1_DATABASE_NAME: "journal-production",
        SOURCE_COMMIT: EXACT_SHA,
        WRANGLER_OUTPUT: TEST_OUTPUT,
      },
    });
    assert.equal(render.status, 0, render.stderr);

    const config = await readFile(TEST_OUTPUT, "utf8");
    assert.match(config, /^main = "\.\.\/worker-entry\.js"$/m);
    assert.match(config, /^migrations_dir = "\.\.\/migrations"$/m);

    assert.equal(
      resolve(dirname(TEST_OUTPUT), "../worker-entry.js"),
      resolve("worker-entry.js"),
    );
    assert.equal(
      resolve(dirname(TEST_OUTPUT), "../migrations"),
      resolve("migrations"),
    );

    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const migrationList = spawnSync(
      npx,
      ["wrangler", "d1", "migrations", "list", "DB", "--local", "--config", TEST_OUTPUT],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(
      migrationList.status,
      0,
      `${migrationList.stdout}\n${migrationList.stderr}`,
    );
    assert.match(
      `${migrationList.stdout}\n${migrationList.stderr}`,
      /0001_baseline\.sql/,
    );

    const dryRun = spawnSync(
      npx,
      ["wrangler", "deploy", "--dry-run", "--config", TEST_OUTPUT],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`);
  } finally {
    await rm(TEST_OUTPUT, { force: true });
  }
});
