const IBKR_MACHINE_NOTE_KEYS = new Set([
  'source',
  'currency',
  'security_type',
  'aggregation',
  'trade_date',
  'order_id',
  'fill_count',
  'trade_ids',
  'executed_at',
  'executed_at_taipei',
  'batch_id',
  'import_key',
  'account',
  'account_id',
  'account_number',
  'client_account_id',
]);

const assignmentKey = (segment) => {
  const match = String(segment ?? '').trim().match(/^([A-Za-z0-9_]+)\s*=/);
  return match ? match[1].toLowerCase() : null;
};

const isIbkrSourceSegment = (segment) => (
  /^source\s*=\s*IBKR\s*$/i.test(String(segment ?? '').trim())
);

/**
 * Convert the legacy IBKR metadata envelope stored in `records.note` into the
 * actual user journal note. The transform is intentionally anchored by an
 * exact `source=IBKR` segment so ordinary notes such as `currency=USD` are not
 * interpreted as machine metadata.
 */
export function extractIbkrUserJournalNote(value) {
  const note = String(value ?? '');
  if (!note) return '';

  const segments = note.split(';');
  if (!segments.some(isIbkrSourceSegment)) return note;

  return segments
    .map(segment => segment.trim())
    .filter(Boolean)
    .filter(segment => {
      const key = assignmentKey(segment);
      return !key || !IBKR_MACHINE_NOTE_KEYS.has(key);
    })
    .join('; ')
    .trim();
}

export const hasLegacyIbkrMachineNote = value => {
  const note = String(value ?? '');
  if (!note) return false;
  const segments = note.split(';');
  return segments.some(isIbkrSourceSegment)
    && segments.some(segment => IBKR_MACHINE_NOTE_KEYS.has(assignmentKey(segment)));
};

export const __test = Object.freeze({
  IBKR_MACHINE_NOTE_KEYS,
  assignmentKey,
  isIbkrSourceSegment,
});
