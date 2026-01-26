<template>
  <div class="card dividend-manager">
    <div class="card-header">
      <div class="header-content">
        <h3>待確認配息</h3>
        <span class="badge-count" v-if="dividends.length > 0">{{ dividends.length }} 筆</span>
      </div>
      <div class="header-actions">
        <button class="btn-refresh" @click="fetchDividends" :disabled="loading" title="重新檢查配息">
          <span :class="{ 'spinning': loading }">↻</span>
        </button>
      </div>
    </div>

    <div class="table-container desktop-view">
      <table v-if="dividends.length > 0">
        <thead>
          <tr>
            <th>日期</th>
            <th>代碼</th>
            <th class="text-right">預估總額 (USD)</th>
            <th class="text-right">預扣稅 (30%)</th>
            <th class="text-right">預估淨額</th>
            <th class="text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="div in dividends" :key="div.id" class="div-row">
            <td class="date-cell">{{ formatDate(div.date) }}</td>
            <td><span class="symbol-badge">{{ div.symbol }}</span></td>
            <td class="text-right font-num">{{ formatNumber(div.amount, 2) }}</td>
            <td class="text-right font-num text-sub">{{ formatNumber(div.tax, 2) }}</td>
            <td class="text-right font-num font-bold text-success">{{ formatNumber(div.amount - div.tax, 2) }}</td>
            <td class="actions-cell">
              <button class="btn-confirm" @click="confirmDividend(div)" :disabled="processingId === div.id">
                {{ processingId === div.id ? '處理中...' : '確認入帳' }}
              </button>
              <button class="btn-delete" @click="deleteDividend(div.id)" :disabled="processingId === div.id">
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-else class="empty-state">
        <div class="empty-icon">🎉</div>
        <p>目前沒有待確認的配息紀錄</p>
      </div>
    </div>

    <div class="mobile-view">
      <div v-if="dividends.length === 0" class="empty-state">
        <div class="empty-icon">🎉</div>
        <p>目前沒有待確認的配息</p>
      </div>

      <div v-else class="mobile-cards">
        <div v-for="div in dividends" :key="'mob_'+div.id" class="div-card">
          <div class="card-top">
            <div class="card-date">{{ formatDate(div.date) }}</div>
            <div class="symbol-badge">{{ div.symbol }}</div>
          </div>
          
          <div class="card-main">
            <div class="amount-row">
              <span class="label">預估淨額</span>
              <span class="value text-success font-num">${{ formatNumber(div.amount - div.tax, 2) }}</span>
            </div>
            <div class="details-row">
              <div class="detail-item">
                <span class="sub-label">總額</span>
                <span class="sub-val">{{ formatNumber(div.amount, 2) }}</span>
              </div>
              <div class="detail-item">
                <span class="sub-label">稅金</span>
                <span class="sub-val">{{ formatNumber(div.tax, 2) }}</span>
              </div>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-card-delete" @click="deleteDividend(div.id)" :disabled="processingId === div.id">
              刪除
            </button>
            <button class="btn-card-confirm" @click="confirmDividend(div)" :disabled="processingId === div.id">
              {{ processingId === div.id ? '處理中...' : '確認入帳' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const { addToast } = useToast();

const loading = ref(false);
const processingId = ref(null);

const dividends = computed(() => store.pending_dividends || []);

const fetchDividends = async () => {
  loading.value = true;
  try {
    // 透過 Store 刷新數據，這會重新抓取 pending_dividends
    await store.fetchAll(); 
    addToast('已刷新配息資訊', 'success');
  } catch (e) {
    addToast('刷新失敗', 'error');
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-TW', {
    month: '2-digit',
    day: '2-digit'
  });
};

const formatNumber = (val, d=2) => {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });
};

const confirmDividend = async (div) => {
  if (!confirm(`確認將 ${div.symbol} 的配息 USD ${formatNumber(div.amount - div.tax)} 入帳嗎？`)) return;
  
  processingId.value = div.id;
  try {
    // 建構正式交易紀錄
    const record = {
      txn_date: div.date,
      symbol: div.symbol,
      txn_type: 'DIV',
      qty: 0,
      price: 0,
      fee: 0, // 手續費
      tax: div.tax,
      total_amount: div.amount, // 總額 (後端會扣除 tax 計算淨額)
      tag: 'Auto-Dividend'
    };

    // 1. 新增交易紀錄
    const success = await store.addRecord(record);
    
    if (success) {
      // 2. 刪除待確認清單中的項目
      // 注意：這裡假設後端 API 有提供刪除 pending_dividend 的端點
      // 如果沒有獨立端點，通常是在 addRecord 後由後端自動處理，
      // 但為了保險起見，前端先模擬移除或呼叫刪除 API
      
      // 模擬：如果後端沒有自動清除 pending，我們手動呼叫刪除
      // 實際專案中，通常入帳後要從 pending 列表中移除
      // 這裡假設需要手動移除 pending 項目
      await fetch(`${CONFIG.API_BASE_URL}/api/pending_dividends?id=${div.id}`, {
        method: 'DELETE',
        headers: { 
            'Authorization': `Bearer ${store.token}`,
        }
      }).catch(err => console.warn('刪除 pending 失敗或 API 不存在', err));

      addToast(`${div.symbol} 配息已入帳`, 'success');
      
      // 3. 刷新數據
      await store.fetchAll();
    }
  } catch (e) {
    console.error(e);
    addToast('入帳失敗', 'error');
  } finally {
    processingId.value = null;
  }
};

const deleteDividend = async (id) => {
  if (!confirm('確定要忽略這筆配息嗎？(將從列表中移除)')) return;
  
  processingId.value = id;
  try {
    // 呼叫後端刪除 API
    // 假設 API 路徑為 DELETE /api/pending_dividends?id=xxx
    // 需根據實際後端實作調整
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/pending_dividends?id=${id}`, {
        method: 'DELETE',
        headers: { 
            'Authorization': `Bearer ${store.token || localStorage.getItem('token')}`,
        }
    });

    if (res.ok) {
        addToast('已移除配息通知', 'info');
        // 手動從 store 移除以加快 UI 反應
        store.pending_dividends = store.pending_dividends.filter(d => d.id !== id);
    } else {
        throw new Error('API Error');
    }
  } catch (e) {
    addToast('移除失敗', 'error');
  } finally {
    processingId.value = null;
  }
};

onMounted(() => {
    // 組件掛載時不一定需要 fetch，因為 App.vue 已經 fetchAll 了
    // 但如果有獨立運作需求可在此呼叫
});
</script>

<style scoped>
.dividend-manager {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  margin-bottom: 24px;
  /* 加上金色邊框強調配息 */
  border-left: 4px solid var(--warning);
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to right, rgba(245, 158, 11, 0.05), transparent);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}

h3::before {
  content: '💰';
  font-size: 1.2rem;
}

.badge-count {
  background: var(--warning);
  color: white;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}

.btn-refresh {
  background: transparent;
  border: 1px solid var(--border-color);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-sub);
  transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: var(--bg-secondary);
  color: var(--primary);
  border-color: var(--primary);
}

.spinning {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin { from {transform: rotate(0deg);} to {transform: rotate(360deg);} }

/* Desktop Table */
.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 12px 20px;
  font-size: 0.85rem;
  color: var(--text-sub);
  font-weight: 600;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

td {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.95rem;
  color: var(--text-main);
  vertical-align: middle;
}

tr:last-child td {
  border-bottom: none;
}

.date-cell {
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-sub);
}

.symbol-badge {
  font-weight: 700;
  color: var(--primary);
  background: rgba(59, 130, 246, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  display: inline-block;
}

.text-right { text-align: right; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }
.text-sub { color: var(--text-sub); }
.text-success { color: var(--success); }

.actions-cell {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-confirm {
  background: var(--success);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-confirm:hover:not(:disabled) {
  background: #059669; /* darker green */
  transform: translateY(-1px);
}

.btn-delete {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-delete:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  border-color: var(--danger);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

/* Empty State */
.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--text-sub);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
  opacity: 0.8;
}

/* Mobile View */
.mobile-view {
  display: none;
}

.mobile-cards {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.div-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  position: relative;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-date {
  font-size: 0.9rem;
  color: var(--text-sub);
  font-family: 'JetBrains Mono', monospace;
}

.card-main {
  margin-bottom: 16px;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.amount-row .label {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
}

.amount-row .value {
  font-size: 1.4rem;
  font-weight: 700;
}

.details-row {
  display: flex;
  background: var(--bg-card);
  padding: 8px 12px;
  border-radius: 8px;
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.sub-label {
  font-size: 0.75rem;
  color: var(--text-sub);
}

.sub-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.95rem;
  color: var(--text-main);
}

.card-actions {
  display: flex;
  gap: 12px;
}

.btn-card-delete {
  flex: 1;
  padding: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.btn-card-confirm {
  flex: 2;
  padding: 10px;
  background: var(--success);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

/* RWD Media Queries */
@media (max-width: 768px) {
  .desktop-view {
    display: none;
  }
  
  .mobile-view {
    display: block;
  }
  
  .card-header {
    padding: 12px 16px;
  }
  
  .badge-count {
    font-size: 0.7rem;
  }
}
</style>
