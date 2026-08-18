import { runRecordImportBatch } from './recordImportBatch.js';

export const runIbkrTradeImportBatch = (entries, dependencies) => (
  runRecordImportBatch(entries, dependencies)
);
