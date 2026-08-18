import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { MAPPING_SOURCE_MODE } from '../src/services/brokerNeutralColumnMapping.js';
import {
  BROKER_MAPPING_PRESET_MAX_COUNT,
  deleteBrokerMappingPreset,
  listBrokerMappingPresets,
  mappingPresetStorageKey,
  saveBrokerMappingPreset,
} from '../src/services/brokerNeutralMappingPresets.js';
import {
  BROKER_MAPPING_PRESET_V1_STORAGE_PREFIX,
  clearSensitiveProjectStorage,
} from '../src/services/projectStorage.js';

const serviceSource = fs.readFileSync(
  new URL('../src/services/brokerNeutralMappingPresets.js', import.meta.url),
  'utf8',
);

const column = source_header => ({ mode: MAPPING_SOURCE_MODE.COLUMN, source_header });
const constant = value => ({ mode: MAPPING_SOURCE_MODE.CONSTANT, value });

const headers = ['Trade Date', 'Ticker', 'Side', 'Shares', 'Fill Price', 'CCY', 'Memo'];
const mapping = {
  txn_date: column('Trade Date'),
  symbol: column('Ticker'),
  txn_type: column('Side'),
  qty: column('Shares'),
  price: column('Fill Price'),
  currency: column('CCY'),
  note: column('Memo'),
  tag: constant('Imported'),
};

function storageWith(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); },
  };
}

test('mapping preset stores only owner-scoped reusable mapping metadata', () => {
  const storage = storageWith();
  const result = saveBrokerMappingPreset(storage, 'User@Example.com', {
    label: 'Futu export',
    sourceHeaders: headers,
    mapping,
    now: 100,
  });

  assert.equal(result.recovered_from_corruption, false);
  assert.equal(result.preset.label, 'Futu export');
  assert.deepEqual(result.preset.source_headers, headers);
  assert.equal(result.preset.mapping.tag.value, 'Imported');

  const key = mappingPresetStorageKey('user@example.com');
  assert.ok(key.startsWith(BROKER_MAPPING_PRESET_V1_STORAGE_PREFIX));
  const stored = storage.getItem(key);
  assert.ok(stored);
  assert.doesNotMatch(stored, /NVDA|2026-08-17|source_digest|source_profile|token|Bearer/);
  assert.match(stored, /Trade Date/);
  assert.match(stored, /Futu export/);
});

test('presets are isolated by signed owner and exact ordered source-header signature', () => {
  const storage = storageWith();
  saveBrokerMappingPreset(storage, 'alpha@example.com', {
    label: 'Alpha mapping',
    sourceHeaders: headers,
    mapping,
    now: 100,
  });
  saveBrokerMappingPreset(storage, 'beta@example.com', {
    label: 'Beta mapping',
    sourceHeaders: headers,
    mapping,
    now: 200,
  });

  const alpha = listBrokerMappingPresets(storage, 'alpha@example.com', { sourceHeaders: headers });
  assert.deepEqual(alpha.presets.map(item => item.label), ['Alpha mapping']);

  const reordered = [...headers];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.equal(
    listBrokerMappingPresets(storage, 'alpha@example.com', { sourceHeaders: reordered }).presets.length,
    0,
  );
  assert.deepEqual(
    listBrokerMappingPresets(storage, 'beta@example.com', { sourceHeaders: headers }).presets.map(item => item.label),
    ['Beta mapping'],
  );
});

test('saving the same normalized label updates the preset without multiplying entries', () => {
  const storage = storageWith();
  const first = saveBrokerMappingPreset(storage, 'user@example.com', {
    label: '  Main   export ',
    sourceHeaders: headers,
    mapping,
    now: 100,
  });
  const updatedMapping = { ...mapping, tag: constant('Core') };
  const second = saveBrokerMappingPreset(storage, 'user@example.com', {
    label: 'main export',
    sourceHeaders: headers,
    mapping: updatedMapping,
    now: 200,
  });

  const listed = listBrokerMappingPresets(storage, 'user@example.com');
  assert.equal(listed.presets.length, 1);
  assert.equal(listed.presets[0].label, 'main export');
  assert.equal(listed.presets[0].created_at, first.preset.created_at);
  assert.equal(listed.presets[0].updated_at, 200);
  assert.equal(listed.presets[0].mapping.tag.value, 'Core');
  assert.equal(second.preset.created_at, 100);
});

test('corrupted preset state never becomes mapping authority and explicit save can recover it', () => {
  const storage = storageWith({
    [mappingPresetStorageKey('user@example.com')]: '{bad json',
  });

  const read = listBrokerMappingPresets(storage, 'user@example.com', { sourceHeaders: headers });
  assert.equal(read.corrupted, true);
  assert.deepEqual(read.presets, []);

  const saved = saveBrokerMappingPreset(storage, 'user@example.com', {
    label: 'Recovered mapping',
    sourceHeaders: headers,
    mapping,
    now: 300,
  });
  assert.equal(saved.recovered_from_corruption, true);
  const reread = listBrokerMappingPresets(storage, 'user@example.com', { sourceHeaders: headers });
  assert.equal(reread.corrupted, false);
  assert.deepEqual(reread.presets.map(item => item.label), ['Recovered mapping']);
});

test('preset count is bounded and delete removes only the explicit owner preset', () => {
  const storage = storageWith();
  for (let index = 0; index < BROKER_MAPPING_PRESET_MAX_COUNT; index += 1) {
    saveBrokerMappingPreset(storage, 'user@example.com', {
      label: `Preset ${index + 1}`,
      sourceHeaders: headers,
      mapping,
      now: index + 1,
    });
  }
  assert.throws(
    () => saveBrokerMappingPreset(storage, 'user@example.com', {
      label: 'One too many',
      sourceHeaders: headers,
      mapping,
      now: 999,
    }),
    error => error?.code === 'PRESET_LIMIT_REACHED',
  );

  const deleted = deleteBrokerMappingPreset(storage, 'user@example.com', 'Preset 1');
  assert.equal(deleted.deleted, true);
  assert.equal(listBrokerMappingPresets(storage, 'user@example.com').presets.length, BROKER_MAPPING_PRESET_MAX_COUNT - 1);
  assert.equal(deleteBrokerMappingPreset(storage, 'user@example.com', 'missing').deleted, false);
});

test('logout privacy cleanup removes all owner-scoped mapping preset keys but preserves neighbors', () => {
  const storage = storageWith({
    [`${BROKER_MAPPING_PRESET_V1_STORAGE_PREFIX}alpha%40example.com`]: 'alpha',
    [`${BROKER_MAPPING_PRESET_V1_STORAGE_PREFIX}beta%40example.com`]: 'beta',
    'broker_mapping_presets.v2.keep': 'future-version',
    theme: 'dark',
  });

  const removed = clearSensitiveProjectStorage(storage);
  assert.ok(removed.includes(`${BROKER_MAPPING_PRESET_V1_STORAGE_PREFIX}alpha%40example.com`));
  assert.ok(removed.includes(`${BROKER_MAPPING_PRESET_V1_STORAGE_PREFIX}beta%40example.com`));
  assert.equal(storage.getItem('broker_mapping_presets.v2.keep'), 'future-version');
  assert.equal(storage.getItem('theme'), 'dark');
});

test('mapping preset service is browser-local convenience state with no API or write authority', () => {
  assert.doesNotMatch(serviceSource, /\bfetch\s*\(|\/api\/|createBrokerNeutralRecord|runRecordImportBatch/);
  assert.match(serviceSource, /validateBrokerColumnMapping/);
  assert.match(serviceSource, /source_headers/);
  assert.doesNotMatch(serviceSource, /sourceText|mapped_canonical_text|source_digest|source_profile/);
});
