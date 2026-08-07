import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  validateRecoveryEvidenceDocument,
  validateRecoveryEvidenceGate,
  verifyRecoveryEvidenceGate,
} from "../tools/verify_recovery_evidence_gate.mjs";

const requiredEvidence = [
  "export_backup",
  "restore_drill",
  "rollback_timing",
  "integrity_verification",
  "migration_rollback_forward_strategy",
  "d1_recovery_proof",
];
const BASELINE_SHA = "1234567890abcdef1234567890abcdef12345678";
const EVIDENCE_ROOT = "docs/governance/evidence/recovery";

const blockedGate = {
  status: "blocked",
  max_schema_version_without_pass: 2,
  passed_at: null,
  baseline_sha: null,
  evidence_root: EVIDENCE_ROOT,
  required_evidence: requiredEvidence,
  evidence: {},
};

const evidenceReferences = Object.fromEntries(
  requiredEvidence.map((key) => [key, `${EVIDENCE_ROOT}/${key}_2026-08-07.json`]),
);

function passedGate(overrides = {}) {
  return {
    ...blockedGate,
    status: "passed",
    passed_at: "2026-08-07T08:00:00.000Z",
    baseline_sha: BASELINE_SHA,
    evidence: evidenceReferences,
    ...overrides,
  };
}

function proofDocument(evidenceType, overrides = {}) {
  return {
    schema_version: 1,
    evidence_type: evidenceType,
    status: "passed",
    executed_at: "2026-08-07T07:55:00.000Z",
    baseline_sha: BASELINE_SHA,
    proof: {
      method: "controlled recovery drill",
      result: "pass",
      artifact_reference: `recovery-artifacts/${evidenceType}.json`,
      artifact_sha256: "a".repeat(64),
      summary: `${evidenceType} verified during the controlled recovery drill`,
    },
    ...overrides,
  };
}

test("schema 2 remains deployable while recovery gate is blocked", () => {
  const result = validateRecoveryEvidenceGate({
    manifest: { schemaVersion: 2 },
    gate: blockedGate,
  });
  assert.equal(result.ok, true);
  assert.equal(result.requiresEvidence, false);
});

test("schema 3 fails closed while recovery evidence gate is blocked", () => {
  const result = validateRecoveryEvidenceGate({
    manifest: { schemaVersion: 3 },
    gate: blockedGate,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /schema 3 is blocked/);
});

test("status passed is insufficient without baseline and controlled evidence paths", () => {
  const result = validateRecoveryEvidenceGate({
    manifest: { schemaVersion: 3 },
    gate: {
      ...blockedGate,
      status: "passed",
      passed_at: "2026-08-07T08:00:00.000Z",
      evidence: { export_backup: "../fake.json" },
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /baseline_sha/);
  assert.match(result.errors.join("\n"), /restore_drill/);
  assert.match(result.errors.join("\n"), /d1_recovery_proof/);
  assert.match(result.errors.join("\n"), /controlled JSON evidence root/);
});

test("complete gate metadata only becomes eligible with controlled JSON references", () => {
  const result = validateRecoveryEvidenceGate({
    manifest: { schemaVersion: 3 },
    gate: passedGate(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.requiresEvidence, true);
});

test("recovery evidence document rejects mismatched, stale, or unverifiable proof metadata", () => {
  const gate = passedGate();
  const result = validateRecoveryEvidenceDocument({
    document: proofDocument("restore_drill", {
      evidence_type: "export_backup",
      executed_at: "2026-08-07T08:05:00.000Z",
      proof: {
        method: "",
        result: "unknown",
        artifact_reference: "",
        artifact_sha256: "short",
        summary: "",
      },
    }),
    evidenceType: "restore_drill",
    gate,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /evidence_type mismatch/);
  assert.match(result.errors.join("\n"), /after gate passed_at/);
  assert.match(result.errors.join("\n"), /proof\.result/);
  assert.match(result.errors.join("\n"), /SHA-256/);
});

test("schema 3 verifier rejects non-existent recovery evidence even when strings are populated", async () => {
  const directory = await mkdtemp(join(tmpdir(), "recovery-gate-missing-"));
  try {
    const manifestPath = join(directory, "worker-manifest.json");
    const gatePath = join(directory, "gate.json");
    await writeFile(manifestPath, JSON.stringify({ schemaVersion: 3 }), "utf8");
    await writeFile(gatePath, JSON.stringify(passedGate()), "utf8");

    await assert.rejects(
      verifyRecoveryEvidenceGate({ manifestPath, gatePath, repoRoot: directory }),
      /cannot be read as JSON/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("schema 3 verifier accepts only existing structured recovery evidence records", async () => {
  const directory = await mkdtemp(join(tmpdir(), "recovery-gate-complete-"));
  try {
    const manifestPath = join(directory, "worker-manifest.json");
    const gatePath = join(directory, "gate.json");
    const evidenceDirectory = join(directory, ...EVIDENCE_ROOT.split("/"));
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(manifestPath, JSON.stringify({ schemaVersion: 3 }), "utf8");
    await writeFile(gatePath, JSON.stringify(passedGate()), "utf8");
    for (const key of requiredEvidence) {
      await writeFile(
        join(directory, ...evidenceReferences[key].split("/")),
        JSON.stringify(proofDocument(key)),
        "utf8",
      );
    }

    const result = await verifyRecoveryEvidenceGate({ manifestPath, gatePath, repoRoot: directory });
    assert.equal(result.evidenceVerified, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("protected Worker CI executes the repository Recovery Evidence Gate", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  assert.match(workflow, /name: Enforce Recovery Evidence Gate/);
  assert.match(workflow, /run: npm run worker:recovery-gate:check/);
});
