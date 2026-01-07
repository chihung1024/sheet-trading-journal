<template>
  <div class="holdings-section card">
    <div class="section-header">
      <h2>持倉明細</h2>
      <span v-if="holdings.length > 0" class="holding-count">{{ holdings.length }} 檔</span>
    </div>

    <!-- 桌面版表格 -->
    <div class="table-wrapper desktop-only">
      <table v-if="holdings.length > 0" class="holdings-table">
        <thead>
          <tr>
            <th>股票代碼</th>
            <th>股數</th>
            <th>平均成本</th>
            <th>現價</th>
            <th>市值</th>
            <th>損益</th>
            <th>報酬率</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(holding, index) in holdings"
            :key="index"
            class="holding-row"
            :style="{ animationDelay: `${index * 50}ms` }"
          >
            <td class="ticker">
              <span class="ticker-code">{{ holding.ticker }}</span>
              <span class="ticker-tag">{{ holding.tag || '未分類' }}</span>
            </td>
            <td>{{ formatNumber(holding.quantity) }}</td>
            <td>{{ formatNumber(holding.cost_basis_usd) }}</td>
            <td>{{ formatNumber(holding.current_price) }}</td>
            <td class="market-value">
              {{ formatNumber(holding.market_value_twd) }}
            </td>
            <td :class="['pnl', holding.unrealized_pnl >= 0 ? 'gain' : 'loss']">
              {{ holding.unrealized_pnl >= 0 ? '+' : '' }}{{ formatNumber(holding.unrealized_pnl) }}
            </td>
            <td :class="['return-rate', holding.return_rate >= 0 ? 'gain' : 'loss']">
              {{ holding.return_rate >= 0 ? '+' : '' }}{{ holding.return_rate.toFixed(2) }}%
            </td>
            <td class="actions">
              <button class="action-btn" @click="handleEdit(holding)" title="編輯">✎</button>
              <button
                class="action-btn danger"
                @click="handleDelete(holding)"
                title="刪除"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty-state">
        <div class="empty-icon">📭</div>
        <p>還未建立持倉</p>
      </div>
    </div>

    <!-- 移動版卡片 -->
    <div class="mobile-only">
      <div v-if="holdings.length > 0" class="holdings-cards">
        <div
          v-for="(holding, index) in holdings"
          :key="index"
          class="holding-card"
          :style="{ animationDelay: `${index * 50}ms` }"
        >
          <div class="card-header">
            <div class="ticker-info">
              <div class="ticker-name">{{ holding.ticker }}</div>
              <div class="ticker-tag">{{ holding.tag || '未分類' }}</div>
            </div>
            <div class="card-actions">
              <button class="action-btn" @click="handleEdit(holding)">✎</button>
              <button class="action-btn danger" @click="handleDelete(holding)">🗑️</button>
            </div>
          </div>

          <div class="card-body">
            <div class="card-row">
              <span class="label">股數</span>
              <span class="value">{{ formatNumber(holding.quantity) }}</span>
            </div>
            <div class="card-row">
              <span class="label">平均成本</span>
              <span class="value">{{ formatNumber(holding.cost_basis_usd) }}</span>
            </div>
            <div class="card-row">
              <span class="label">現價</span>
              <span class="value">{{ formatNumber(holding.current_price) }}</span>
            </div>
            <div class="card-row">
              <span class="label">市值</span>
              <span class="value text-primary">
                {{ formatNumber(holding.market_value_twd) }}
              </span>
            </div>
          </div>

          <div class="card-footer">
            <div class="stat">
              <span class="label">損益</span>
              <span
                :class="['value', holding.unrealized_pnl >= 0 ? 'text-success' : 'text-error']"
              >
                {{ holding.unrealized_pnl >= 0 ? '+' : '' }}{{ formatNumber(holding.unrealized_pnl) }}
              </span>
            </div>
            <div class="stat">
              <span class="label">報酬率</span>
              <span
                :class="['value', holding.return_rate >= 0 ? 'text-success' : 'text-error']"
              >
                {{ holding.return_rate >= 0 ? '+' : '' }}{{ holding.return_rate.toFixed(2) }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <div class="empty-icon">📭</div>
        <p>還未建立持倉</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useDialogStore } from '../stores/dialog';
import { useToastStore } from '../stores/toast';

const store = usePortfolioStore();
const dialogStore = useDialogStore();
const toastStore = useToastStore();

const holdings = computed(() => store.holdings || []);

const formatNumber = (num) => {
  if (num === undefined || num === null) return '-';
  return Number(num).toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const handleEdit = (holding) => {
  // 觸發編輯事件
  console.log('Edit holding:', holding);
  toastStore.info(`編輯 ${holding.ticker}`);
};

const handleDelete = (holding) => {
  dialogStore.openConfirm({
    title: '刪除持倉',
    message: `確認刪除 ${holding.ticker} 的持倉記錄嗎？此操作無法撤銷。`,
    confirmText: '刪除',
    cancelText: '取消',
    isDangerous: true,
    onConfirm: async () => {
      // 執行刪除邏輯
      toastStore.success(`已刪除 ${holding.ticker} 的持倉`);
    },
  });
};
</script>

<style scoped>
.holdings-section {
  animation: fadeInUp 500ms var(--easing-ease-out) 300ms both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
}

.section-header h2 {
  font-size: 1.5rem;
  margin: 0;
}

.holding-count {
  background: var(--primary);
  color: white;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 600;
}

/* 桌面版 */
.desktop-only {
  display: block;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }
}

.table-wrapper {
  overflow-x: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}

.holdings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.holdings-table thead {
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: 10;
}

.holdings-table th {
  padding: 12px 10px;
  text-align: right;
  font-weight: 600;
  color: var(--text-muted);
  font-size: 0.85rem;
  letter-spacing: 0.5px;
}

.holdings-table th:first-child {
  text-align: left;
}

.holdings-table tbody tr {
  border-bottom: 1px solid var(--border);
  animation: fadeIn 400ms var(--easing-ease-out) both;
  transition: all 200ms ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.holdings-table tbody tr:hover {
  background: var(--bg-secondary);
  box-shadow: inset 0 0 8px rgba(31, 110, 251, 0.1);
}

.holdings-table td {
  padding: 12px 10px;
  text-align: right;
  color: var(--text-secondary);
}

.holdings-table td:first-child {
  text-align: left;
}

.ticker {
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ticker-code {
  color: var(--primary);
  font-size: 1rem;
}

.ticker-tag {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 4px;
  width: fit-content;
}

.market-value {
  color: var(--text);
  font-weight: 600;
}

.pnl,
.return-rate {
  font-weight: 600;
}

.pnl.gain,
.return-rate.gain {
  color: var(--success-light);
}

.pnl.loss,
.return-rate.loss {
  color: var(--error-light);
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 4px 8px;
  transition: transform 200ms ease;
  color: var(--text-secondary);
}

.action-btn:hover {
  transform: scale(1.2);
  color: var(--primary);
}

.action-btn.danger:hover {
  color: var(--error-light);
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--text-muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--space-md);
}

.empty-state p {
  margin: 0;
  font-size: 1.1rem;
}

/* 移動版 */
.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .mobile-only {
    display: block;
  }
}

.holdings-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.holding-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  animation: fadeInUp 400ms var(--easing-ease-out) both;
  transition: all 200ms ease;
}

.holding-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  border-bottom: 1px solid var(--border);
}

.ticker-info {
  flex: 1;
}

.ticker-name {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--primary);
}

.ticker-tag {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.card-body {
  padding: var(--space-md);
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
}

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.card-row .label {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.card-row .value {
  font-weight: 600;
  color: var(--text);
}

.card-footer {
  padding: var(--space-md);
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-around;
}

.stat {
  text-align: center;
}

.stat .label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.stat .value {
  font-weight: 700;
  color: var(--text);
  font-size: 1rem;
}
</style>
