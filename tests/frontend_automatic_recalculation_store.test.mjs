import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../src/stores/portfolio.js', import.meta.url);

const blockBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
};

test('store declares one bounded debounce lane and durable automatic-recalculation helpers', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /AUTOMATIC_RECALCULATION_DEBOUNCE_MS = 1200/);
  assert.match(source, /let automaticRecalculationTimer = null/);
  assert.match(source, /let automaticRecalculationPromise = null/);
  assert.match(source, /let lastAutomaticRecalculationAttemptToken = null/);
  assert.match(source, /markAutomaticRecalculationDirty/);
  assert.match(source, /markAutomaticRecalculationCoverage/);
  assert.match(source, /settleAutomaticRecalculationJob/);
});

test('active calculation detection includes first-trade snapshot polling before other job signals', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const block = blockBetween(source, 'const hasActiveCalculationIntent = () => {', 'const scheduleAutomaticRecalculationFlush');
  const snapshotAt = block.indexOf('if (snapshotPollActive) return true');
  const triggerAt = block.indexOf('if (triggerUpdatePromise) return true');
  const jobAt = block.indexOf("calculationJob.value?.status === 'queued'");

  assert.equal(snapshotAt >= 0, true);
  assert.equal(triggerAt > snapshotAt, true);
  assert.equal(jobAt > triggerAt, true);
  assert.match(block, /return Boolean\(pending\?\.jobId\)/);
});

test('confirmed create and recovered create become dirty only when first-trade server auto-update is absent', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const recovery = blockBetween(source, 'const recoverPendingRecordCreateIntent', 'const addRecord = async');
  const add = blockBetween(source, 'const addRecord = async', 'const updateRecord = async');

  for (const block of [recovery, add]) {
    const commitAt = block.indexOf('markSnapshotStale()');
    const dirtyAt = block.indexOf('if (!json.auto_update) markCommittedMutationDirtyForAutomaticRecalculation()');
    assert.equal(commitAt >= 0, true);
    assert.equal(dirtyAt > commitAt, true);
    assert.match(block, /if \(json\.auto_update\) handleAutoUpdateSignal/);
  }

  assert.doesNotMatch(add.slice(0, add.indexOf('if (!json?.success)')), /markCommittedMutationDirtyForAutomaticRecalculation/);
});

test('confirmed update marks dirty before record refresh while failed update never reaches dirty path', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const block = blockBetween(source, 'const updateRecord = async', 'const deleteRecord = async');
  const successBoundary = block.indexOf("if (!json?.success)");
  const dirtyAt = block.indexOf('markCommittedMutationDirtyForAutomaticRecalculation()');
  const refreshAt = block.indexOf("refreshRecordsAfterCommittedMutation('更新交易'");

  assert.equal(successBoundary >= 0, true);
  assert.equal(dirtyAt > successBoundary, true);
  assert.equal(refreshAt > dirtyAt, true);
  assert.doesNotMatch(block.slice(0, successBoundary), /markCommittedMutationDirtyForAutomaticRecalculation/);
});

test('delete-all clears automatic state and normal confirmed delete marks dirty before refresh', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const block = blockBetween(source, 'const deleteRecord = async', 'const availableGroups = computed');
  const reloadAt = block.indexOf("if (json.message === 'RELOAD_UI')");
  const clearAt = block.indexOf('clearAutomaticRecalculationForCurrentOwner()', reloadAt);
  const dirtyAt = block.indexOf('markCommittedMutationDirtyForAutomaticRecalculation()', reloadAt);
  const refreshAt = block.indexOf("refreshRecordsAfterCommittedMutation('刪除交易'", dirtyAt);

  assert.equal(reloadAt >= 0, true);
  assert.equal(clearAt > reloadAt, true);
  assert.equal(dirtyAt > clearAt, true);
  assert.equal(refreshAt > dirtyAt, true);
  const reloadBlock = block.slice(reloadAt, dirtyAt);
  assert.doesNotMatch(reloadBlock, /markCommittedMutationDirtyForAutomaticRecalculation/);
});

test('fetchAll resumes dirty work only after records/settings/snapshot read and clears state for an empty portfolio', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const block = blockBetween(source, 'const performFetchAll = async', 'const fetchAll = createSingleFlight');
  const fetchRecordsAt = block.indexOf('await fetchRecords()');
  const snapshotAt = block.indexOf('await fetchSnapshot()');
  const emptyClearAt = block.indexOf('clearAutomaticRecalculationForCurrentOwner()');
  const resumeAt = block.indexOf('resumeAutomaticRecalculation()');

  assert.equal(fetchRecordsAt >= 0, true);
  assert.equal(snapshotAt > fetchRecordsAt, true);
  assert.equal(emptyClearAt > fetchRecordsAt, true);
  assert.equal(resumeAt > emptyClearAt, true);
});

test('trigger captures current dirty generation before POST and only a non-deduplicated job can record coverage', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const block = blockBetween(source, 'const performTriggerUpdate = async', 'const triggerUpdate =');
  const captureAt = block.indexOf('const automaticStatus = readAutomaticRecalculation()');
  const postAt = block.indexOf("fetchWithAuth('/api/trigger-update'");
  const coverageAt = block.indexOf('markAutomaticRecalculationCoverage(');

  assert.equal(captureAt >= 0, true);
  assert.equal(postAt > captureAt, true);
  assert.equal(coverageAt > postAt, true);
  assert.match(block, /generationAtDispatch && responseData\.job\.deduplicated !== true/);
  assert.match(block, /options\.onJob\(responseData\.job, \{/);
  assert.match(block, /coverageRecorded/);
});

test('manual trigger API stays compatible and current selected benchmark is used by automatic flush', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /const triggerUpdate = \(benchmark = null, options = \{\}\) =>/);
  const flush = blockBetween(source, 'const flushAutomaticRecalculation = async', '\n\n    return {');
  assert.match(flush, /const benchmark = selectedBenchmark\.value \|\| status\.generation\.benchmark/);
  assert.match(flush, /triggerUpdate\(benchmark, \{/);
  assert.match(flush, /automatic: true/);
});

test('flush is single-flight, active-job aware and bounded once per dirty token without retry loops', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const flush = blockBetween(source, 'const flushAutomaticRecalculation = async', '\n\n    return {');
  const activeAt = flush.indexOf('if (hasActiveCalculationIntent()) return false');
  const tokenGuardAt = flush.indexOf('lastAutomaticRecalculationAttemptToken === status.generation.token');
  const tokenSetAt = flush.indexOf('lastAutomaticRecalculationAttemptToken = status.generation.token');

  assert.match(flush, /if \(automaticRecalculationPromise\) return automaticRecalculationPromise/);
  assert.equal(activeAt >= 0, true);
  assert.equal(tokenGuardAt > activeAt, true);
  assert.equal(tokenSetAt > tokenGuardAt, true);
  assert.match(flush, /job\?\.deduplicated === true \|\| metadata\?\.coverageRecorded !== true/);
  assert.match(flush, /lastAutomaticRecalculationAttemptToken = null/);
  assert.doesNotMatch(flush, /while\s*\(/);
  assert.doesNotMatch(flush, /setInterval/);
});

test('successful job settles exact coverage before fresh data load and only residual dirtiness schedules follow-up', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const block = blockBetween(source, 'const completeCalculationJob = async', 'const pollCalculationJobOnce');
  const settleAt = block.indexOf('settleAutomaticRecalculationJob(');
  const followupAt = block.indexOf('if (automaticStatus?.dirty) scheduleAutomaticRecalculationFlush()');
  const fetchAt = block.indexOf('await fetchAllFresh()');

  assert.equal(settleAt >= 0, true);
  assert.equal(followupAt > settleAt, true);
  assert.equal(fetchAt > followupAt, true);
  assert.match(block, /succeeded: job\.status === 'succeeded'/);
});

test('missing job releases coverage without pretending success and leaves bounded recovery possible', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const block = blockBetween(source, 'const pollCalculationJobOnce', 'const startCalculationJobPolling');
  const notFoundAt = block.indexOf('if (error?.status === 404)');
  const settleAt = block.indexOf('settleAutomaticRecalculationJob(', notFoundAt);
  const falseAt = block.indexOf('{ succeeded: false }', settleAt);
  const scheduleAt = block.indexOf('scheduleAutomaticRecalculationFlush()', falseAt);

  assert.equal(notFoundAt >= 0, true);
  assert.equal(settleAt > notFoundAt, true);
  assert.equal(falseAt > settleAt, true);
  assert.equal(scheduleAt > falseAt, true);
});

test('a new committed mutation resets prior failed-attempt bound and debounce coalesces burst mutations', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const mark = blockBetween(source, 'const markCommittedMutationDirtyForAutomaticRecalculation', 'const clearAutomaticRecalculationForCurrentOwner');
  const schedule = blockBetween(source, 'const scheduleAutomaticRecalculationFlush', 'const markCommittedMutationDirtyForAutomaticRecalculation');

  assert.match(mark, /markAutomaticRecalculationDirty/);
  assert.match(mark, /lastAutomaticRecalculationAttemptToken = null/);
  assert.match(mark, /scheduleAutomaticRecalculationFlush\(\)/);
  assert.match(schedule, /cancelAutomaticRecalculationTimer\(\)/);
  assert.match(schedule, /setTimeout/);
});
