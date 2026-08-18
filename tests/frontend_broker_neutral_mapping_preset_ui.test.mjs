import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const componentSource = fs.readFileSync(
  new URL('../src/components/BrokerNeutralColumnMapping.vue', import.meta.url),
  'utf8',
);
const presetServiceSource = fs.readFileSync(
  new URL('../src/services/brokerNeutralMappingPresets.js', import.meta.url),
  'utf8',
);

test('mapping preset UX is explicit, exact-header scoped, and remains upstream of canonical preview', () => {
  assert.match(componentSource, /listBrokerMappingPresets/);
  assert.match(componentSource, /saveBrokerMappingPreset/);
  assert.match(componentSource, /deleteBrokerMappingPreset/);
  assert.match(componentSource, /sourceHeaders:\s*sourceTable\.value\.headers/);
  assert.match(componentSource, /套用/);
  assert.match(componentSource, /儲存目前對應/);
  assert.match(componentSource, /已套用.*請重新建立 Canonical 預覽/);
  assert.match(componentSource, /buildMappedCanonicalTradePreview/);
  assert.match(componentSource, /prepareMappedBrokerImport/);
  assert.match(componentSource, /selectedPresetKey\.value = ''/);
});

test('saved preset copy states that convenience metadata excludes transaction and execution identity data', () => {
  assert.match(componentSource, /Preset 只記住欄名與 mapping；不保存 CSV、交易資料或匯入來源設定檔/);
  assert.match(componentSource, /同一來源設定檔＋完全相同原始 CSV＋完全相同 mapping/);
  assert.doesNotMatch(presetServiceSource, /sourceText|mapped_canonical_text|source_digest|source_profile/);
  assert.doesNotMatch(presetServiceSource, /createBrokerNeutralRecord|runRecordImportBatch|\/api\//);
});

test('preset loading never silently replaces the execution source profile or creates a write path', () => {
  const applyStart = componentSource.indexOf('const applyPreset =');
  const applyEnd = componentSource.indexOf('const applySelectedPreset =');
  assert.ok(applyStart >= 0 && applyEnd > applyStart);
  const applyBody = componentSource.slice(applyStart, applyEnd);
  assert.doesNotMatch(applyBody, /sourceProfile\.value\s*=/);
  assert.doesNotMatch(applyBody, /confirmImport|createBrokerNeutralRecord|runRecordImportBatch/);

  const fileChangeStart = componentSource.indexOf('const handleFileChange =');
  const buildPreviewStart = componentSource.indexOf('const buildPreview =');
  const fileChangeBody = componentSource.slice(fileChangeStart, buildPreviewStart);
  assert.match(fileChangeBody, /refreshExactPresets\(\)/);
  assert.doesNotMatch(fileChangeBody, /applySelectedPreset\(\)|applyPreset\(/);
});
