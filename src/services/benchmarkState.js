export const DEFAULT_BENCHMARK_SYMBOL = 'SPY';
export const UNKNOWN_BENCHMARK_LABEL = '身分未知';

const BENCHMARK_SYMBOL_RE = /^[A-Z0-9.^=\-]{1,24}$/;

export const normalizeBenchmarkSymbol = (
    value,
    { fallback = null } = {},
) => {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim().toUpperCase();
    return BENCHMARK_SYMBOL_RE.test(normalized) ? normalized : fallback;
};

export const readPublishedBenchmark = (snapshot) => (
    normalizeBenchmarkSymbol(snapshot?.benchmark_symbol)
);

export const resolveBenchmarkApplicationState = ({
    snapshot,
    requestedBenchmark,
    fallbackRequestedBenchmark = DEFAULT_BENCHMARK_SYMBOL,
} = {}) => {
    const publishedBenchmark = readPublishedBenchmark(snapshot);
    const requested = normalizeBenchmarkSymbol(requestedBenchmark, {
        fallback: normalizeBenchmarkSymbol(fallbackRequestedBenchmark, {
            fallback: DEFAULT_BENCHMARK_SYMBOL,
        }),
    });

    if (!publishedBenchmark) {
        return {
            status: 'unknown',
            publishedBenchmark: null,
            requestedBenchmark: requested,
            publishedLabel: UNKNOWN_BENCHMARK_LABEL,
            statusText: `舊快照未記錄基準身分；重新計算後才能確認。目前要求：${requested}`,
        };
    }

    if (publishedBenchmark === requested) {
        return {
            status: 'applied',
            publishedBenchmark,
            requestedBenchmark: requested,
            publishedLabel: publishedBenchmark,
            statusText: `已套用：${publishedBenchmark}`,
        };
    }

    return {
        status: 'pending',
        publishedBenchmark,
        requestedBenchmark: requested,
        publishedLabel: publishedBenchmark,
        statusText: `待計算套用：${requested}；目前圖表：${publishedBenchmark}`,
    };
};

export const benchmarkLegendLabel = (state) => (
    `基準 (${state?.publishedLabel || UNKNOWN_BENCHMARK_LABEL})`
);
