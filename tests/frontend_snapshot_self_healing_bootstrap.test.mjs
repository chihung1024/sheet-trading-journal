import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('application bootstrap installs one snapshot self-healing controller on shared Pinia stores', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ useAuthStore \} from ['"]\.\/stores\/auth['"]/);
  assert.match(source, /import \{ usePortfolioStore \} from ['"]\.\/stores\/portfolio['"]/);
  assert.match(source, /import \{ installSnapshotSelfHealing \} from ['"]\.\/services\/snapshotSelfHealing\.js['"]/);
  assert.match(source, /const pinia = createPinia\(\)/);
  assert.match(source, /app\.use\(pinia\)/);
  assert.match(source, /const auth = useAuthStore\(pinia\)/);
  assert.match(source, /const portfolio = usePortfolioStore\(pinia\)/);
  assert.match(source, /installSnapshotSelfHealing\(\{ portfolio, auth, storage: localStorage \}\)/);
  assert.equal((source.match(/installSnapshotSelfHealing\(/g) || []).length, 1);
});

test('self-healing controller watches only successful full-read completion and hands repair back to Phase 2', async () => {
  const source = await readFile(new URL('../src/services/snapshotSelfHealing.js', import.meta.url), 'utf8');

  assert.match(source, /portfolio\?\.portfolioReadStatus !== 'loaded'/);
  assert.match(source, /assessSnapshotIntegrity\(/);
  assert.match(source, /readAutomaticRecalculationStatus\(storage, owner\)/);
  assert.match(source, /if \(automaticStatus\.dirty\)/);
  assert.match(source, /markAutomaticRecalculationDirty\(/);
  assert.match(source, /await nextTask\(\)/);
  assert.match(source, /await portfolio\.fetchAll\(\)/);
  assert.match(source, /watch\(\s*\(\) => portfolio\.portfolioReadStatus/);
  assert.doesNotMatch(source, /triggerUpdate\(/);
  assert.doesNotMatch(source, /\/api\/trigger-update/);
  assert.doesNotMatch(source, /setInterval/);
});

test('repair tracker is fingerprint-bounded and fresh proof does not erase Phase 2 dirty state directly', async () => {
  const source = await readFile(new URL('../src/services/snapshotSelfHealing.js', import.meta.url), 'utf8');

  assert.match(source, /createSnapshotRepairTracker = \(\) => new Set\(\)/);
  assert.match(source, /tracker\.has\(assessment\.fingerprint\)/);
  assert.match(source, /tracker\.add\(assessment\.fingerprint\)/);
  assert.doesNotMatch(source, /clearAutomaticRecalculationState/);
});
