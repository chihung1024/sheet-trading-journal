import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractIbkrUserJournalNote,
  hasLegacyIbkrMachineNote,
} from '../src/services/ibkrJournalNote.js';
import { __test as writerTest } from '../src/services/ibkrRecordCreate.js';
import { parseIbkrTradeCsv } from '../src/services/ibkrTradeImport.js';
import { fetchAllRecordPages } from '../src/services/recordPagination.js';

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

test('new importer may keep provenance in memory but persistence strips it before POST/durable intent', () => {
  const csv = [
    'AccountID,AssetClass,Symbol,BuySell,Quantity,TradePrice,IBCommission,Taxes,CurrencyPrimary,TradeDate,IBOrderID,TradeID,DateTime,LevelOfDetail,DataDiscriminator',
    'U123,STK,NVDA,BUY,10,100,-1,0,USD,2026-08-14,487287953,T1,20260814;093001,EXECUTION,EXECUTION',
  ].join('\n');
  const parsed = parseIbkrTradeCsv(csv);
  assert.equal(parsed.status, 'ready');
  assert.equal(parsed.entries.length, 1);
  assert.match(parsed.entries[0].idempotencyKey, /^IBKR~/);

  const persisted = writerTest.sanitizeIbkrRecordForPersistence(parsed.entries[0].record);
  assert.equal(persisted.note, '');
  assert.equal(persisted.symbol, 'NVDA');
});

test('persistence boundary keeps human text while removing IBKR envelope and account identifiers', () => {
  const record = {
    symbol: 'NVDA',
    note: `source=IBKR; account_id=U1234567; currency=USD; order_id=42; 交易想法：突破後續抱`,
  };
  const sanitized = writerTest.sanitizeIbkrRecordForPersistence(record);
  assert.equal(sanitized.note, '交易想法：突破後續抱');
  assert.doesNotMatch(JSON.stringify(sanitized), /U1234567|source=IBKR|order_id=/i);
});

test('records read boundary projects legacy D1 metadata before any journal UI consumes it', async () => {
  const records = await fetchAllRecordPages(async () => ({
    success: true,
    data: [
      {
        id: 1,
        txn_date: '2026-08-14',
        symbol: 'NVDA',
        txn_type: 'BUY',
        qty: 1,
        price: 100,
        fee: 0,
        tax: 0,
        tag: '',
        note: legacyNote,
      },
      {
        id: 2,
        txn_date: '2026-08-14',
        symbol: 'AMD',
        txn_type: 'BUY',
        qty: 1,
        price: 100,
        fee: 0,
        tax: 0,
        tag: '',
        note: `${legacyNote}; 人工備註：等財報`,
      },
    ],
    page: { limit: 1000, count: 2, has_more: false, next_cursor: null },
  }));

  assert.equal(records[0].note, '');
  assert.equal(records[1].note, '人工備註：等財報');
});
