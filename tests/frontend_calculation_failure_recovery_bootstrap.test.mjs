import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('failure recovery installs exactly once on the shared Pinia stores before app mount', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(
    source,
    /import \{ installCalculationFailureRecovery \} from '\.\/services\/calculationFailureRecoveryController\.js';/,
  );
  assert.equal((source.match(/installCalculationFailureRecovery\(\{/g) || []).length, 1);
  assert.equal((source.match(/installSnapshotSelfHealing\(\{/g) || []).length, 1);
  assert.match(source, /const auth = useAuthStore\(pinia\);/);
  assert.match(source, /const portfolio = usePortfolioStore\(pinia\);/);
  assert.match(source, /const \{ addToast \} = useToast\(\);/);
  assert.match(
    source,
    /installCalculationFailureRecovery\(\{[\s\S]*?portfolio,[\s\S]*?auth,[\s\S]*?storage: localStorage,[\s\S]*?notify: addToast,[\s\S]*?\}\);/,
  );

  const piniaIndex = source.indexOf('app.use(pinia)');
  const recoveryIndex = source.indexOf('installCalculationFailureRecovery({');
  const mountIndex = source.indexOf("app.mount('#app')");
  assert.notEqual(piniaIndex, -1);
  assert.notEqual(recoveryIndex, -1);
  assert.notEqual(mountIndex, -1);
  assert.equal(piniaIndex < recoveryIndex, true);
  assert.equal(recoveryIndex < mountIndex, true);
});
