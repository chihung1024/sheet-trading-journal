import {
  CANONICAL_HEADERS,
  CANONICAL_TRADE_CSV_FORMAT,
} from './brokerNeutralImportPreview.js';

export const CANONICAL_TRADE_CSV_TEMPLATE_FILENAME = 'sheet-trading-journal-canonical-trades-v1.csv';
export const CANONICAL_TRADE_CSV_TEMPLATE_MIME = 'text/csv;charset=utf-8';

export function buildCanonicalTradeCsvTemplateText() {
  return `${CANONICAL_HEADERS.join(',')}\r\n`;
}

export function getCanonicalTradeCsvTemplateDescriptor() {
  return {
    format: CANONICAL_TRADE_CSV_FORMAT,
    filename: CANONICAL_TRADE_CSV_TEMPLATE_FILENAME,
    mime: CANONICAL_TRADE_CSV_TEMPLATE_MIME,
    text: buildCanonicalTradeCsvTemplateText(),
    contains_sample_transactions: false,
  };
}
