import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('IBKR import profile remains preview-first, memory-only, and cannot drift from the confirmed preview', async () => {
  const component = await readFile(new URL('../src/components/IbkrTradeImport.vue', import.meta.url), 'utf8');

  assert.match(component, /import \{ deriveIbkrImportProfile \} from ['"]\.\.\/services\/ibkrImportProfile\.js['"]/);
  assert.match(component, /const profileName = ref\(''\)/);
  assert.match(component, /const activeProfileName = ref\(''\)/);
  assert.match(component, /const profileDirty = ref\(false\)/);
  assert.match(component, /const fileContents = ref\(''\)/);
  assert.match(component, /deriveIbkrImportProfile\(profileName\.value\)/);
  assert.match(component, /parseIbkrTradeCsv\(fileContents\.value, \{ accountScope: profile\.scopeId \}\)/);

  assert.match(component, /@input="markProfileDirty"/);
  assert.match(component, /@click="rebuildPreview"/);
  assert.match(component, /:disabled="importing \|\| profileDirty \|\| preview\.entries\.length === 0"/);
  assert.match(component, /if \(importing\.value \|\| profileDirty\.value \|\| !preview\.value\?\.entries\?\.length\) return;/);

  assert.match(component, /profileName\.value = '';/);
  assert.match(component, /activeProfileName\.value = '';/);
  assert.match(component, /fileContents\.value = '';/);
  assert.doesNotMatch(component, /localStorage\.setItem\s*\(/);
  assert.doesNotMatch(component, /sessionStorage\./);

  assert.match(component, /同一帳戶之後改用 Flex CSV 時請使用相同名稱/);
  assert.match(component, /單一設定檔不能覆蓋含多個不同 Account ID 的檔案/);
  assert.match(component, /名稱只存在本次畫面記憶體，不寫入交易備註或 Account ID 欄位/);
});
