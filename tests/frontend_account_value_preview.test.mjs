import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAccountValuePreviewPresentation } from '../src/services/accountValuePreviewPresentation.js';

const readyPreview = overrides => ({
  preview_version: 1,
  status: 'ready',
  base_currency: 'TWD',
  method: 'securities_plus_authoritative_cash_v1',
  fx_policy: 'engine_current_valuation_fx_context',
  cash_ledger_complete: true,
  securities_value_twd: 500,
  cash_value_twd: 100,
  account_value_twd: 600,
  cash_components: [
    { currency: 'USD', balance_native: 2, fx_twd_per_native: 50, value_twd: 100 },
  ],
  reason: null,
  missing_cash_fx_currencies: [],
  ...overrides,
});

test('ready account preview renders engine-published values without browser recomputation', () => {
  const model = buildAccountValuePreviewPresentation({
    // Deliberately inconsistent arithmetic proves this presentation layer does
    // not become a second accounting authority. Python validates reconciliation.
    preview: readyPreview({ account_value_twd: 999 }),
    currentGroup: 'all',
  });

  assert.equal(model.status, 'ready');
  assert.equal(model.accountValueTwd, 999);
  assert.equal(model.securitiesValueTwd, 500);
  assert.equal(model.cashValueTwd, 100);
  assert.equal(model.componentCount, 1);
});

test('account preview is hidden for tag groups because cash allocation is not authoritative', () => {
  const model = buildAccountValuePreviewPresentation({
    preview: readyPreview(),
    currentGroup: 'Stock',
  });

  assert.deepEqual(model, { status: 'hidden' });
});

test('missing snapshot contract stays hidden for backward-compatible older snapshots', () => {
  assert.deepEqual(
    buildAccountValuePreviewPresentation({ preview: null, currentGroup: 'all' }),
    { status: 'hidden' },
  );
});

test('engine unavailable reason is preserved without inventing a value', () => {
  const model = buildAccountValuePreviewPresentation({
    preview: {
      ...readyPreview(),
      status: 'unavailable',
      cash_value_twd: null,
      account_value_twd: null,
      cash_components: [],
      reason: 'cash_fx_unavailable',
      missing_cash_fx_currencies: ['EUR'],
    },
    currentGroup: 'all',
  });

  assert.equal(model.status, 'unavailable');
  assert.equal(model.reason, 'cash_fx_unavailable');
  assert.deepEqual(model.missingFxCurrencies, ['EUR']);
  assert.match(model.message, /匯率/);
  assert.equal('accountValueTwd' in model, false);
});

test('unknown preview version fails closed in presentation', () => {
  const model = buildAccountValuePreviewPresentation({
    preview: readyPreview({ preview_version: 2 }),
    currentGroup: 'all',
  });

  assert.equal(model.status, 'unavailable');
  assert.equal(model.reason, 'contract_invalid');
});
