export const SNAPSHOT_INTEGRITY_STATUS = Object.freeze({
  EMPTY: 'empty',
  FRESH: 'fresh',
  MISSING: 'missing',
  STALE_SOURCE: 'stale_source',
  STALE_BENCHMARK: 'stale_benchmark',
  UNSUPPORTED_MANIFEST: 'unsupported_manifest',
  UNVERIFIABLE_MANIFEST: 'unverifiable_manifest',
  UNVERIFIABLE_RECORDS: 'unverifiable_records',
});

const SOURCE_RECORD_FIELDS = Object.freeze([
  'id',
  'Date',
  'Symbol',
  'Type',
  'Qty',
  'Price',
  'Commission',
  'Tax',
  'Tag',
]);
const API_SOURCE_RECORD_MARKERS = Object.freeze([
  'txn_date',
  'symbol',
  'txn_type',
  'qty',
  'price',
  'fee',
  'tax',
  'tag',
]);
const CALCULATION_SOURCE_RECORD_MARKERS = Object.freeze([
  'Date',
  'Symbol',
  'Type',
  'Qty',
  'Price',
  'Commission',
  'Tax',
  'Tag',
]);
const SUPPORTED_TRANSACTION_TYPES = new Set(['BUY', 'SELL', 'DIV']);
const SHA256_RE = /^[0-9a-f]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUPPORTED_MANIFEST_VERSION = 1;
const SUPPORTED_IDENTITY_VERSION = 1;
const SUPPORTED_SOURCE_CANONICALIZATION_VERSION = 1;
const SUPPORTED_RUNTIME_CANONICALIZATION_VERSION = 1;

const normalizeOwnerlessBenchmark = value => (
  typeof value === 'string' ? value.trim().toUpperCase() : ''
);

const hasOwn = (record, key) => Object.prototype.hasOwnProperty.call(record, key);

const detectSourceRecordSchema = (record) => {
  const hasApiFields = API_SOURCE_RECORD_MARKERS.some(field => hasOwn(record, field));
  const hasCalculationFields = CALCULATION_SOURCE_RECORD_MARKERS.some(field => hasOwn(record, field));

  if (hasApiFields && hasCalculationFields) {
    throw new Error('source record mixes API and calculation schemas');
  }
  if (hasApiFields) return 'api';
  if (hasCalculationFields) return 'calculation';
  throw new Error('source record schema is unsupported');
};

const normalizeSourceRecordForManifest = (record) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('source record must be an object');
  }

  const schema = detectSourceRecordSchema(record);
  if (schema === 'api') {
    return {
      id: record.id,
      Date: record.txn_date,
      Symbol: record.symbol,
      Type: record.txn_type,
      Qty: record.qty,
      Price: record.price,
      Commission: record.fee ?? 0,
      Tax: record.tax ?? 0,
      Tag: record.tag ?? '',
    };
  }

  return {
    id: record.id,
    Date: record.Date,
    Symbol: record.Symbol,
    Type: record.Type,
    Qty: record.Qty,
    Price: record.Price,
    Commission: record.Commission,
    Tax: record.Tax,
    Tag: record.Tag,
  };
};

const requireFiniteNumber = (value, label) => {
  if (typeof value === 'boolean') throw new Error(`${label} must be numeric`);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`${label} must be finite`);
  return numeric;
};

const requirePositiveInteger = (value, label) => {
  const numeric = requireFiniteNumber(value, label);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return numeric;
};

const normalizeDate = (value) => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new Error('transaction Date must be YYYY-MM-DD');
  }
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year
    || probe.getUTCMonth() !== month - 1
    || probe.getUTCDate() !== day
  ) {
    throw new Error('transaction Date is invalid');
  }
  return value;
};

const normalizeRequiredText = (value, label) => {
  if (value === null || value === undefined) throw new Error(`${label} must be non-empty`);
  const text = String(value).trim().toUpperCase();
  if (!text) throw new Error(`${label} must be non-empty`);
  return text;
};

const normalizeOptionalText = value => (
  value === null || value === undefined ? '' : String(value)
);

export const pythonFloatHex = (value) => {
  const numeric = requireFiniteNumber(value, 'canonical float');
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, numeric, false);
  const bits = view.getBigUint64(0, false);
  const negative = (bits >> 63n) === 1n;
  const exponentBits = Number((bits >> 52n) & 0x7ffn);
  const fractionBits = bits & 0x000fffffffffffffn;
  const sign = negative ? '-' : '';

  if (exponentBits === 0 && fractionBits === 0n) {
    return `${sign}0x0.0p+0`;
  }

  const fraction = fractionBits.toString(16).padStart(13, '0');
  if (exponentBits === 0) {
    return `${sign}0x0.${fraction}p-1022`;
  }

  const exponent = exponentBits - 1023;
  return `${sign}0x1.${fraction}p${exponent >= 0 ? '+' : ''}${exponent}`;
};

const sortCanonicalObject = (value) => {
  if (Array.isArray(value)) return value.map(sortCanonicalObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, sortCanonicalObject(value[key])]),
    );
  }
  return value;
};

const canonicalJsonBytes = (projection) => {
  const envelope = sortCanonicalObject({
    canonical_json_version: 1,
    value: projection,
  });
  return new TextEncoder().encode(JSON.stringify(envelope));
};

const sha256Hex = async (bytes) => {
  if (!globalThis.crypto?.subtle?.digest) {
    throw new Error('WebCrypto SHA-256 is unavailable');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const canonicalFloat = value => ({ $float_hex: pythonFloatHex(value) });
const canonicalDate = value => ({ $date: normalizeDate(value) });

export const buildSourceRecordsProjection = (records) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('source records must be a non-empty array');
  }

  const seenIds = new Set();
  const rows = records.map(record => {
    const sourceRecord = normalizeSourceRecordForManifest(record);
    const id = requirePositiveInteger(sourceRecord.id, 'record id');
    if (seenIds.has(id)) throw new Error('source record ids must be unique');
    seenIds.add(id);

    const type = normalizeRequiredText(sourceRecord.Type, 'transaction Type');
    if (!SUPPORTED_TRANSACTION_TYPES.has(type)) {
      throw new Error(`unsupported transaction Type: ${type}`);
    }

    const qty = requireFiniteNumber(sourceRecord.Qty, 'Qty');
    const price = requireFiniteNumber(sourceRecord.Price, 'Price');
    const commission = requireFiniteNumber(sourceRecord.Commission, 'Commission');
    const tax = requireFiniteNumber(sourceRecord.Tax, 'Tax');
    if (qty <= 0) throw new Error('Qty must be positive');
    if (price < 0) throw new Error('Price must be non-negative');

    return {
      id,
      Date: normalizeDate(sourceRecord.Date),
      Symbol: normalizeRequiredText(sourceRecord.Symbol, 'transaction Symbol'),
      Type: type,
      Qty: qty,
      Price: price,
      Commission: commission,
      Tax: tax,
      Tag: normalizeOptionalText(sourceRecord.Tag),
    };
  });

  rows.sort((left, right) => (
    left.Date.localeCompare(right.Date) || left.id - right.id
  ));

  return {
    canonicalization_version: 1,
    fields: [...SOURCE_RECORD_FIELDS],
    rows,
  };
};

const canonicalizeSourceProjection = projection => ({
  canonicalization_version: projection.canonicalization_version,
  fields: [...projection.fields],
  rows: projection.rows.map(row => ({
    id: row.id,
    Date: canonicalDate(row.Date),
    Symbol: row.Symbol,
    Type: row.Type,
    Qty: canonicalFloat(row.Qty),
    Price: canonicalFloat(row.Price),
    Commission: canonicalFloat(row.Commission),
    Tax: canonicalFloat(row.Tax),
    Tag: row.Tag,
  })),
});

export const buildSourceRecordsIdentity = async (records) => {
  const projection = buildSourceRecordsProjection(records);
  const canonicalProjection = canonicalizeSourceProjection(projection);
  return Object.freeze({
    canonicalization_version: 1,
    sha256: await sha256Hex(canonicalJsonBytes(canonicalProjection)),
    record_count: projection.rows.length,
    max_record_id: Math.max(...projection.rows.map(row => row.id)),
  });
};

const versionIfFuture = (value, supported) => (
  Number.isSafeInteger(value) && value > supported ? value : null
);

const readUnsupportedManifestVersion = (snapshot) => {
  const manifest = snapshot?.calculation_manifest;
  const identity = manifest?.deterministic_identity;
  const source = identity?.source_records;
  const runtime = identity?.runtime_config;
  const candidates = [
    ['manifest', versionIfFuture(manifest?.manifest_version, SUPPORTED_MANIFEST_VERSION)],
    ['identity', versionIfFuture(identity?.identity_version, SUPPORTED_IDENTITY_VERSION)],
    ['source', versionIfFuture(source?.canonicalization_version, SUPPORTED_SOURCE_CANONICALIZATION_VERSION)],
    ['runtime', versionIfFuture(runtime?.canonicalization_version, SUPPORTED_RUNTIME_CANONICALIZATION_VERSION)],
  ];
  const [component, version] = candidates.find(([, candidate]) => candidate !== null) || [];
  return component ? Object.freeze({ component, version }) : null;
};

const readManifestIdentity = snapshot => {
  const manifest = snapshot?.calculation_manifest;
  const identity = manifest?.deterministic_identity;
  const source = identity?.source_records;
  const runtime = identity?.runtime_config;
  const benchmark = normalizeOwnerlessBenchmark(runtime?.benchmark_symbol);
  if (
    (manifest?.manifest_version !== undefined && manifest.manifest_version !== SUPPORTED_MANIFEST_VERSION)
    || identity?.identity_version !== SUPPORTED_IDENTITY_VERSION
    || source?.canonicalization_version !== SUPPORTED_SOURCE_CANONICALIZATION_VERSION
    || (runtime?.canonicalization_version !== undefined && runtime.canonicalization_version !== SUPPORTED_RUNTIME_CANONICALIZATION_VERSION)
    || typeof source?.sha256 !== 'string'
    || !SHA256_RE.test(source.sha256)
    || !Number.isSafeInteger(source?.record_count)
    || source.record_count <= 0
    || !Number.isSafeInteger(source?.max_record_id)
    || source.max_record_id <= 0
    || !benchmark
  ) {
    return null;
  }
  return Object.freeze({
    source: Object.freeze({
      canonicalization_version: SUPPORTED_SOURCE_CANONICALIZATION_VERSION,
      sha256: source.sha256,
      record_count: source.record_count,
      max_record_id: source.max_record_id,
    }),
    benchmark,
  });
};

const fingerprint = (...parts) => parts.map(part => String(part ?? '')).join('|');

export const assessSnapshotIntegrity = async (
  records,
  snapshot,
  {
    expectedBenchmark = '',
  } = {},
) => {
  if (!Array.isArray(records)) {
    return Object.freeze({
      status: SNAPSHOT_INTEGRITY_STATUS.UNVERIFIABLE_RECORDS,
      repairNeeded: false,
      fingerprint: 'records:not-array',
      currentSource: null,
      manifestSource: null,
    });
  }

  if (records.length === 0) {
    return Object.freeze({
      status: SNAPSHOT_INTEGRITY_STATUS.EMPTY,
      repairNeeded: false,
      fingerprint: 'empty',
      currentSource: null,
      manifestSource: null,
    });
  }

  let currentSource;
  try {
    currentSource = await buildSourceRecordsIdentity(records);
  } catch (error) {
    return Object.freeze({
      status: SNAPSHOT_INTEGRITY_STATUS.UNVERIFIABLE_RECORDS,
      repairNeeded: false,
      fingerprint: fingerprint('records-invalid', error?.message),
      currentSource: null,
      manifestSource: null,
      error,
    });
  }

  if (!snapshot?.updated_at) {
    return Object.freeze({
      status: SNAPSHOT_INTEGRITY_STATUS.MISSING,
      repairNeeded: true,
      fingerprint: fingerprint('missing', currentSource.sha256),
      currentSource,
      manifestSource: null,
    });
  }

  const unsupported = readUnsupportedManifestVersion(snapshot);
  if (unsupported) {
    return Object.freeze({
      status: SNAPSHOT_INTEGRITY_STATUS.UNSUPPORTED_MANIFEST,
      repairNeeded: false,
      fingerprint: fingerprint(
        'manifest-unsupported',
        unsupported.component,
        unsupported.version,
        currentSource.sha256,
      ),
      currentSource,
      manifestSource: null,
      unsupportedManifest: unsupported,
    });
  }

  const manifest = readManifestIdentity(snapshot);
  if (!manifest) {
    return Object.freeze({
      status: SNAPSHOT_INTEGRITY_STATUS.UNVERIFIABLE_MANIFEST,
      repairNeeded: true,
      fingerprint: fingerprint('manifest-invalid', currentSource.sha256),
      currentSource,
      manifestSource: null,
    });
  }

  const sourceMatches = (
    manifest.source.sha256 === currentSource.sha256
    && manifest.source.record_count === currentSource.record_count
    && manifest.source.max_record_id === currentSource.max_record_id
  );
  if (!sourceMatches) {
    return Object.freeze({
      status: SNAPSHOT_INTEGRITY_STATUS.STALE_SOURCE,
      repairNeeded: true,
      fingerprint: fingerprint(
        'source-mismatch',
        currentSource.sha256,
        manifest.source.sha256,
      ),
      currentSource,
      manifestSource: manifest.source,
      manifestBenchmark: manifest.benchmark,
    });
  }

  const expected = normalizeOwnerlessBenchmark(expectedBenchmark);
  if (expected && manifest.benchmark !== expected) {
    return Object.freeze({
      status: SNAPSHOT_INTEGRITY_STATUS.STALE_BENCHMARK,
      repairNeeded: true,
      fingerprint: fingerprint(
        'benchmark-mismatch',
        currentSource.sha256,
        manifest.benchmark,
        expected,
      ),
      currentSource,
      manifestSource: manifest.source,
      manifestBenchmark: manifest.benchmark,
      expectedBenchmark: expected,
    });
  }

  return Object.freeze({
    status: SNAPSHOT_INTEGRITY_STATUS.FRESH,
    repairNeeded: false,
    fingerprint: fingerprint('fresh', currentSource.sha256, manifest.benchmark),
    currentSource,
    manifestSource: manifest.source,
    manifestBenchmark: manifest.benchmark,
  });
};
