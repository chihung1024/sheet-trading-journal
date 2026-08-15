import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveIbkrImportProfile,
  isIbkrImportProfileScope,
  normalizeIbkrImportProfileName,
} from '../src/services/ibkrImportProfile.js';
import { parseIbkrTradeCsv } from '../src/services/ibkrTradeImport.js';

const noAccountHeader = 'AssetClass,Symbol,BuySell,Quantity,TradePrice,IBCommission,Taxes,CurrencyPrimary,TradeDate,IBOrderID,TradeID,DateTime,LevelOfDetail,DataDiscriminator';
const accountHeader = `AccountID,${noAccountHeader}`;

const row = ({ account = null, symbol = 'VFLO', side = 'BUY', qty = '10', price = '53.71', commission = '0.05', order = '1781662666', trade = 'EXEC-1' } = {}) => {
  const values = [
    'STK', symbol, side, qty, price, commission, '0', 'USD', '2026-08-14', order, trade,
    '20260814;154222', 'EXECUTION', 'EXECUTION',
  ];
  return account === null ? values.join(',') : [account, ...values].join(',');
};

test('profile names normalize predictably but the raw label never becomes the scope id', async () => {
  assert.equal(normalizeIbkrImportProfileName('  Main   IBKR  '), 'Main IBKR');
  const first = await deriveIbkrImportProfile('Main IBKR');
  const replay = await deriveIbkrImportProfile(' main   ibkr ');
  const other = await deriveIbkrImportProfile('Other IBKR');

  assert.equal(first.displayName, 'Main IBKR');
  assert.equal(first.scopeId, replay.scopeId);
  assert.notEqual(first.scopeId, other.scopeId);
  assert.equal(isIbkrImportProfileScope(first.scopeId), true);
  assert.match(first.scopeId, /^PROFILE_[A-F0-9]{64}$/);
  assert.doesNotMatch(first.scopeId, /MAIN|IBKR/);
});

test('account-less connector-derived CSV stays fail-closed without a profile', () => {
  const parsed = parseIbkrTradeCsv([noAccountHeader, row()].join('\n'));
  assert.equal(parsed.status, 'invalid');
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.warnings[0].code, 'MISSING_COLUMNS');
  assert.match(parsed.warnings[0].message, /accountId/);
});

test('account-less connector-derived CSV becomes importable only with a validated profile scope', async () => {
  const profile = await deriveIbkrImportProfile('Primary connector');
  const parsed = parseIbkrTradeCsv(
    [noAccountHeader, row()].join('\n'),
    { accountScope: profile.scopeId },
  );

  assert.equal(parsed.status, 'ready');
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].source.accountId, '');
  assert.equal(parsed.entries[0].source.scopeId, profile.scopeId);
  assert.equal(parsed.entries[0].source.scopeMode, 'profile');
  assert.match(parsed.entries[0].idempotencyKey, new RegExp(profile.scopeId));
  assert.doesNotMatch(parsed.entries[0].record.note, /Primary connector/i);
});

test('the same profile creates the same durable source identity for connector data and a later single-account Flex CSV', async () => {
  const profile = await deriveIbkrImportProfile('Primary connector');
  const connector = parseIbkrTradeCsv(
    [noAccountHeader, row()].join('\n'),
    { accountScope: profile.scopeId },
  );
  const flex = parseIbkrTradeCsv(
    [accountHeader, row({ account: 'U1234567' })].join('\n'),
    { accountScope: profile.scopeId },
  );

  assert.equal(connector.status, 'ready');
  assert.equal(flex.status, 'ready');
  assert.equal(connector.entries[0].idempotencyKey, flex.entries[0].idempotencyKey);
  assert.equal(flex.entries[0].source.accountId, 'U1234567');
  assert.equal(flex.entries[0].source.scopeMode, 'profile');
});

test('different profiles intentionally produce different durable identities', async () => {
  const main = await deriveIbkrImportProfile('Primary connector');
  const other = await deriveIbkrImportProfile('Secondary connector');
  const csv = [noAccountHeader, row()].join('\n');

  const first = parseIbkrTradeCsv(csv, { accountScope: main.scopeId });
  const second = parseIbkrTradeCsv(csv, { accountScope: other.scopeId });
  assert.notEqual(first.entries[0].idempotencyKey, second.entries[0].idempotencyKey);
});

test('one profile cannot collapse a multi-account CSV into one broker scope', async () => {
  const profile = await deriveIbkrImportProfile('Primary connector');
  const parsed = parseIbkrTradeCsv([
    accountHeader,
    row({ account: 'U111', trade: 'A1' }),
    row({ account: 'U222', trade: 'B1' }),
  ].join('\n'), { accountScope: profile.scopeId });

  assert.equal(parsed.status, 'invalid');
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.warnings[0].code, 'PROFILE_MULTI_ACCOUNT_CONFLICT');
});

test('untrusted profile scope strings are rejected before parsing ledger rows', () => {
  const parsed = parseIbkrTradeCsv(
    [noAccountHeader, row()].join('\n'),
    { accountScope: 'PROFILE_NOT_A_REAL_HASH' },
  );
  assert.equal(parsed.status, 'invalid');
  assert.equal(parsed.warnings[0].code, 'INVALID_PROFILE_SCOPE');
});