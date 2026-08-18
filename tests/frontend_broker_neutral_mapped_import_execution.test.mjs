import assert from 'node:assert/strict';
import test from 'node:test';

import { MAPPING_SOURCE_MODE } from '../src/services/brokerNeutralColumnMapping.js';
import {
  prepareMappedBrokerImport,
  serializeMappedImportContract,
} from '../src/services/brokerNeutralMappedImportExecution.js';
import { BrokerNeutralImportExecutionError } from '../src/services/brokerNeutralImportExecution.js';

const column = source_header => ({ mode: MAPPING_SOURCE_MODE.COLUMN, source_header });
const constant = value => ({ mode: MAPPING_SOURCE_MODE.CONSTANT, value });

const source = [
  'Date,Ticker,Side,Shares,Price,CCY,Memo',
  '2026-08-17,NVDA,BUY,1,100,USD,first',
  '2026-08-17,NVDA,BUY,1,100,USD,second',
].join('\n');

const baseMapping = {
  txn_date: column('Date'),
  symbol: column('Ticker'),
  txn_type: column('Side'),
  qty: column('Shares'),
  price: column('Price'),
  currency: column('CCY'),
  note: column('Memo'),
};

test('same original source, normalized profile, and mapping produce stable replay identities', async () => {
  const first = await prepareMappedBrokerImport(source, baseMapping, '  Futu   Main ');
  const replay = await prepareMappedBrokerImport(source, { ...baseMapping }, 'futu main');

  assert.equal(first.format, 'broker-column-mapping-v1');
  assert.equal(first.execution_version, 1);
  assert.equal(first.source_profile, 'Futu Main');
  assert.equal(first.source_digest, replay.source_digest);
  assert.equal(first.mapping_contract, replay.mapping_contract);
  assert.deepEqual(
    first.entries.map(entry => entry.idempotencyKey),
    replay.entries.map(entry => entry.idempotencyKey),
  );
  assert.equal(first.entries.length, 2);
  assert.match(first.entries[0].idempotencyKey, /^csvm1\.[0-9a-f]{64}\.r1$/);
  assert.match(first.entries[1].idempotencyKey, /^csvm1\.[0-9a-f]{64}\.r2$/);
  assert.notEqual(first.entries[0].idempotencyKey, first.entries[1].idempotencyKey);
  assert.ok(first.entries.every(entry => entry.record.event_source === 'IMPORT'));
});

test('mapping contract, source text, and source profile each participate in stable identity', async () => {
  const first = await prepareMappedBrokerImport(source, baseMapping, 'Broker A');
  const mappedNoteConstant = await prepareMappedBrokerImport(source, {
    ...baseMapping,
    note: constant('fixed'),
  }, 'Broker A');
  const editedSource = await prepareMappedBrokerImport(
    source.replace(',first', ',first edited'),
    baseMapping,
    'Broker A',
  );
  const otherProfile = await prepareMappedBrokerImport(source, baseMapping, 'Broker B');

  assert.notEqual(first.source_digest, mappedNoteConstant.source_digest);
  assert.notEqual(first.source_digest, editedSource.source_digest);
  assert.notEqual(first.source_digest, otherProfile.source_digest);
  assert.notEqual(first.entries[0].idempotencyKey, mappedNoteConstant.entries[0].idempotencyKey);
  assert.notEqual(first.entries[0].idempotencyKey, editedSource.entries[0].idempotencyKey);
  assert.notEqual(first.entries[0].idempotencyKey, otherProfile.entries[0].idempotencyKey);
});

test('mapping contract serialization follows canonical field order rather than caller object order', async () => {
  const reversed = Object.fromEntries(Object.entries(baseMapping).reverse());
  const first = await prepareMappedBrokerImport(source, baseMapping, 'Broker A');
  const second = await prepareMappedBrokerImport(source, reversed, 'Broker A');

  assert.equal(first.mapping_contract, second.mapping_contract);
  assert.equal(first.source_digest, second.source_digest);
  assert.deepEqual(first.entries.map(entry => entry.idempotencyKey), second.entries.map(entry => entry.idempotencyKey));

  const parsed = JSON.parse(serializeMappedImportContract(first.mapped_preview.mapping));
  assert.equal(parsed[0][0], 'txn_date');
  assert.equal(parsed[1][0], 'symbol');
});

test('mapped execution reparses and refuses any mapped source that is not fully canonical-ready', async () => {
  const invalidSource = [
    'Date,Ticker,Side,Shares,Price,CCY',
    '08/17/2026,nvda,Buy,-1,"1,000",usd',
  ].join('\n');

  await assert.rejects(
    () => prepareMappedBrokerImport(invalidSource, {
      txn_date: column('Date'),
      symbol: column('Ticker'),
      txn_type: column('Side'),
      qty: column('Shares'),
      price: column('Price'),
      currency: column('CCY'),
    }, 'Broker A'),
    error => error instanceof BrokerNeutralImportExecutionError
      && error.code === 'MAPPED_PREVIEW_NOT_FULLY_READY',
  );
});

test('explicit reviewed constants remain part of both persisted records and mapping identity', async () => {
  const sourceWithoutSideCurrency = [
    'Date,Ticker,Shares,Price',
    '2026-08-17,NVDA,1,100',
  ].join('\n');

  const prepared = await prepareMappedBrokerImport(sourceWithoutSideCurrency, {
    txn_date: column('Date'),
    symbol: column('Ticker'),
    txn_type: constant('BUY'),
    qty: column('Shares'),
    price: column('Price'),
    currency: constant('USD'),
    tag: constant('Imported'),
  }, 'Broker A');

  assert.equal(prepared.entries[0].record.txn_type, 'BUY');
  assert.equal(prepared.entries[0].record.currency, 'USD');
  assert.equal(prepared.entries[0].record.tag, 'Imported');
  assert.match(prepared.mapping_contract, /"txn_type","constant","BUY"/);
  assert.match(prepared.mapping_contract, /"currency","constant","USD"/);
});
