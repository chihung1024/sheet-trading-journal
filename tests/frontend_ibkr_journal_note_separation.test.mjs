import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  extractIbkrUserJournalNote,
  hasLegacyIbkrMachineNote,
} from '../src/services/ibkrJournalNote.js';
import { parseIbkrTradeCsv } from '../src/services/ibkrTradeImport.js';

const legacyNote = [
  'source=IBKR',
  'currency=USD',
  'security_type=STK',
  'aggregation=order',
  'trade_date=2026-08-14',
  'order_id=487287953',
  'fill_count=2',
  'trade_ids=T1|T2',
  'executed_at=20260814;093001|20260814;093101',
  'executed_at_taipei=2026-08-14T21:30:01+08:00',
  'batch_id=IBKR-20260814-STK-ORDER',
  'import_key=IBKR-20260814-487287953',
].join('; ');

test('pure legacy IBKR machine metadata projects to an empty user journal note', () => {
  assert.equal(hasLegacyIbkrMachineNote(legacyNote), true);
  assert.equal(extractIbkrUserJournalNote(legacyNote), '');
});

test('legacy metadata is removed while unknown human journal text is preserved', () => {
  const mixed = `${legacyNote}; 進場理由：財報後突破; 風險控制=跌破季線退出`;
  assert.equal(
    extractIbkrUserJournalNote(mixed),
    '進場理由：財報後突破; 風險控制=跌破季線退出',
  );
});

test('ordinary notes are never interpreted as IBKR metadata without the exact source anchor', () => {
  const ordinary = 'currency=USD; order_id=我自己的交易編號; 進場理由：估值合理';
  assert.equal(hasLegacyIbkrMachineNote(ordinary), false);
  assert.equal(extractIbkrUserJournalNote(ordinary), ordinary);
});

test('metadata key matching is case-insensitive but does not delete unknown assignments', () => {
  const note = 'Source=ibkr; Currency=USD; Order_ID=123; thesis=長期持有; 自訂文字';
  assert.equal(extractIbkrUserJournalNote(note), 'thesis=長期持有; 自訂文字');
});

test('new IBKR parser no longer uses user note as a machine metadata transport', () => {
  const csv = [
    'AccountID,AssetClass,Symbol,BuySell,Quantity,TradePrice,IBCommission,Taxes,CurrencyPrimary,TradeDate,IBOrderID,TradeID,DateTime,LevelOfDetail,DataDiscriminator',
    'U123,STK,NVDA,BUY,10,100,-1,0,USD,2026-08-14,487287953,T1,20260814;093001,EXECUTION,EXECUTION',
  ].join('\n');
  const parsed = parseIbkrTradeCsv(csv);
  assert.equal(parsed.status, 'ready');
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].record.note, '');
  assert.match(parsed.entries[0].idempotencyKey, /^IBKR~/);
});

test('records read boundary, persistence boundary, and journal UI use the shared note projection', async () => {
  const [pagination, writer, recordList, tradeForm] = await Promise.all([
    readFile(new URL('../src/services/recordPagination.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/ibkrRecordCreate.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/RecordList.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/TradeForm.vue', import.meta.url), 'utf8'),
  ]);

  assert.match(pagination, /extractIbkrUserJournalNote/);
  assert.match(writer, /extractIbkrUserJournalNote/);
  assert.match(recordList, /r\.note/);
  assert.match(tradeForm, /form\.note\s*=\s*r\.note\s*\|\|\s*''/);
  assert.doesNotMatch(recordList, /source=IBKR/);
  assert.doesNotMatch(tradeForm, /source=IBKR/);
});
