import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production bootstrap installs record-create ambiguity recovery exactly once with shared stores and storage', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ installRecordCreateAmbiguityRecovery \} from '\.\/services\/recordCreateAmbiguityRecovery\.js';/);
  assert.equal((source.match(/installRecordCreateAmbiguityRecovery\(/g) || []).length, 1);
  assert.match(source, /installRecordCreateAmbiguityRecovery\(\{\s*portfolio,\s*auth,\s*storage: localStorage,\s*notify: addToast,\s*\}\);/s);
});
