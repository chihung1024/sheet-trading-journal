import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('PerformanceChart labels benchmark history only from published snapshot provenance', async () => {
    const component = await read('src/components/PerformanceChart.vue');
    const stateService = await read('src/services/benchmarkState.js');

    assert.match(component, /resolveBenchmarkApplicationState/);
    assert.match(component, /snapshot: portfolioStore\.rawData/);
    assert.match(component, /requestedBenchmark: portfolioStore\.selectedBenchmark/);
    assert.match(component, /label: publishedBenchmarkLegend\.value/);
    assert.doesNotMatch(component, /label: `基準 \(\$\{portfolioStore\.selectedBenchmark\}\)`/);
    assert.match(component, /benchmark-status/);
    assert.match(component, /benchmarkApplicationState\.statusText/);

    // The state service owns legacy/pending wording; the component renders that state.
    assert.match(stateService, /舊快照未記錄基準身分/);
    assert.match(stateService, /待計算套用/);
});

test('benchmark input is local and server-confirmed requested state remains separate', async () => {
    const source = await read('src/components/PerformanceChart.vue');

    assert.match(source, /const benchmarkInput = ref\(portfolioStore\.selectedBenchmark\)/);
    assert.match(source, /v-model="benchmarkInput"/);
    assert.doesNotMatch(source, /v-model="portfolioStore\.selectedBenchmark"/);
    assert.match(source, /await portfolioStore\.triggerUpdate\(newBenchmark\)/);
    assert.match(source, /benchmarkInput\.value = portfolioStore\.selectedBenchmark/);
    assert.match(source, /normalizedBenchmarkInput === portfolioStore\.selectedBenchmark/);
});

test('SPY is the aligned default and remains available as a suggested input', async () => {
    const component = await read('src/components/PerformanceChart.vue');
    const service = await read('src/services/benchmarkState.js');
    const store = await read('src/stores/portfolio.js');

    assert.match(component, /const benchmarkSuggestions = \['SPY'/);
    assert.match(component, /placeholder="SPY"/);
    assert.match(service, /DEFAULT_BENCHMARK_SYMBOL = 'SPY'/);
    assert.match(store, /localStorage\.getItem\('user_benchmark'\) \|\| 'SPY'/);
    assert.doesNotMatch(store, /\|\| '\^GSPC'/);
});

test('portfolio store reads requested benchmark explicitly and never infers published identity from settings', async () => {
    const source = await read('src/stores/portfolio.js');

    assert.match(source, /const fetchSettings = async/);
    assert.match(source, /apiFetch\('\/api\/user-settings'/);
    assert.match(source, /selectedBenchmark\.value = data\.benchmark/);
    assert.match(source, /Promise\.all\(\[fetchPortfolio\(\), fetchRecords\(\), fetchSettings\(\)\]\)/);
    assert.doesNotMatch(source, /snapshot\.settings\?\.benchmark/);
    assert.doesNotMatch(source, /rawData\.value\.settings\?\.benchmark/);
});

test('requested state changes only after explicit settings success', async () => {
    const source = await read('src/stores/portfolio.js');
    const start = source.indexOf('const performTriggerUpdate');
    const end = source.indexOf('const triggerUpdate', start);
    assert.ok(start >= 0 && end > start);
    const block = source.slice(start, end);

    const requestIndex = block.indexOf("await apiFetch('/api/user-settings'");
    const publishRequestedIndex = block.indexOf('selectedBenchmark.value = benchmark');
    const localCacheIndex = block.indexOf("localStorage.setItem('user_benchmark', benchmark)");
    assert.ok(requestIndex >= 0);
    assert.ok(publishRequestedIndex > requestIndex);
    assert.ok(localCacheIndex > publishRequestedIndex);
    assert.doesNotMatch(block.slice(0, requestIndex), /selectedBenchmark\.value = benchmark/);
});

test('published benchmark changes redraw TWR labels without mutating the requested control', async () => {
    const source = await read('src/components/PerformanceChart.vue');
    assert.match(source, /watch\(\(\) => portfolioStore\.rawData\?\.benchmark_symbol/);
    assert.match(source, /if \(chartType\.value === 'twr'\)/);
    assert.match(source, /watch\(\(\) => portfolioStore\.selectedBenchmark/);
});
