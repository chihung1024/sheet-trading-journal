<template>
  <div class="card">
    <div class="card-header">
        <div class="header-left">
            <h3>持倉明細</h3>
            <div class="summary-info">
                市值總計: <strong>{{ formatNumber(totalMarketValue) }}</strong> TWD
            </div>
        </div>

        <div class="header-controls">
            <div class="search-box">
                <span class="search-icon">🔍</span>
                <input
                    type="text"
                    v-model="searchQuery"
                    placeholder="搜尋股票代碼..."
                    class="search-input"
                    aria-label="搜尋持倉代碼"
                >
            </div>

            <div class="filter-group">
                <select v-model="filterStatus" class="filter-select" aria-label="持倉損益篩選">
                    <option value="all">全部持倉</option>
                    <option value="profit">獲利中</option>
                    <option value="loss">虧損中</option>
                </select>
            </div>
        </div>
    </div>

    <section
        v-if="concentration.status === 'ok'"
        class="concentration-panel"
        aria-label="持倉集中度決策快照"
    >
        <div class="concentration-header">
            <div>
                <span class="concentration-eyebrow">Portfolio Decision Support</span>
                <h4>持倉集中度</h4>
            </div>
            <span class="group-scope">{{ concentrationGroupLabel }}</span>
        </div>

        <div class="concentration-content">
            <div class="concentration-metrics">
                <div class="concentration-metric">
                    <span class="metric-label">最大持倉</span>
                    <strong>{{ concentration.largest.symbol }}</strong>
                    <span class="metric-value">{{ formatPercent(concentration.largest.weight) }}</span>
                </div>
                <div class="concentration-metric">
                    <span class="metric-label">前 3 大合計</span>
                    <strong>{{ formatPercent(concentration.top3Weight) }}</strong>
                    <span class="metric-caption">目前群組持倉市值</span>
                </div>
                <div class="concentration-metric">
                    <span class="metric-label">正市值持倉</span>
                    <strong>{{ concentration.positionCount }} 檔</strong>
                    <span class="metric-caption">不含零市值列</span>
                </div>
            </div>

            <PortfolioAllocationDonut :snapshot="concentration" />

            <div class="concentration-list" aria-label="主要持倉權重">
                <div v-for="position in concentration.topPositions" :key="position.symbol" class="concentration-row">
                    <div class="concentration-line">
                        <span class="position-symbol">{{ position.symbol }}</span>
                        <span class="position-weight">{{ formatPercent(position.weight) }}</span>
                    </div>
                    <div class="weight-track" aria-hidden="true">
                        <div class="weight-fill" :style="{ width: `${Math.min(position.weight, 100)}%` }"></div>
                    </div>
                </div>
            </div>
        </div>

        <p class="concentration-note">
            僅反映目前群組已發布持倉的 TWD 市值比例，不含現金；這是集中度事實呈現，不是風險評級、目標配置或買賣建議。
        </p>
    </section>

    <div v-else-if="concentration.status === 'unavailable'" class="concentration-unavailable" role="status">
        <strong>集中度暫不顯示</strong>
        <span>持倉市值與摘要總值目前無法一致對帳，系統不猜測權重。</span>
    </div>

    <div class="table-container desktop-view" ref="tableContainer">
        <table>
            <thead>
                <tr>
                    <th @click="sortBy('symbol')" class="sortable sticky-th">
                        代碼 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
                    </th>
                    <th @click="sortBy('qty')" class="text-right sortable sticky-th">
                        股數 <span class="sort-icon">{{ getSortIcon('qty') }}</span>
                    </th>
                    <th @click="sortBy('avg_cost_usd')" class="text-right sortable sticky-th">
                        成本(原幣) <span class="sort-icon">{{ getSortIcon('avg_cost_usd') }}</span>
                    </th>
                    <th @click="sortBy('current_price_origin')" class="text-right sortable sticky-th">
                        現價(原幣) <span class="sort-icon">{{ getSortIcon('current_price_origin') }}</span>
                    </th>
                    <th @click="sortBy('daily_change_percent')" class="text-right sortable sticky-th">
                        漲跌幅 <span class="sort-icon">{{ getSortIcon('daily_change_percent') }}</span>
                    </th>
                    <th @click="sortBy('market_value_twd')" class="text-right sortable sticky-th">
                        市值(TWD) <span class="sort-icon">{{ getSortIcon('market_value_twd') }}</span>
                    </th>
                    <th
                        @click="sortBy('weight')"
                        class="text-right sortable sticky-th"
                        title="目前群組已發布持倉市值占比；不含現金"
                    >
                        權重 <span class="sort-icon">{{ getSortIcon('weight') }}</span>
                    </th>
                    <th @click="sortBy('daily_pl_twd')" class="text-right sortable sticky-th">
                        當日損益 <span class="sort-icon">{{ getSortIcon('daily_pl_twd') }}</span>
                    </th>
                    <th @click="sortBy('pnl_twd')" class="text-right sortable sticky-th">
                        總損益 <span class="sort-icon">{{ getSortIcon('pnl_twd') }}</span>
                    </th>
                    <th @click="sortBy('pnl_percent')" class="text-right sortable sticky-th">
                        報酬率 <span class="sort-icon">{{ getSortIcon('pnl_percent') }}</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                 <tr v-if="filteredHoldings.length === 0">
                    <td colspan="10" class="empty-state">
                        <div class="empty-icon">📊</div>
                        <div>目前無持倉數據</div>
                    </td>
                </tr>
                <tr
                    v-for="h in visibleHoldings"
                    :key="h.symbol"
                    class="row-item"
                    @click="highlightRow(h.symbol)"
                    :class="{ 'highlighted': highlightedSymbol === h.symbol }"
                >
                    <td class="col-symbol">
                        <div class="symbol-wrapper">
                            <span class="symbol-text">{{ h.symbol }}</span>
                            <span class="currency-badge">{{ h.currency || 'USD' }}</span>
                            <span class="symbol-badge" v-if="h.pnl_percent > 50">🔥</span>
                        </div>
                    </td>
                    <td class="text-right font-num">{{ formatNumber(h.qty, 2) }}</td>
                    <td class="text-right font-num text-sub">{{ formatNumber(h.avg_cost_usd, 2) }}</td>
                    <td class="text-right font-num">
                        <div>{{ formatNumber(h.current_price_origin, 2) }}</div>
                    </td>
                    <td class="text-right font-num">
                        <div class="price-change" :class="getTrendClass(h.daily_change_usd)">
                            {{ h.daily_change_percent >= 0 ? '+' : '' }}{{ safeNum(h.daily_change_percent) }}%
                        </div>
                        <div class="text-sub">
                            {{ h.daily_change_usd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_change_usd, 2) }}
                        </div>
                    </td>
                    <td class="text-right font-num font-bold">{{ formatNumber(h.market_value_twd, 0) }}</td>
                    <td class="text-right font-num weight-cell">{{ formatHoldingWeight(h) }}</td>
                    <td class="text-right font-num" :class="getTrendClass(h.daily_pl_twd)">
                        {{ h.daily_pl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_pl_twd, 0) }}
                    </td>
                    <td class="text-right font-num" :class="getTrendClass(h.pnl_twd)">
                        {{ h.pnl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.pnl_twd, 0) }}
                    </td>
                    <td class="text-right font-num">
                        <span class="roi-badge" :class="getTrendClass(h.pnl_percent, true)">
                            {{ h.pnl_percent >= 0 ? '+' : '' }}{{ safeNum(h.pnl_percent) }}%
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="mobile-view">
        <div v-if="filteredHoldings.length === 0" class="empty-state">
            <div class="empty-icon">📊</div>
            <div>目前無持倉數據</div>
        </div>

        <div
            v-for="h in visibleHoldings"
            :key="h.symbol + '_mob'"
            class="mobile-card"
            @click="highlightRow(h.symbol)"
        >
            <div class="m-card-header">
                <div class="m-symbol-group">
                    <span class="m-symbol">{{ h.symbol }}</span>
                    <span class="currency-badge">{{ h.currency || 'USD' }}</span>
                    <span v-if="concentration.status === 'ok'" class="weight-badge">{{ formatHoldingWeight(h) }}</span>
                    <span class="m-fire" v-if="h.pnl_percent > 50">🔥</span>
                </div>
                <div class="m-price-group">
                    <span class="m-price">{{ formatNumber(h.current_price_origin, 2) }} {{ h.currency || 'USD' }}</span>
                    <span class="m-change" :class="getTrendClass(h.daily_change_usd)">
                         {{ h.daily_change_percent >= 0 ? '+' : '' }}{{ safeNum(h.daily_change_percent) }}%
                    </span>
                </div>
            </div>

            <div class="m-card-grid">
                <div class="m-grid-item">
                    <span class="m-label">持有股數</span>
                    <span class="m-val">{{ formatNumber(h.qty, 2) }}</span>
                </div>
                <div class="m-grid-item text-right">
                    <span class="m-label">平均成本（原幣）</span>
                    <span class="m-val">{{ formatNumber(h.avg_cost_usd, 2) }} {{ h.currency || 'USD' }}</span>
                </div>
                <div class="m-grid-item">
                    <span class="m-label">台幣市值</span>
                    <span class="m-val font-bold">{{ formatNumber(h.market_value_twd, 0) }}</span>
                </div>
                <div class="m-grid-item text-right">
                    <span class="m-label">總報酬率</span>
                    <span class="m-badge-sm" :class="getTrendClass(h.pnl_percent, true)">
                        {{ h.pnl_percent >= 0 ? '+' : '' }}{{ safeNum(h.pnl_percent) }}%
                    </span>
                </div>
            </div>

            <div class="m-card-footer">
                <div class="m-footer-item">
                    <span class="m-footer-label">當日</span>
                    <span class="m-footer-val" :class="getTrendClass(h.daily_pl_twd)">
                        {{ h.daily_pl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_pl_twd, 0) }}
                    </span>
                </div>
                <div class="m-divider"></div>
                <div class="m-footer-item right">
                    <span class="m-footer-label">總損益</span>
                    <span class="m-footer-val" :class="getTrendClass(h.pnl_twd)">
                        {{ h.pnl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.pnl_twd, 0) }}
                    </span>
                </div>
            </div>
        </div>
    </div>

    <div class="scroll-hint" v-if="filteredHoldings.length > displayLimit">
        顯示 {{ visibleHoldings.length }} / {{ filteredHoldings.length }} 筆
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import PortfolioAllocationDonut from './PortfolioAllocationDonut.vue';
import {
    buildPortfolioConcentrationSnapshot,
    getHoldingWeight,
} from '../services/portfolioConcentration.js';

const store = usePortfolioStore();
const tableContainer = ref(null);
const sortKey = ref('market_value_twd');
const sortOrder = ref('desc');
const searchQuery = ref('');
const filterStatus = ref('all');
const highlightedSymbol = ref(null);
const displayLimit = ref(50);

const safeNum = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    return Number(val).toFixed(2);
};

const formatNumber = (num, d=0) => {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const formatPercent = value => `${Number(value || 0).toFixed(2)}%`;

const totalMarketValue = computed(() => {
    return store.holdings.reduce((sum, h) => sum + (Number(h.market_value_twd) || 0), 0);
});

const concentration = computed(() => buildPortfolioConcentrationSnapshot(
    store.holdings,
    store.stats.total_value,
));

const concentrationGroupLabel = computed(() => (
    store.currentGroup === 'all' ? '全部持倉' : `策略：${store.currentGroup}`
));

const formatHoldingWeight = holding => {
    const weight = getHoldingWeight(concentration.value, holding?.symbol);
    return weight == null ? '--' : formatPercent(weight);
};

const filteredHoldings = computed(() => {
    let result = store.holdings;

    if (searchQuery.value) {
        result = result.filter(h =>
            h.symbol.toLowerCase().includes(searchQuery.value.toLowerCase())
        );
    }

    if (filterStatus.value === 'profit') {
        result = result.filter(h => (h.pnl_twd || 0) > 0);
    } else if (filterStatus.value === 'loss') {
        result = result.filter(h => (h.pnl_twd || 0) < 0);
    }

    return [...result].sort((a, b) => {
        let valA;
        let valB;
        if (sortKey.value === 'weight') {
            valA = getHoldingWeight(concentration.value, a.symbol);
            valB = getHoldingWeight(concentration.value, b.symbol);
        } else {
            valA = a[sortKey.value];
            valB = b[sortKey.value];
        }
        if (typeof valA === 'string') {
            return sortOrder.value === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
});

const visibleHoldings = computed(() => {
    if (filteredHoldings.value.length <= displayLimit.value) {
        return filteredHoldings.value;
    }
    return filteredHoldings.value.slice(0, displayLimit.value);
});

const sortBy = (key) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'desc';
    }
};

const getSortIcon = (key) => {
    if (sortKey.value !== key) return '⇕';
    return sortOrder.value === 'asc' ? '↑' : '↓';
};

const getTrendClass = (val, isBg = false) => {
    const num = Number(val) || 0;
    if (num >= 0) return isBg ? 'bg-green' : 'text-green';
    return isBg ? 'bg-red' : 'text-red';
};

const highlightRow = (symbol) => {
    highlightedSymbol.value = symbol;
    setTimeout(() => {
        highlightedSymbol.value = null;
    }, 2000);
};

const handleScroll = () => {
    if (tableContainer.value) {
        const { scrollTop: top, scrollHeight, clientHeight } = tableContainer.value;
        if (scrollHeight - top - clientHeight < 100 && displayLimit.value < filteredHoldings.value.length) {
            displayLimit.value = Math.min(displayLimit.value + 20, filteredHoldings.value.length);
        }
    }
    if (window.innerWidth < 768 && (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
         if (displayLimit.value < filteredHoldings.value.length) {
            displayLimit.value = Math.min(displayLimit.value + 20, filteredHoldings.value.length);
         }
    }
};

onMounted(() => {
    if (tableContainer.value) {
        tableContainer.value.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
    if (tableContainer.value) {
        tableContainer.value.removeEventListener('scroll', handleScroll);
    }
    window.removeEventListener('scroll', handleScroll);
});
</script>

<style scoped>
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
    gap: 16px;
}
.header-left { display: flex; flex-direction: column; gap: 8px; }
.header-controls { display: flex; gap: 12px; align-items: center; }

h3 { margin: 0; font-size: 1.125rem; }

.summary-info {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.95rem;
    background: var(--bg-secondary);
    padding: 6px 12px;
    border-radius: 6px;
    color: var(--text-main);
    border: 1px solid var(--border-color);
    display: inline-block;
}

.concentration-panel { margin: 0 0 18px; padding: 16px 18px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-secondary); }
.concentration-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.concentration-eyebrow { display: block; margin-bottom: 3px; color: var(--text-sub); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.concentration-header h4 { margin: 0; color: var(--text-main); font-size: 1rem; }
.group-scope { padding: 4px 9px; border-radius: 999px; background: var(--bg-card); color: var(--text-sub); border: 1px solid var(--border-color); font-size: 0.72rem; font-weight: 650; }
.concentration-content { display: grid; grid-template-columns: minmax(230px, 0.85fr) minmax(280px, 0.95fr) minmax(300px, 1.2fr); gap: 14px; align-items: start; }
.concentration-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; align-content: start; }
.concentration-metric { min-width: 0; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); }
.metric-label, .metric-caption { display: block; color: var(--text-sub); font-size: 0.68rem; }
.concentration-metric strong { display: block; margin: 4px 0 2px; color: var(--text-main); font-size: 0.95rem; overflow-wrap: anywhere; }
.metric-value { color: var(--primary); font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; font-weight: 700; }
.concentration-list { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 8px 4px; }
.concentration-line { display: flex; justify-content: space-between; gap: 10px; font-size: 0.78rem; }
.position-symbol { color: var(--text-main); font-family: 'JetBrains Mono', monospace; font-weight: 700; }
.position-weight { color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.weight-track { height: 5px; overflow: hidden; border-radius: 999px; background: var(--bg-card); }
.weight-fill { height: 100%; border-radius: inherit; background: var(--primary); }
.concentration-note { margin: 12px 0 0; color: var(--text-sub); font-size: 0.72rem; line-height: 1.5; }
.concentration-unavailable { display: flex; flex-direction: column; gap: 4px; margin: 0 0 18px; padding: 12px 14px; border-radius: 8px; background: var(--bg-secondary); color: var(--text-sub); font-size: 0.8rem; }
.concentration-unavailable strong { color: var(--warning); }

.search-box { position: relative; width: 220px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-sub); pointer-events: none; }
.search-input { width: 100%; box-sizing: border-box; padding: 8px 10px 8px 32px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--bg-secondary); color: var(--text-main); }
.search-input:focus { outline: none; border-color: var(--primary); background: var(--bg-card); }

.filter-select { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-main); font-size: 0.95rem; cursor: pointer; }

.table-container { overflow-x: auto; max-height: 600px; overflow-y: auto; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { text-align: left; padding: 12px 16px; border-bottom: 2px solid var(--border-color); color: var(--text-sub); font-size: 0.85rem; font-weight: 600; background: var(--bg-card); z-index: 10; white-space: nowrap; }
.sticky-th { position: sticky; top: 0; }
td { padding: 14px 16px; border-bottom: 1px solid var(--border-color); font-size: 0.95rem; }
.row-item { transition: background 0.2s; cursor: pointer; }
.row-item:hover { background-color: var(--bg-secondary); }

.symbol-text { font-weight: 700; color: var(--primary); font-family: 'JetBrains Mono', monospace; }
.symbol-badge { margin-left: 6px; font-size: 0.8rem; }
.currency-badge { margin-left: 6px; padding: 2px 5px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; background: var(--bg-secondary); color: var(--text-sub); border: 1px solid var(--border-color); vertical-align: middle; }
.weight-badge { margin-left: 6px; padding: 2px 6px; border-radius: 999px; font-size: 0.68rem; font-weight: 700; background: rgba(59, 130, 246, 0.1); color: var(--primary); border: 1px solid rgba(59, 130, 246, 0.2); }
.weight-cell { color: var(--primary); font-weight: 700; }
.price-change { font-size: 0.85rem; margin-top: 2px; }

.text-right { text-align: right; }
.text-sub { color: var(--text-sub); }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }
.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.bg-green { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
.bg-red { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); }

.roi-badge { padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.85rem; display: inline-block; min-width: 68px; text-align: center; }

.mobile-view { display: none; }

.mobile-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    transition: transform 0.2s;
}
.mobile-card:active { transform: scale(0.98); background: var(--bg-secondary); }

.m-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); }
.m-symbol { font-size: 1.2rem; font-weight: 700; color: var(--primary); font-family: 'JetBrains Mono', monospace; }
.m-price-group { text-align: right; }
.m-price { display: block; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; }
.m-change { font-size: 0.85rem; font-weight: 500; }

.m-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.m-grid-item { display: flex; flex-direction: column; }
.m-label { font-size: 0.75rem; color: var(--text-sub); margin-bottom: 2px; }
.m-val { font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; color: var(--text-main); }
.m-badge-sm { font-size: 0.85rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-block; }

.m-card-footer { background: var(--bg-secondary); margin: 0 -16px -16px -16px; padding: 10px 16px; border-radius: 0 0 12px 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); }
.m-footer-item { display: flex; align-items: baseline; gap: 6px; }
.m-footer-item.right { flex-direction: row-reverse; }
.m-footer-label { font-size: 0.8rem; color: var(--text-sub); }
.m-footer-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 1rem; }
.m-divider { width: 1px; height: 16px; background: var(--border-color); }

.scroll-hint { text-align: center; padding: 12px; font-size: 0.9rem; color: var(--text-sub); }
.empty-state { text-align: center; padding: 40px; color: var(--text-sub); }
.empty-icon { font-size: 2.5rem; margin-bottom: 8px; opacity: 0.5; }

@media (max-width: 1250px) {
    .concentration-content { grid-template-columns: minmax(250px, 1fr) minmax(280px, 1fr); }
    .concentration-list { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 18px; }
}

@media (max-width: 900px) {
    .concentration-content { grid-template-columns: 1fr; }
    .concentration-list { grid-column: auto; display: flex; }
}

@media (max-width: 768px) {
    .desktop-view { display: none; }
    .mobile-view { display: block; }

    .card-header { flex-direction: column; align-items: stretch; gap: 12px; }
    .header-left { flex-direction: row; justify-content: space-between; align-items: center; }
    .summary-info { font-size: 0.85rem; padding: 4px 8px; margin: 0; }
    .header-controls { flex-direction: column; width: 100%; }
    .search-box { width: 100%; }
    .filter-select { width: 100%; }
    .concentration-header { flex-direction: column; gap: 7px; }
    .concentration-metrics { grid-template-columns: 1fr; }
}
</style>