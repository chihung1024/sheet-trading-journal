import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildAccountDailyPnlPresentation } from '../src/services/accountDailyPnlPresentation.js';
import { buildDailyPnlExplanation } from '../src/services/dailyPnlExplainability.js';

const overviewSource = fs.readFileSync(
  new URL('../src/components/OverviewPage.vue', import.meta.url),
  'utf8',
);
const accountValueSource = fs.readFileSync(
  new URL('../src/components/AccountValuePreview.vue', import.meta.url),
  'utf8',
);
const explanationSource = fs.readFileSync(
  new URL('../src/components/DailyPnlExplanation.vue', import.meta.url),
  'utf8',
);
const presentationSource = fs.readFileSync(
  new URL('../src/services/accountDailyPnlPresentation.js', import.meta.url),
  'utf8',
);

const securityRow = {
  symbol: 'NVDA',
  market: 'US',
  currency: 'USD',
  price_pnl_twd: 0,
  fx_pnl_twd: 1000,
  dividend_income_twd: 0,
  execution_pnl_twd: 0,
  fee_tax_pnl_twd: 0,
  total_pnl_twd: 1000,
};
const cashRow = {
  row_kind: 'cash',
  symbol: '現金 USD',
  market: 'CASH',
  currency: 'USD',
  price_pnl_twd: 0,
  fx_pnl_twd: 500,
  dividend_income_twd: 0,
  execution_pnl_twd: 0,
  fee_tax_pnl_twd: 0,
  total_pnl_twd: 500,
};

const readyPreview = (overrides = {}) => ({
  preview_version: 1,
  status: 'ready',
  scope: 'whole_account',
  cash_ledger_complete: true,
  as_of_date: '2026-08-05',
  prev_date: '2026-08-04',
  account_daily_pnl_twd: 1500,
  account_daily_pnl_raw_twd: 1500,
  daily_pnl_base_value_twd: 45000,
  daily_pnl_roi_percent: 3.33,
  day_ledger: [securityRow, cashRow],
  ...overrides,
});

test('whole-account preview becomes the overview daily authority only after exact ledger reconciliation', () => {
  const model = buildAccountDailyPnlPresentation({ preview: readyPreview(), currentGroup: 'all' });

  assert.equal(model.status, 'ready');
  assert.equal(model.scope, 'account');
  assert.equal(model.dayLedger.length, 2);
  assert.deepEqual(model.statsOverrides, {
    daily_pnl_twd: 1500,
    daily_pnl_roi_percent: 3.33,
    daily_pnl_base_value: 45000,
    daily_pnl_asof_date: '2026-08-05',
    daily_pnl_prev_date: '2026-08-04',
  });

  const explanation = buildDailyPnlExplanation({
    dayLedger: model.dayLedger,
    summary: model.statsOverrides,
  });
  assert.equal(explanation.status, 'ready');
  assert.equal(explanation.publishedTotalTwd, 1500);
  const fx = explanation.componentTotals.find(item => item.key === 'fx_pnl_twd');
  assert.equal(fx.valueTwd, 1500);
  assert.ok(explanation.rows.some(row => row.symbol === '現金 USD' && row.totalPnlTwd === 500));
});

test('group views and unavailable or malformed account previews fail closed to securities scope', () => {
  assert.equal(
    buildAccountDailyPnlPresentation({ preview: readyPreview(), currentGroup: 'Core' }).status,
    'hidden',
  );
  assert.equal(
    buildAccountDailyPnlPresentation({ preview: { status: 'unavailable', reason: 'cash_fx_unavailable' } }).status,
    'unavailable',
  );
  assert.equal(
    buildAccountDailyPnlPresentation({
      preview: readyPreview({ account_daily_pnl_raw_twd: 1400 }),
    }).reason,
    'day_ledger_mismatch',
  );
});

test('signed account base value is preserved while return may remain unavailable', () => {
  const model = buildAccountDailyPnlPresentation({
    preview: readyPreview({
      daily_pnl_base_value_twd: -1000,
      daily_pnl_roi_percent: null,
    }),
  });
  assert.equal(model.status, 'ready');
  assert.equal(model.statsOverrides.daily_pnl_base_value, -1000);
  assert.equal(model.statsOverrides.daily_pnl_roi_percent, null);
});

test('browser selects engine-published account preview without adding accounting or FX math', () => {
  assert.match(overviewSource, /rawData\?\.account_daily_pnl_preview/);
  assert.match(overviewSource, /accountDailyPnl\.value\.dayLedger/);
  assert.match(overviewSource, /effectiveDailyStats/);
  assert.match(overviewSource, /daily-account-pnl-ready/);
  assert.doesNotMatch(presentationSource, /\bfetch\s*\(|\/api\/|exchange_rate|fx_rate/);
  assert.match(accountValueSource, /今日損益已納入權威現金/);
  assert.match(accountValueSource, /TWR、XIRR/);
  assert.match(explanationSource, /全部帳戶（持倉＋現金）/);
  assert.match(explanationSource, /外幣現金（含負餘額）會納入匯率曝險/);
});
