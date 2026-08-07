import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { relative, resolve, sep } from "node:path";

const SHA_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const EXPECTED_EVIDENCE_ROOT = "docs/governance/evidence/recovery";

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

  const requiresEvidence = errors.length === 0 && schemaVersion > maxWithoutPass;
  if (requiresEvidence) {
    if (gate.status !== "passed") {
      errors.push(
        `schema ${schemaVersion} is blocked until Recovery Evidence Gate is passed; current status=${String(gate.status || "missing")}`,
      );
    }
    if (typeof gate.passed_at !== "string" || !Number.isFinite(Date.parse(gate.passed_at))) {
      errors.push("passed recovery gate requires an ISO passed_at timestamp");
    }
    if (typeof gate.baseline_sha !== "string" || !SHA_RE.test(gate.baseline_sha)) {
      errors.push("passed recovery gate requires an exact 40-character baseline_sha");
    }
    if (gate.evidence_root !== EXPECTED_EVIDENCE_ROOT) {
      errors.push(`recovery gate evidence_root must equal ${EXPECTED_EVIDENCE_ROOT}`);
    }
    const evidence = gate.evidence;
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
      errors.push("passed recovery gate requires an evidence object");
    } else {
      for (const key of gate.required_evidence) {
        const value = evidence[key];
        if (typeof value !== "string" || value.trim().length === 0) {
          errors.push(`passed recovery gate is missing evidence: ${key}`);
          continue;
        }
        const normalized = value.replaceAll("\\", "/");
        if (
          normalized.startsWith("/") ||
          normalized.includes("../") ||
          !normalized.startsWith(`${EXPECTED_EVIDENCE_ROOT}/`) ||
          !normalized.endsWith(".json")
        ) {
          errors.push(`recovery evidence path is outside the controlled JSON evidence root: ${key}`);
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
    requiresEvidence,
  });
}

export function validateRecoveryEvidenceDocument({ document, evidenceType, gate }) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return Object.freeze({ ok: false, errors: Object.freeze([`${evidenceType} evidence must be a JSON object`]) });
  }

  if (document.schema_version !== 1) {
    errors.push(`${evidenceType} evidence schema_version must equal 1`);
  }
  if (document.evidence_type !== evidenceType) {
    errors.push(`${evidenceType} evidence_type mismatch`);
  }
  if (document.status !== "passed") {
    errors.push(`${evidenceType} evidence status must equal passed`);
  }
  if (typeof document.executed_at !== "string" || !Number.isFinite(Date.parse(document.executed_at))) {
    errors.push(`${evidenceType} evidence requires an ISO executed_at timestamp`);
  } else if (
    typeof gate?.passed_at === "string" &&
    Number.isFinite(Date.parse(gate.passed_at)) &&
    Date.parse(document.executed_at) > Date.parse(gate.passed_at)
  ) {
    errors.push(`${evidenceType} evidence cannot be executed after gate passed_at`);
  }
  if (typeof document.baseline_sha !== "string" || !SHA_RE.test(document.baseline_sha)) {
    errors.push(`${evidenceType} evidence requires an exact 40-character baseline_sha`);
  } else if (document.baseline_sha.toLowerCase() !== String(gate?.baseline_sha || "").toLowerCase()) {
    errors.push(`${evidenceType} evidence baseline_sha does not match the gate baseline`);
  }

  const proof = document.proof;
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
    errors.push(`${evidenceType} evidence requires a proof object`);
  } else {
    if (typeof proof.method !== "string" || proof.method.trim().length === 0) {
      errors.push(`${evidenceType} proof.method is required`);
    }
    if (proof.result !== "pass") {
      errors.push(`${evidenceType} proof.result must equal pass`);
    }
    if (typeof proof.artifact_reference !== "string" || proof.artifact_reference.trim().length === 0) {
      errors.push(`${evidenceType} proof.artifact_reference is required`);
    }
    if (typeof proof.artifact_sha256 !== "string" || !SHA256_RE.test(proof.artifact_sha256)) {
      errors.push(`${evidenceType} proof.artifact_sha256 must be a 64-character SHA-256 digest`);
    }
    if (typeof proof.summary !== "string" || proof.summary.trim().length === 0) {
      errors.push(`${evidenceType} proof.summary is required`);
    }
  }

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export async function verifyRecoveryEvidenceGate({
  manifestPath = "worker-manifest.json",
  gatePath = "config/recovery-evidence-gate.json",
  repoRoot = ".",
} = {}) {
  const [manifestRaw, gateRaw] = await Promise.all([
    readFile(manifestPath, "utf8"),
    readFile(gatePath, "utf8"),
  ]);
  const manifest = JSON.parse(manifestRaw);
  const gate = JSON.parse(gateRaw);
  const result = validateRecoveryEvidenceGate({ manifest, gate });
  const errors = [...result.errors];

  if (result.ok && result.requiresEvidence) {
    const absoluteRepoRoot = resolve(repoRoot);
    const absoluteEvidenceRoot = resolve(absoluteRepoRoot, EXPECTED_EVIDENCE_ROOT);
    for (const key of gate.required_evidence) {
      const evidenceReference = gate.evidence[key];
      const absoluteEvidencePath = resolve(absoluteRepoRoot, evidenceReference);
      const rel = relative(absoluteEvidenceRoot, absoluteEvidencePath);
      if (rel === "" || rel.startsWith(`..${sep}`) || rel === ".." || resolve(absoluteEvidencePath) === absoluteEvidenceRoot) {
        errors.push(`recovery evidence path escapes or aliases the controlled root: ${key}`);
        continue;
      }

      let document;
      try {
        document = JSON.parse(await readFile(absoluteEvidencePath, "utf8"));
      } catch (error) {
        errors.push(`${key} recovery evidence cannot be read as JSON: ${error instanceof Error ? error.message : "unknown error"}`);
        continue;
      }
      const documentResult = validateRecoveryEvidenceDocument({ document, evidenceType: key, gate });
      errors.push(...documentResult.errors);
    }
  }

  if (errors.length) {
    throw new Error(`Recovery Evidence Gate failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  return Object.freeze({ ...result, evidenceVerified: result.requiresEvidence });
}

async function runCli() {
  try {
    const result = await verifyRecoveryEvidenceGate();
    console.log(
      `Recovery Evidence Gate check passed for schema=${result.schemaVersion}; gate=${result.gateStatus}; max_without_pass=${result.maxSchemaVersionWithoutPass}; evidence_verified=${result.evidenceVerified}`,
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
