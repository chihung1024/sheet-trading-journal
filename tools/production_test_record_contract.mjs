const OWNED_SMOKE_TAG_RE = /^NOW1A_API_SMOKE_[A-Za-z0-9]{1,24}_[A-Za-z0-9]{16,24}_(legacy|keyed)$/;

export const LEGACY_BROWSER_TAG = 'NOW1A-IDEMPOTENCY-TEST-20260813';
export const OWNED_SMOKE_TAG_PREFIX = 'NOW1A_API_SMOKE_';
export const LEGACY_SMOKE_NOTE = 'automated production idempotency legacy compatibility smoke';
export const KEYED_SMOKE_NOTE = 'automated production idempotency keyed replay smoke';

export function isLegacyBrowserTestRecord(record) {
  return record
    && record.tag === LEGACY_BROWSER_TAG
    && record.txn_date === '2026-08-13'
    && record.symbol === 'AAPL'
    && record.txn_type === 'BUY'
    && Number(record.qty) === 1
    && Number(record.price) === 1
    && Number(record.fee) === 0
    && Number(record.tax) === 0;
}

export function isOwnedSmokeRecord(record) {
  const tagMatch = String(record?.tag || '').match(OWNED_SMOKE_TAG_RE);
  return record
    && tagMatch
    && record.txn_date === '2026-08-13'
    && record.symbol === 'AAPL'
    && record.txn_type === 'BUY'
    && Number(record.qty) === 0.0001
    && Number(record.price) === 1
    && Number(record.fee) === 0
    && Number(record.tax) === 0
    && record.note === (tagMatch[1] === 'legacy' ? LEGACY_SMOKE_NOTE : KEYED_SMOKE_NOTE);
}

export function classifyProductionTestRecord(record) {
  if (isLegacyBrowserTestRecord(record)) return 'legacy_browser';
  if (isOwnedSmokeRecord(record)) return 'api_smoke';
  return null;
}

export function isProductionTestTagCandidate(record) {
  const tag = String(record?.tag || '');
  return tag === LEGACY_BROWSER_TAG || tag.startsWith(OWNED_SMOKE_TAG_PREFIX);
}

export function ownedSmokeTagKind(tag) {
  const match = String(tag || '').match(OWNED_SMOKE_TAG_RE);
  return match?.[1] || null;
}
