import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


test("portfolio store preserves additive calculation_manifest on snapshot root", async () => {
  const source = await readFile(new URL("../src/stores/portfolio.js", import.meta.url), "utf8");

  assert.match(source, /rawData\.value\s*=\s*json\.data/);
  assert.doesNotMatch(source, /delete\s+(?:json\.data|rawData\.value)\.calculation_manifest/);
  assert.doesNotMatch(source, /calculation_manifest\s*:\s*undefined/);

  const fetchStart = source.indexOf("const fetchSnapshot = async () => {");
  const fetchEnd = source.indexOf("const fetchRecords = async", fetchStart);
  assert.notEqual(fetchStart, -1);
  assert.notEqual(fetchEnd, -1);

  const fetchBlock = source.slice(fetchStart, fetchEnd);
  assert.match(fetchBlock, /const json = await response\.json\(\)/);
  assert.match(fetchBlock, /rawData\.value\s*=\s*json\.data/);
  assert.doesNotMatch(fetchBlock, /\{\s*summary\s*,\s*holdings\s*,\s*history\s*\}\s*=\s*json\.data/);
});
