import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateD1Identity({ info, expectedId, expectedName }) {
  const errors = [];
  const normalizedExpectedId = String(expectedId || "").trim().toLowerCase();
  const normalizedExpectedName = String(expectedName || "").trim();
  const object = Array.isArray(info) ? info[0] : info;

  if (!UUID_RE.test(normalizedExpectedId)) {
    errors.push("expected D1 database ID must be a UUID");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(normalizedExpectedName)) {
    errors.push("expected D1 database name is invalid");
  }
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    errors.push("D1 info must be a JSON object");
  }

  let observedId = null;
  let observedName = null;
  if (object && typeof object === "object" && !Array.isArray(object)) {
    observedId = String(
      object.uuid ?? object.id ?? object.database_id ?? object.databaseId ?? "",
    ).trim().toLowerCase();
    observedName = String(
      object.name ?? object.database_name ?? object.databaseName ?? "",
    ).trim();
    if (!UUID_RE.test(observedId)) {
      errors.push("D1 info does not contain a valid database UUID");
    }
    if (!observedName) {
      errors.push("D1 info does not contain a database name");
    }
  }

  if (errors.length === 0) {
    if (observedId !== normalizedExpectedId) {
      errors.push(`D1 database ID mismatch: ${observedId} != ${normalizedExpectedId}`);
    }
    if (observedName !== normalizedExpectedName) {
      errors.push(`D1 database name mismatch: ${observedName} != ${normalizedExpectedName}`);
    }
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    databaseId: observedId,
    databaseName: observedName,
  });
}

function runCli() {
  let info;
  try {
    info = JSON.parse(String(process.env.D1_INFO_JSON || ""));
  } catch {
    console.error("Production D1 identity check failed: D1_INFO_JSON is not valid JSON");
    process.exitCode = 1;
    return;
  }

  const result = validateD1Identity({
    info,
    expectedId: process.env.EXPECTED_D1_DATABASE_ID,
    expectedName: process.env.EXPECTED_D1_DATABASE_NAME,
  });
  if (!result.ok) {
    for (const error of result.errors) console.error(`Production D1 identity failed: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Production D1 identity verified: name=${result.databaseName}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) runCli();
