import test from 'node:test';
import assert from 'node:assert/strict';

import {
    benchmarkLegendLabel,
    DEFAULT_BENCHMARK_SYMBOL,
    normalizeBenchmarkSymbol,
    readPublishedBenchmark,
    resolveBenchmarkApplicationState,
} from '../src/services/benchmarkState.js';

test('benchmark symbols normalize to the Worker-compatible uppercase alphabet', () => {
    assert.equal(normalizeBenchmarkSymbol(' spy '), 'SPY');
    assert.equal(normalizeBenchmarkSymbol('^gspc'), '^GSPC');
    assert.equal(normalizeBenchmarkSymbol('brk-b'), 'BRK-B');
    assert.equal(normalizeBenchmarkSymbol('EURUSD=X'), 'EURUSD=X');
    assert.equal(normalizeBenchmarkSymbol(''), null);
    assert.equal(normalizeBenchmarkSymbol('bad symbol'), null);
    assert.equal(normalizeBenchmarkSymbol('A'.repeat(25)), null);
    assert.equal(normalizeBenchmarkSymbol(null, { fallback: 'SPY' }), 'SPY');
});

test('published benchmark is read only from snapshot provenance', () => {
    assert.equal(readPublishedBenchmark({ benchmark_symbol: ' qqq ' }), 'QQQ');
    assert.equal(readPublishedBenchmark({ settings: { benchmark: 'SPY' } }), null);
    assert.equal(readPublishedBenchmark({ benchmark_symbol: 'bad symbol' }), null);
    assert.equal(readPublishedBenchmark(null), null);
});

test('matching requested and published identities are applied', () => {
    const state = resolveBenchmarkApplicationState({
        snapshot: { benchmark_symbol: 'SPY' },
        requestedBenchmark: 'spy',
    });
    assert.deepEqual(state, {
        status: 'applied',
        publishedBenchmark: 'SPY',
        requestedBenchmark: 'SPY',
        publishedLabel: 'SPY',
        statusText: '已套用：SPY',
    });
    assert.equal(benchmarkLegendLabel(state), '基準 (SPY)');
});

test('a newer requested setting remains pending without relabeling published history', () => {
    const state = resolveBenchmarkApplicationState({
        snapshot: { benchmark_symbol: 'SPY' },
        requestedBenchmark: 'QQQ',
    });
    assert.equal(state.status, 'pending');
    assert.equal(state.publishedBenchmark, 'SPY');
    assert.equal(state.requestedBenchmark, 'QQQ');
    assert.equal(state.publishedLabel, 'SPY');
    assert.equal(state.statusText, '待計算套用：QQQ；目前圖表：SPY');
    assert.equal(benchmarkLegendLabel(state), '基準 (SPY)');
});

test('legacy or invalid snapshot provenance is explicit and never inferred from settings', () => {
    for (const snapshot of [
        {},
        { settings: { benchmark: 'QQQ' } },
        { benchmark_symbol: '' },
        { benchmark_symbol: 'not valid' },
    ]) {
        const state = resolveBenchmarkApplicationState({
            snapshot,
            requestedBenchmark: 'QQQ',
        });
        assert.equal(state.status, 'unknown');
        assert.equal(state.publishedBenchmark, null);
        assert.equal(state.requestedBenchmark, 'QQQ');
        assert.equal(state.publishedLabel, '身分未知');
        assert.match(state.statusText, /舊快照未記錄基準身分/);
        assert.equal(benchmarkLegendLabel(state), '基準 (身分未知)');
    }
});

test('requested fallback aligns with the runner and user-settings default SPY', () => {
    assert.equal(DEFAULT_BENCHMARK_SYMBOL, 'SPY');
    const state = resolveBenchmarkApplicationState({ snapshot: {} });
    assert.equal(state.requestedBenchmark, 'SPY');
    assert.equal(state.status, 'unknown');

    const customFallback = resolveBenchmarkApplicationState({
        snapshot: { benchmark_symbol: 'VT' },
        requestedBenchmark: 'bad symbol',
        fallbackRequestedBenchmark: 'vt',
    });
    assert.equal(customFallback.requestedBenchmark, 'VT');
    assert.equal(customFallback.status, 'applied');
});
