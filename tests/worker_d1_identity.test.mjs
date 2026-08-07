import assert from "node:assert/strict";
import test from "node:test";

import { validateD1Identity } from "../tools/verify_d1_identity.mjs";

const EXPECTED_ID = "12345678-1234-4abc-8def-1234567890ab";
const EXPECTED_NAME = "trading-journal-production";

test("accepts exact D1 database identity", () => {
  const result = validateD1Identity({
    info: { uuid: EXPECTED_ID, name: EXPECTED_NAME },
    expectedId: EXPECTED_ID,
    expectedName: EXPECTED_NAME,
  });
  assert.equal(result.ok, true);
});

test("rejects same-name database with a different UUID", () => {
  const result = validateD1Identity({
    info: { uuid: "87654321-4321-4abc-8def-ba0987654321", name: EXPECTED_NAME },
    expectedId: EXPECTED_ID,
    expectedName: EXPECTED_NAME,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /database ID mismatch/);
});

test("rejects same UUID with a different database name", () => {
  const result = validateD1Identity({
    info: { uuid: EXPECTED_ID, name: "staging-database" },
    expectedId: EXPECTED_ID,
    expectedName: EXPECTED_NAME,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /database name mismatch/);
});

test("fails closed for malformed D1 info", () => {
  const result = validateD1Identity({
    info: {},
    expectedId: EXPECTED_ID,
    expectedName: EXPECTED_NAME,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /valid database UUID/);
  assert.match(result.errors.join("\n"), /database name/);
});
