import { CANONICAL_HEADERS } from './brokerNeutralImportPreview.js';
import { validateBrokerColumnMapping } from './brokerNeutralColumnMapping.js';
import { BROKER_MAPPING_PRESET_V1_STORAGE_PREFIX } from './projectStorage.js';

export const BROKER_MAPPING_PRESET_VERSION = 1;
export const BROKER_MAPPING_PRESET_MAX_COUNT = 20;
export const BROKER_MAPPING_PRESET_LABEL_MAX_LENGTH = 48;

export class BrokerNeutralMappingPresetError extends Error {
  constructor(message, code = 'MAPPING_PRESET_INVALID') {
    super(message);
    this.name = 'BrokerNeutralMappingPresetError';
    this.code = code;
    this.outcomeAmbiguous = false;
  }
}

const fail = (message, code) => {
  throw new BrokerNeutralMappingPresetError(message, code);
};

const requireStorage = (storage) => {
  if (
    !storage
    || typeof storage.getItem !== 'function'
    || typeof storage.setItem !== 'function'
    || typeof storage.removeItem !== 'function'
  ) {
    fail('需要可讀寫的瀏覽器儲存空間', 'STORAGE_REQUIRED');
  }
  return storage;
};

export const normalizeMappingPresetOwner = (owner) => {
  if (typeof owner !== 'string' || !owner.trim()) {
    fail('登入帳戶不存在，無法讀寫 mapping preset', 'OWNER_REQUIRED');
  }
  return owner.trim().toLowerCase();
};

export const mappingPresetStorageKey = owner => (
  `${BROKER_MAPPING_PRESET_V1_STORAGE_PREFIX}${encodeURIComponent(normalizeMappingPresetOwner(owner))}`
);

const normalizeLabel = (value) => {
  const label = String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!label) fail('Preset 名稱不可空白', 'LABEL_REQUIRED');
  if (label.length > BROKER_MAPPING_PRESET_LABEL_MAX_LENGTH) {
    fail(`Preset 名稱不可超過 ${BROKER_MAPPING_PRESET_LABEL_MAX_LENGTH} 字元`, 'LABEL_TOO_LONG');
  }
  if (/[\u0000-\u001f\u007f]/.test(label)) {
    fail('Preset 名稱含不支援的控制字元', 'LABEL_INVALID');
  }
  return label;
};

const labelKey = value => normalizeLabel(value).toLocaleLowerCase('en-US');

const normalizeHeaders = (headers) => {
  if (!Array.isArray(headers) || headers.length === 0) {
    fail('來源欄位不存在', 'SOURCE_HEADERS_REQUIRED');
  }
  const normalized = headers.map(header => String(header ?? '').trim());
  if (normalized.some(header => !header)) {
    fail('來源欄位不可空白', 'SOURCE_HEADER_INVALID');
  }
  if (new Set(normalized).size !== normalized.length) {
    fail('來源欄位不可重複', 'SOURCE_HEADER_DUPLICATE');
  }
  return Object.freeze(normalized);
};

const exactHeadersEqual = (left, right) => (
  Array.isArray(left)
  && Array.isArray(right)
  && left.length === right.length
  && left.every((value, index) => value === right[index])
);

const freezeMapping = (mapping) => Object.freeze(Object.fromEntries(
  CANONICAL_HEADERS.map((field) => {
    const entry = mapping[field] ?? null;
    return [field, entry === null ? null : Object.freeze({ ...entry })];
  }),
));

const normalizeMappingForHeaders = (headers, mapping) => {
  const sourceTable = { headers: [...headers], rows: [] };
  return freezeMapping(validateBrokerColumnMapping(sourceTable, mapping));
};

const requireTimestamp = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${field} 無效`, 'PRESET_TIMESTAMP_INVALID');
  return value;
};

const freezePreset = value => Object.freeze({
  label: value.label,
  label_key: value.label_key,
  source_headers: Object.freeze([...value.source_headers]),
  mapping: freezeMapping(value.mapping),
  created_at: value.created_at,
  updated_at: value.updated_at,
});

const parsePreset = (candidate) => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    fail('Preset 格式無效', 'PRESET_CORRUPTED');
  }
  const label = normalizeLabel(candidate.label);
  const expectedLabelKey = labelKey(label);
  if (candidate.label_key !== expectedLabelKey) fail('Preset 名稱索引無效', 'PRESET_CORRUPTED');
  const headers = normalizeHeaders(candidate.source_headers);
  const mapping = normalizeMappingForHeaders(headers, candidate.mapping);
  return freezePreset({
    label,
    label_key: expectedLabelKey,
    source_headers: headers,
    mapping,
    created_at: requireTimestamp(candidate.created_at, 'created_at'),
    updated_at: requireTimestamp(candidate.updated_at, 'updated_at'),
  });
};

const parseStore = (raw, owner) => {
  if (raw === null || raw === undefined || raw === '') {
    return Object.freeze({ presets: Object.freeze([]), corrupted: false });
  }

  try {
    const value = JSON.parse(raw);
    if (
      !value
      || typeof value !== 'object'
      || Array.isArray(value)
      || value.version !== BROKER_MAPPING_PRESET_VERSION
      || value.owner !== owner
      || !Array.isArray(value.presets)
      || value.presets.length > BROKER_MAPPING_PRESET_MAX_COUNT
    ) {
      throw new Error('invalid preset store');
    }
    const presets = value.presets.map(parsePreset);
    if (new Set(presets.map(preset => preset.label_key)).size !== presets.length) {
      throw new Error('duplicate preset label');
    }
    return Object.freeze({ presets: Object.freeze(presets), corrupted: false });
  } catch {
    return Object.freeze({ presets: Object.freeze([]), corrupted: true });
  }
};

const readState = (storage, owner) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeMappingPresetOwner(owner);
  return {
    target,
    owner: normalizedOwner,
    key: mappingPresetStorageKey(normalizedOwner),
    ...parseStore(target.getItem(mappingPresetStorageKey(normalizedOwner)), normalizedOwner),
  };
};

const verifiedWrite = (storage, key, value) => {
  const encoded = JSON.stringify(value);
  storage.setItem(key, encoded);
  if (storage.getItem(key) !== encoded) {
    fail('Mapping preset 無法可靠保存', 'PRESET_WRITE_UNVERIFIED');
  }
};

const encodeStore = (owner, presets) => ({
  version: BROKER_MAPPING_PRESET_VERSION,
  owner,
  presets: presets.map(preset => ({
    label: preset.label,
    label_key: preset.label_key,
    source_headers: [...preset.source_headers],
    mapping: Object.fromEntries(CANONICAL_HEADERS.map(field => [
      field,
      preset.mapping[field] === null ? null : { ...preset.mapping[field] },
    ])),
    created_at: preset.created_at,
    updated_at: preset.updated_at,
  })),
});

export const listBrokerMappingPresets = (
  storage,
  owner,
  { sourceHeaders = null } = {},
) => {
  const state = readState(storage, owner);
  const exactHeaders = sourceHeaders === null ? null : normalizeHeaders(sourceHeaders);
  const presets = state.presets
    .filter(preset => exactHeaders === null || exactHeadersEqual(preset.source_headers, exactHeaders))
    .sort((left, right) => right.updated_at - left.updated_at || left.label.localeCompare(right.label));
  return Object.freeze({
    presets: Object.freeze(presets),
    corrupted: state.corrupted,
  });
};

export const saveBrokerMappingPreset = (
  storage,
  owner,
  {
    label,
    sourceHeaders,
    mapping,
    now = Date.now(),
  } = {},
) => {
  const state = readState(storage, owner);
  const normalizedLabel = normalizeLabel(label);
  const normalizedLabelKey = labelKey(normalizedLabel);
  const headers = normalizeHeaders(sourceHeaders);
  const normalizedMapping = normalizeMappingForHeaders(headers, mapping);
  const timestamp = requireTimestamp(now, 'now');

  const existing = state.presets.find(preset => preset.label_key === normalizedLabelKey) || null;
  const preset = freezePreset({
    label: normalizedLabel,
    label_key: normalizedLabelKey,
    source_headers: headers,
    mapping: normalizedMapping,
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp,
  });

  const remaining = state.presets.filter(item => item.label_key !== normalizedLabelKey);
  if (!existing && remaining.length >= BROKER_MAPPING_PRESET_MAX_COUNT) {
    fail(`Mapping preset 最多 ${BROKER_MAPPING_PRESET_MAX_COUNT} 組`, 'PRESET_LIMIT_REACHED');
  }
  const next = [preset, ...remaining]
    .sort((left, right) => right.updated_at - left.updated_at || left.label.localeCompare(right.label));

  verifiedWrite(state.target, state.key, encodeStore(state.owner, next));
  return Object.freeze({
    preset,
    recovered_from_corruption: state.corrupted,
  });
};

export const deleteBrokerMappingPreset = (storage, owner, label) => {
  const state = readState(storage, owner);
  const normalizedLabelKey = labelKey(label);
  const next = state.presets.filter(preset => preset.label_key !== normalizedLabelKey);
  if (next.length === state.presets.length) {
    return Object.freeze({ deleted: false, corrupted: state.corrupted });
  }
  if (next.length === 0) {
    state.target.removeItem(state.key);
  } else {
    verifiedWrite(state.target, state.key, encodeStore(state.owner, next));
  }
  return Object.freeze({ deleted: true, corrupted: state.corrupted });
};

export const __test = Object.freeze({
  exactHeadersEqual,
  parseStore,
  encodeStore,
  normalizeHeaders,
  labelKey,
});
