import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production bootstrap installs bounded data read self recovery exactly once', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.equal((source.match(/installDataReadSelfRecovery/g) || []).length, 2);
  assert.match(source, /import \{ installDataReadSelfRecovery \} from '\.\/services\/dataReadSelfRecovery\.js';/);
  assert.match(source, /installDataReadSelfRecovery\(\{\s*portfolio,\s*auth,\s*notify: addToast,\s*\}\);/s);
});
