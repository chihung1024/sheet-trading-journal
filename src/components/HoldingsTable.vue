<template>
  <div class="card">
    <h3>持倉明細</h3>
    <div class="table-responsive">
        <table>
            <thead>
                <tr>
                    <th>代碼</th>
                    <th class="text-right">股數</th>
                    <th class="text-right">平均成本</th>
                    <th class="text-right">現價</th>
                    <th class="text-right">市值 (TWD)</th>
                    <th class="text-right">損益 (TWD)</th>
                    <th class="text-right">報酬率</th>
                </tr>
            </thead>
            <tbody>
                 <tr v-if="store.holdings.length === 0">
                    <td colspan="7" class="empty-state">無持倉數據</td>
                </tr>
                <tr v-for="h in store.holdings" :key="h.symbol">
                    <td><strong>{{ h.symbol }}</strong></td>
                    <td class="text-right font-mono">{{ formatNumber(h.qty, 2) }}</td>
                    <td class="text-right font-mono">{{ formatNumber(h.avg_cost_usd, 2) }}</td>
                    <td class="text-right font-mono">{{ formatNumber(h.current_price_origin, 2) }}</td>
                    <td class="text-right font-mono font-bold">{{ formatNumber(h.market_value_twd, 0) }}</td>
                    <td class="text-right font-mono" :class="h.pnl_twd >= 0 ? 'text-green' : 'text-red'">
                        {{ formatNumber(h.pnl_twd, 0) }}
                    </td>
                    <td class="text-right font-mono" :class="h.pnl_percent >= 0 ? 'text-green' : 'text-red'">
                        {{ h.pnl_percent }}%
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
  </div>
</template>

<script setup>
import { usePortfolioStore } from '../stores/portfolio';
const store = usePortfolioStore();
const formatNumber = (num, d=0) => Number(num||0).toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
</script>

<style scoped>
.table-responsive { overflow-x: auto; }
.text-right { text-align: right; }
.font-mono { font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; }
.font-bold { font-weight: 700; }
.empty-state { text-align: center; color: var(--text-light); padding: 24px; }
</style>
