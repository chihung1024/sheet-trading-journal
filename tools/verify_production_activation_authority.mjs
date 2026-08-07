import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { relative, resolve, sep } from "node:path";

const SHA_RE = /^[0-9a-f]{40}$/i;
const EVIDENCE_ROOT = "docs/governance/evidence/production-activation";

export function validateProductionActivationAuthority({ authority, requestedSha, requireReady = true }) {
  const errors = [];
  const normalizedRequestedSha = String(requestedSha || "").trim().toLowerCase();
  const checks = authority?.required_checks;

  if (!SHA_RE.test(normalizedRequestedSha)) {
    errors.push("production activation requires an exact 40-character requested SHA");
  }
  if (!authority || typeof authority !== "object" || Array.isArray(authority)) {
    errors.push("production activation authority must be a JSON object");
  } else {
    if (authority.schema_version !== 1) errors.push("production activation authority schema_version must equal 1");
    if (authority.authority_id !== "PRODUCTION-ACTIVATION-AUTHORITY") {
      errors.push("production activation authority_id mismatch");
    }
    if (!new Set(["blocked", "ready"]).has(authority.status)) {
      errors.push("production activation status must be blocked or ready");
    }
    if (!checks || typeof checks !== "object" || Array.isArray(checks) || Object.keys(checks).length === 0) {
      errors.push("production activation required_checks must be a non-empty object");
    }
  }

  if (requireReady && authority?.status !== "ready") {
    errors.push(`production activation is blocked; current status=${String(authority?.status || "missing")}`);
  }

  if (authority?.status === "ready") {
    const authorizedSha = String(authority.authorized_source_sha || "").trim().toLowerCase();
    if (!SHA_RE.test(authorizedSha)) {
      errors.push("ready production authority requires an exact authorized_source_sha");
    } else if (SHA_RE.test(normalizedRequestedSha) && authorizedSha !== normalizedRequestedSha) {
      errors.push(`requested SHA is not the authorized production source: ${normalizedRequestedSha} != ${authorizedSha}`);
    }
    if (typeof authority.approved_at !== "string" || !Number.isFinite(Date.parse(authority.approved_at))) {
      errors.push("ready production authority requires an ISO approved_at timestamp");
    }
    if (checks && typeof checks === "object" && !Array.isArray(checks)) {
      for (const [name, state] of Object.entries(checks)) {
        if (state !== "passed") errors.push(`production activation check is not passed: ${name}`);
      }
    }
    const evidence = authority.evidence;
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
      errors.push("ready production authority requires an evidence object");
    } else if (checks && typeof checks === "object" && !Array.isArray(checks)) {
      for (const name of Object.keys(checks)) {
        const reference = evidence[name];
        const normalized = String(reference || "").replaceAll("\\", "/");
        if (
          !normalized.startsWith(`${EVIDENCE_ROOT}/`) ||
          normalized.startsWith("/") ||
          normalized.includes("../") ||
          !normalized.endsWith(".json")
        ) {
          errors.push(`production activation evidence path is invalid: ${name}`);
        }
      }
    }
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    status: authority?.status || null,
    requestedSha: SHA_RE.test(normalizedRequestedSha) ? normalizedRequestedSha : null,
    requiresEvidenceVerification: authority?.status === "ready" && errors.length === 0,
  });
}

export function validateProductionActivationEvidence({ document, checkName, authority }) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return Object.freeze({ ok: false, errors: Object.freeze([`${checkName} evidence must be a JSON object`]) });
  }
  if (document.schema_version !== 1) errors.push(`${checkName} evidence schema_version must equal 1`);
  if (document.check_name !== checkName) errors.push(`${checkName} evidence check_name mismatch`);
  if (document.status !== "passed") errors.push(`${checkName} evidence status must equal passed`);
  if (typeof document.observed_at !== "string" || !Number.isFinite(Date.parse(document.observed_at))) {
    errors.push(`${checkName} evidence requires an ISO observed_at timestamp`);
  } else if (
    typeof authority?.approved_at === "string" &&
    Number.isFinite(Date.parse(authority.approved_at)) &&
    Date.parse(document.observed_at) > Date.parse(authority.approved_at)
  ) {
    errors.push(`${checkName} evidence cannot be observed after authority approved_at`);
  }
  if (
    typeof document.source_sha !== "string" ||
    !SHA_RE.test(document.source_sha) ||
    document.source_sha.toLowerCase() !== String(authority?.authorized_source_sha || "").toLowerCase()
  ) {
    errors.push(`${checkName} evidence source_sha must match authorized_source_sha`);
  }
  if (!document.proof || typeof document.proof !== "object" || Array.isArray(document.proof)) {
    errors.push(`${checkName} evidence requires a proof object`);
  } else {
    if (document.proof.result !== "pass") errors.push(`${checkName} proof.result must equal pass`);
    if (typeof document.proof.summary !== "string" || document.proof.summary.trim().length === 0) {
      errors.push(`${checkName} proof.summary is required`);
    }
    if (typeof document.proof.artifact_reference !== "string" || document.proof.artifact_reference.trim().length === 0) {
      errors.push(`${checkName} proof.artifact_reference is required`);
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export async function verifyProductionActivationAuthority({
  authorityPath = "config/production-activation-authority.json",
  requestedSha = process.env.EXPECTED_SHA,
  repoRoot = ".",
  requireReady = true,
} = {}) {
  const authority = JSON.parse(await readFile(authorityPath, "utf8"));
  const result = validateProductionActivationAuthority({ authority, requestedSha, requireReady });
  const errors = [...result.errors];

  if (result.requiresEvidenceVerification) {
    const absoluteRepoRoot = resolve(repoRoot);
    const absoluteEvidenceRoot = resolve(absoluteRepoRoot, EVIDENCE_ROOT);
    for (const checkName of Object.keys(authority.required_checks)) {
      const reference = authority.evidence[checkName];
      const absolutePath = resolve(absoluteRepoRoot, reference);
      const rel = relative(absoluteEvidenceRoot, absolutePath);
      if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`)) {
        errors.push(`production activation evidence escapes controlled root: ${checkName}`);
        continue;
      }
      let document;
      try {
        document = JSON.parse(await readFile(absolutePath, "utf8"));
      } catch (error) {
        errors.push(`${checkName} evidence cannot be read as JSON: ${error instanceof Error ? error.message : "unknown error"}`);
        continue;
      }
      const documentResult = validateProductionActivationEvidence({ document, checkName, authority });
      errors.push(...documentResult.errors);
    }
  }

  if (errors.length) {
    throw new Error(`Production activation authority failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  return Object.freeze({ ...result, evidenceVerified: result.requiresEvidenceVerification });
}

async function runCli() {
  try {
    const result = await verifyProductionActivationAuthority();
    console.log(`Production activation authority passed: source=${result.requestedSha}; evidence_verified=${result.evidenceVerified}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Production activation authority failed");
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
