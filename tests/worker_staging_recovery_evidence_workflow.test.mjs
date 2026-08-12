import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const WORKFLOW = '.github/workflows/staging-d1-recovery-evidence.yml';

test('staging recovery evidence workflow is isolated, synthetic, and non-production', async () => {
  const workflow = await readFile(WORKFLOW, 'utf8');

  assert.match(workflow, /environment:\s*staging/);
  assert.match(workflow, /DRILL_TABLE:\s*recovery_evidence_sentinel/);
  assert.match(workflow, /CLOUDFLARE_D1_DATABASE_NAME/);
  assert.match(workflow, /trading-journal-staging/);
  assert.match(workflow, /synthetic_only/);
  assert.match(workflow, /d1 export "\$CLOUDFLARE_D1_DATABASE_NAME" --remote/);
  assert.match(workflow, /--table "\$DRILL_TABLE"/);
  assert.match(workflow, /DROP TABLE \$DRILL_TABLE/);
  assert.match(workflow, /d1 execute DB --remote/);
  assert.match(workflow, /--file recovery-sentinel\.sql/);
  assert.match(workflow, /DROP TABLE IF EXISTS \$DRILL_TABLE/);
  assert.match(workflow, /staging-d1-recovery-measurements\.json/);
  assert.match(workflow, /contents:\s*read/);

  assert.doesNotMatch(workflow, /environment:\s*production/);
  assert.doesNotMatch(workflow, /journal-db/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
  assert.doesNotMatch(workflow, /records\s*--table|--table\s*records/);
  assert.doesNotMatch(workflow, /portfolio_snapshots/);
});

test('recovery workflow uses pinned reviewed actions and uploads only sanitized evidence directory', async () => {
  const workflow = await readFile(WORKFLOW, 'utf8');

  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(workflow, /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
  assert.match(workflow, /actions\/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f/);
  assert.match(workflow, /path:\s*recovery-evidence/);
  assert.doesNotMatch(workflow, /path:\s*recovery-sentinel\.sql/);
});
