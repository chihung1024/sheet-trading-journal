import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  publishRecordCreateRecoverySuccess,
  subscribeRecordCreateRecoverySuccess,
} from '../src/services/recordCreateRecoverySignal.js';

const readSource = relativePath => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('record-create recovery success signal validates input, normalizes owner, freezes evidence, and isolates listeners', () => {
  const seen = [];
  const unsubscribeThrowing = subscribeRecordCreateRecoverySuccess(() => {
    throw new Error('listener failure must be isolated');
  });
  const unsubscribe = subscribeRecordCreateRecoverySuccess(event => seen.push(event));

  try {
    assert.equal(publishRecordCreateRecoverySuccess({ owner: '', body: '{}' }), false);
    assert.equal(publishRecordCreateRecoverySuccess({ owner: 'user@example.com', body: '' }), false);
    assert.equal(publishRecordCreateRecoverySuccess({ owner: 'user@example.com', body: '{}', recoveredAt: NaN }), false);

    assert.equal(publishRecordCreateRecoverySuccess({
      owner: ' User@Example.COM ',
      body: '{"symbol":"AAPL"}',
      recoveredAt: 1234,
    }), true);

    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0], {
      owner: 'user@example.com',
      body: '{"symbol":"AAPL"}',
      recoveredAt: 1234,
    });
    assert.equal(Object.isFrozen(seen[0]), true);
  } finally {
    unsubscribe();
    unsubscribeThrowing();
  }
});

test('unsubscribe prevents later recovery-success delivery', () => {
  let count = 0;
  const unsubscribe = subscribeRecordCreateRecoverySuccess(() => {
    count += 1;
  });
  unsubscribe();

  publishRecordCreateRecoverySuccess({
    owner: 'user@example.com',
    body: '{}',
    recoveredAt: 1,
  });
  assert.equal(count, 0);
});

test('portfolio publishes UI completion only from the authoritative same-key recovery success path', async () => {
  const source = await readSource('../src/stores/portfolio.js');
  const recoveryStart = source.indexOf('const recoverPendingRecordCreateIntent');
  const recoveryEnd = source.indexOf('const addRecord = async', recoveryStart);
  const recovery = source.slice(recoveryStart, recoveryEnd);
  const addStart = recoveryEnd;
  const addEnd = source.indexOf('const updateRecord = async', addStart);
  const addRecord = source.slice(addStart, addEnd);

  assert.match(source, /publishRecordCreateRecoverySuccess/);
  assert.equal((recovery.match(/publishRecordCreateRecoverySuccess\(/g) || []).length, 1);
  assert.doesNotMatch(addRecord, /publishRecordCreateRecoverySuccess\(/);

  const successGuard = recovery.indexOf('if (!json?.success)');
  const completeIntent = recovery.indexOf('completeRecordCreateIntent(');
  const snapshotStale = recovery.indexOf('markSnapshotStale()');
  const dirty = recovery.indexOf('markCommittedMutationDirtyForAutomaticRecalculation()');
  const publish = recovery.indexOf('publishRecordCreateRecoverySuccess({');

  assert.ok(successGuard >= 0);
  assert.ok(completeIntent > successGuard);
  assert.ok(snapshotStale > completeIntent);
  assert.ok(dirty > snapshotStale);
  assert.ok(publish > snapshotStale);
  assert.ok(publish > dirty);
  assert.match(recovery, /owner: intent\.owner/);
  assert.match(recovery, /body: intent\.body/);
});

test('TradeForm completes only the matching unresolved create and preserves user edits', async () => {
  const source = await readSource('../src/components/TradeForm.vue');

  assert.match(source, /subscribeRecordCreateRecoverySuccess/);
  assert.match(source, /let unresolvedCreateBody = null/);
  assert.match(source, /const buildRecordPayload = \(\) =>/);
  assert.match(source, /unresolvedCreateBody = JSON\.stringify\(payload\)/);
  assert.match(source, /event\.owner !== normalizeRecoveryOwner\(auth\.user\?\.email\)/);
  assert.match(source, /event\.body !== unresolvedCreateBody/);
  assert.match(source, /currentBody = JSON\.stringify\(buildRecordPayload\(\)\)/);
  assert.match(source, /if \(currentBody !== recoveredBody\) \{/);
  assert.match(source, /目前表單已修改，已保留新的輸入/);

  const listenerStart = source.indexOf('const unsubscribeRecordCreateRecovery');
  const listenerEnd = source.indexOf('onUnmounted(', listenerStart);
  const listener = source.slice(listenerStart, listenerEnd);
  const compareAt = listener.indexOf('if (currentBody !== recoveredBody)');
  const resetAt = listener.indexOf('resetForm()');
  assert.ok(compareAt >= 0 && resetAt > compareAt);
  assert.match(listener, /emit\('submitted'\)/);

  const resetStart = source.indexOf('const resetForm = () =>');
  const resetEnd = source.indexOf('const setupForm', resetStart);
  assert.match(source.slice(resetStart, resetEnd), /unresolvedCreateBody = null/);
  const setupStart = resetEnd;
  const setupEnd = source.indexOf('const normalizeRecoveryOwner', setupStart);
  assert.match(source.slice(setupStart, setupEnd), /unresolvedCreateBody = null/);
  assert.match(source, /onUnmounted\(\(\) => unsubscribeRecordCreateRecovery\(\)\)/);
});

test('DividendManager confirmation is derived from server DIV records, not recovery-signal or local-storage state', async () => {
  const source = await readSource('../src/components/DividendManager.vue');

  assert.match(source, /buildConfirmedDividendKeySet/);
  assert.match(source, /isDividendConfirmedByRecords/);
  assert.match(source, /const confirmedDividendKeys = computed\(\(\) => buildConfirmedDividendKeySet\(store\.records\)\)/);
  assert.match(source, /const isConfirmed = \(div\) => isDividendConfirmedByRecords\(div, confirmedDividendKeys\.value\)/);

  assert.doesNotMatch(source, /useAuthStore/);
  assert.doesNotMatch(source, /subscribeRecordCreateRecoverySuccess/);
  assert.doesNotMatch(source, /confirmed_dividend_keys/);
  assert.doesNotMatch(source, /loadConfirmedKeys|saveConfirmedKeys/);
  assert.doesNotMatch(source, /confirmedKeys\.value\.(add|delete)/);

  // A committed write whose records refresh is temporarily unavailable may only
  // enter the memory-only safety lock; it must not be promoted to confirmation.
  assert.match(source, /const committedAwaitingReadbackKeys = ref\(new Set\(\)\)/);
  assert.match(source, /if \(!outcome\.refreshed \|\| !isConfirmed\(div\)\)/);
  assert.match(source, /已保存，等待同步/);
});
