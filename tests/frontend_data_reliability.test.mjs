import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildDataReliabilityIssues,
  getPortfolioAnomalies,
  normalizePortfolioAnomaly,
  selectPortfolioGroupData,
} from '../src/services/dataReliability.js';

test('group anomaly selection follows the currently published snapshot group', () => {
  const rawData = {
    anomalies: [{ code: 'LEGACY_TOP' }],
    groups: {
      all: { anomalies: [{ code: 'ALL_WARNING' }] },
      growth: { anomalies: [{ code: 'GROWTH_WARNING' }] },
    },
  };

  assert.equal(selectPortfolioGroupData(rawData, 'growth'), rawData.groups.growth);
  assert.deepEqual(getPortfolioAnomalies(rawData, 'growth'), [{ code: 'GROWTH_WARNING' }]);
  assert.deepEqual(getPortfolioAnomalies(rawData, 'missing'), [{ code: 'LEGACY_TOP' }]);
  assert.deepEqual(getPortfolioAnomalies(null, 'all'), []);
});

test('dividend policy anomaly explains why an automatic pending dividend is absent', () => {
  const issue = normalizePortfolioAnomaly({
    code: 'DIVIDEND_POLICY_REVIEW_REQUIRED',
    symbol: '7203.T',
    date: '2026-08-08',
    currency: 'JPY',
    message: 'backend detail',
  });

  assert.equal(issue.severity, 'warning');
  assert.equal(issue.code, 'DIVIDEND_POLICY_REVIEW_REQUIRED');
  assert.match(issue.title, /配息需人工確認/);
  assert.match(issue.message, /7203\.T/);
  assert.match(issue.message, /JPY/);
  assert.match(issue.message, /沒有自動估算/);
});

test('unknown structured anomaly remains visible instead of being silently dropped', () => {
  const issue = normalizePortfolioAnomaly({
    code: 'NEW_BACKEND_WARNING',
    message: 'review this calculation',
  });
  assert.equal(issue.code, 'NEW_BACKEND_WARNING');
  assert.equal(issue.title, '計算警示');
  assert.equal(issue.message, 'review this calculation');
});

test('connection failure and stale snapshot are persistent reliability issues', () => {
  const issues = buildDataReliabilityIssues({
    connectionStatus: 'error',
    snapshotFreshness: 'stale',
    anomalies: [{ code: 'DIVIDEND_POLICY_REVIEW_REQUIRED', currency: 'KRW' }],
  });

  assert.deepEqual(issues.map(issue => issue.source), [
    'connection',
    'snapshot',
    'snapshot_anomaly',
  ]);
  assert.equal(issues[0].retryable, true);
  assert.match(issues[0].message, /上一次成功載入的快照/);
  assert.match(issues[1].message, /交易紀錄已變更/);
});

test('duplicate backend anomalies are shown once per current group', () => {
  const anomaly = {
    code: 'DIVIDEND_POLICY_REVIEW_REQUIRED',
    symbol: '9988.HK',
    date: '2026-08-08',
    currency: 'HKD',
    message: 'same',
  };
  const issues = buildDataReliabilityIssues({ anomalies: [anomaly, { ...anomaly }] });
  assert.equal(issues.length, 1);
});

test('reliability banner consumes backend provenance and never infers anomalies from pending-count zero', async () => {
  const source = await readFile(new URL('../src/components/DataReliabilityBanner.vue', import.meta.url), 'utf8');
  assert.match(source, /getPortfolioAnomalies/);
  assert.match(source, /store\.rawData/);
  assert.match(source, /store\.currentGroup/);
  assert.match(source, /store\.snapshotFreshness/);
  assert.match(source, /store\.connectionStatus/);
  assert.match(source, /await store\.fetchAll\(\)/);
  assert.doesNotMatch(source, /pending_dividends\.length\s*===\s*0/);
});
