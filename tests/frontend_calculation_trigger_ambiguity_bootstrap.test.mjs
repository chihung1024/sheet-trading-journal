import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('trigger ambiguity recovery installs exactly once on shared Pinia stores before mount', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(
    source,
    /import \{ installCalculationTriggerAmbiguityRecovery \} from '\.\/services\/calculationTriggerAmbiguityRecovery\.js';/,
  );
  assert.equal((source.match(/installCalculationTriggerAmbiguityRecovery\(\{/g) || []).length, 1);
  assert.match(source, /const auth = useAuthStore\(pinia\);/);
  assert.match(source, /const portfolio = usePortfolioStore\(pinia\);/);
  assert.match(
    source,
    /installCalculationTriggerAmbiguityRecovery\(\{[\s\S]*?portfolio,[\s\S]*?auth,[\s\S]*?storage: localStorage,[\s\S]*?notify: addToast,[\s\S]*?\}\);/,
  );

  const piniaIndex = source.indexOf('app.use(pinia)');
  const controllerIndex = source.indexOf('installCalculationTriggerAmbiguityRecovery({');
  const mountIndex = source.indexOf("app.mount('#app')");
  assert.equal(piniaIndex >= 0 && piniaIndex < controllerIndex, true);
  assert.equal(controllerIndex < mountIndex, true);
});
