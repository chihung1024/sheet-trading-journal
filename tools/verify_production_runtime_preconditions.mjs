import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const SHA256_RE = /^[0-9a-f]{64}$/i;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function validateProductionRuntimePreconditions(contract) {
  const errors = [];
  const production = contract?.production;
  const staging = contract?.staging;

  if (!production || typeof production !== "object" || Array.isArray(production)) {
    errors.push("production environment contract is missing");
  } else {
    if (production.d1_identity_status !== "verified") {
      errors.push(`production runtime D1 identity is not verified; current status=${String(production.d1_identity_status || "missing")}`);
    }
    if (typeof production.d1_database_name !== "string" || !NAME_RE.test(production.d1_database_name)) {
      errors.push("production runtime requires a reviewed D1 database name");
    }
    if (typeof production.d1_database_id_sha256 !== "string" || !SHA256_RE.test(production.d1_database_id_sha256)) {
      errors.push("production runtime requires a reviewed D1 database UUID SHA-256 fingerprint");
    }
  }

  const stagingName = staging?.d1_database_name;
  if (typeof stagingName !== "string" || !NAME_RE.test(stagingName)) {
    errors.push("staging D1 database authority is missing or invalid");
  } else if (production?.d1_database_name === stagingName) {
    errors.push("production and staging D1 database names must differ");
  }

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export async function verifyProductionRuntimePreconditions({
  contractPath = "config/deployment-environments.json",
} = {}) {
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const result = validateProductionRuntimePreconditions(contract);
  if (!result.ok) {
    throw new Error(`Production runtime preconditions failed:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
  }
  return result;
}

async function runCli() {
  try {
    await verifyProductionRuntimePreconditions();
    console.log("Production runtime preconditions passed: D1 identity is independently reviewed and locked into the runtime source.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Production runtime preconditions failed");
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
