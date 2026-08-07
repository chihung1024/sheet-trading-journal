import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { validateRecoveryEvidenceGate } from "../tools/verify_recovery_evidence_gate.mjs";

const requiredEvidence = [
  "export_backup",
  "restore_drill",
  "rollback_timing",
  "integrity_verification",
  "migration_rollback_forward_strategy",
  "d1_recovery_proof",
];

const blockedGate = {
  status: "blocked",
  max_schema_version_without_pass: 2,
  passed_at: null,
  required_evidence: requiredEvidence,
  evidence: {},
};

test("schema 2 remains deployable while recovery gate is blocked", () => {
  const result = validateRecoveryEvidenceGate({
    manifest: { schemaVersion: 2 },
    gate: blockedGate,
  });
  assert.equal(result.ok, true);
});

test("schema 3 fails closed while recovery evidence gate is blocked", () => {
  const result = validateRecoveryEvidenceGate({
    manifest: { schemaVersion: 3 },
    gate: blockedGate,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /schema 3 is blocked/);
});

test("status passed is insufficient when required evidence is missing", () => {
  const result = validateRecoveryEvidenceGate({
    manifest: { schemaVersion: 3 },
    gate: {
      ...blockedGate,
      status: "passed",
      passed_at: "2026-08-07T08:00:00.000Z",
      evidence: { export_backup: "docs/evidence/export.json" },
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /restore_drill/);
  assert.match(result.errors.join("\n"), /d1_recovery_proof/);
});

test("future schema is allowed only with complete passed recovery evidence", () => {
  const evidence = Object.fromEntries(
    requiredEvidence.map((key) => [key, `docs/governance/evidence/${key}.json`]),
  );
  const result = validateRecoveryEvidenceGate({
    manifest: { schemaVersion: 3 },
    gate: {
      ...blockedGate,
      status: "passed",
      passed_at: "2026-08-07T08:00:00.000Z",
      evidence,
    },
  });
  assert.equal(result.ok, true);
});

test("protected Worker CI executes the repository Recovery Evidence Gate", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  assert.match(workflow, /name: Enforce Recovery Evidence Gate/);
  assert.match(workflow, /run: npm run worker:recovery-gate:check/);
});
