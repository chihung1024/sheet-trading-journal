import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export function validateRecoveryEvidenceGate({ manifest, gate }) {
  const errors = [];
  const schemaVersion = Number(manifest?.schemaVersion);
  const maxWithoutPass = Number(gate?.max_schema_version_without_pass);

  if (!Number.isInteger(schemaVersion) || schemaVersion < 0) {
    errors.push("worker manifest schemaVersion must be a non-negative integer");
  }
  if (!Number.isInteger(maxWithoutPass) || maxWithoutPass < 0) {
    errors.push("recovery gate max_schema_version_without_pass must be a non-negative integer");
  }
  if (!Array.isArray(gate?.required_evidence) || gate.required_evidence.length === 0) {
    errors.push("recovery gate required_evidence must be a non-empty array");
  }

  if (errors.length === 0 && schemaVersion > maxWithoutPass) {
    if (gate.status !== "passed") {
      errors.push(
        `schema ${schemaVersion} is blocked until Recovery Evidence Gate is passed; current status=${String(gate.status || "missing")}`,
      );
    }
    if (typeof gate.passed_at !== "string" || !Number.isFinite(Date.parse(gate.passed_at))) {
      errors.push("passed recovery gate requires an ISO passed_at timestamp");
    }
    const evidence = gate.evidence;
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
      errors.push("passed recovery gate requires an evidence object");
    } else {
      for (const key of gate.required_evidence) {
        const value = evidence[key];
        if (typeof value !== "string" || value.trim().length === 0) {
          errors.push(`passed recovery gate is missing evidence: ${key}`);
        }
      }
    }
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    schemaVersion: Number.isInteger(schemaVersion) ? schemaVersion : null,
    gateStatus: typeof gate?.status === "string" ? gate.status : null,
    maxSchemaVersionWithoutPass: Number.isInteger(maxWithoutPass) ? maxWithoutPass : null,
  });
}

export async function verifyRecoveryEvidenceGate({
  manifestPath = "worker-manifest.json",
  gatePath = "config/recovery-evidence-gate.json",
} = {}) {
  const [manifestRaw, gateRaw] = await Promise.all([
    readFile(manifestPath, "utf8"),
    readFile(gatePath, "utf8"),
  ]);
  const result = validateRecoveryEvidenceGate({
    manifest: JSON.parse(manifestRaw),
    gate: JSON.parse(gateRaw),
  });
  if (!result.ok) {
    throw new Error(`Recovery Evidence Gate failed:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
  }
  return result;
}

async function runCli() {
  try {
    const result = await verifyRecoveryEvidenceGate();
    console.log(
      `Recovery Evidence Gate check passed for schema=${result.schemaVersion}; gate=${result.gateStatus}; max_without_pass=${result.maxSchemaVersionWithoutPass}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Recovery Evidence Gate failed");
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  await runCli();
}
