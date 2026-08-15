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

// IBKR CSV DateTime values use `YYYYMMDD;HHMMSS`. The semicolon is part of
// the value, so it must be removed as one known machine token before the
// legacy note is split on semicolon separators.
const EXECUTION_TIMESTAMPS_RE = /(^|;\s*)executed_at\s*=\s*\d{8};\d{6}(?:\.\d+)?(?:\|\d{8};\d{6}(?:\.\d+)?)*(?=\s*(?:;|$))/gi;

const assignmentKey = (segment) => {
  const match = String(segment ?? '').trim().match(/^([A-Za-z0-9_]+)\s*=/);
  return match ? match[1].toLowerCase() : null;
};

const isIbkrSourceSegment = (segment) => (
  /^source\s*=\s*IBKR\s*$/i.test(String(segment ?? '').trim())
);

const hasIbkrSourceAnchor = note => String(note ?? '')
  .split(';')
  .some(isIbkrSourceSegment);

/**
 * Convert the legacy IBKR metadata envelope stored in `records.note` into the
 * actual user journal note. The transform is intentionally anchored by an
 * exact `source=IBKR` segment so ordinary notes such as `currency=USD` are not
 * interpreted as machine metadata.
 */
export function extractIbkrUserJournalNote(value) {
  const note = String(value ?? '');
  if (!note) return '';
  if (!hasIbkrSourceAnchor(note)) return note;

  const withoutExecutionTimestamps = note.replace(EXECUTION_TIMESTAMPS_RE, '$1');

  return withoutExecutionTimestamps
    .split(';')
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
  if (!note || !hasIbkrSourceAnchor(note)) return false;
  return note
    .replace(EXECUTION_TIMESTAMPS_RE, '$1')
    .split(';')
    .some(segment => IBKR_MACHINE_NOTE_KEYS.has(assignmentKey(segment)));
};

export const __test = Object.freeze({
  IBKR_MACHINE_NOTE_KEYS,
  EXECUTION_TIMESTAMPS_RE,
  assignmentKey,
  isIbkrSourceSegment,
  hasIbkrSourceAnchor,
});
