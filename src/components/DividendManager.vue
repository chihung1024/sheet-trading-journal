<template>
  <div class="dividend-manager">
    <!-- Header -->
    <div class="dm-header">
      <div class="dm-title">
        <div class="title-icon">💰</div>
        <div>
          <h3>待確認配息</h3>
          <span class="subtitle" v-if="localDividends.length > 0">
            {{ localDividends.length }} 筆待處理
          </span>
        </div>
      </div>
      <button 
        class="btn-refresh" 
        @click="fetchDividends" 
        :disabled="loading"
        title="刷新配息資訊"
      >
        <span :class="{ spinning: loading }">↻</span>
      </button>
    </div>

    <!-- Desktop Table -->
    <div class="desktop-table">
      <div v-if="localDividends.length > 0" class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th width="110">除息日</th>
              <th width="100">代碼</th>
              <th class="text-right" width="180">實發總額</th>
              <th class="text-right" width="140">稅金</th>
              <th class="text-right" width="140">淨額</th>
              <th width="150">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="div in localDividends" :key="div.id" class="table-row">
              <!-- 日期 -->
              <td>
                <div class="date-display">
                  {{ formatFullDate(div.date) }}
                </div>
              </td>
              
              <!-- 股票代碼 -->
              <td>
                <span class="symbol-tag">{{ div.symbol }}</span>
              </td>
              
              <!-- 實發總額 -->
              <td class="text-right">
                <div class="input-group">
                  <span class="input-currency">{{ getCurrency(div.symbol) }}</span>
                  <input 
                    type="number" 
                    v-model.number="div.amount" 
                    class="input-field"
                    step="0.01"
                    placeholder="0.00"
                  >
                </div>
              </td>
              
              <!-- 稅金 -->
              <td class="text-right">
                <div class="input-group">
                  <input 
                    type="number" 
                    v-model.number="div.tax" 
                    class="input-field input-tax"
                    step="0.01"
                    placeholder="0.00"
                  >
                </div>
              </td>
              
              <!-- 淨額 -->
              <td class="text-right">
                <div class="net-display">
                  {{ formatNumber((div.amount || 0) - (div.tax || 0), 2) }}
                </div>
              </td>
              
              <!-- 操作按鈕 -->
              <td>
                <div class="action-buttons">
                  <button 
                    class="btn-action btn-confirm" 
                    @click="confirmDividend(div)"
                    :disabled="processingId === div.id"
                  >
                    <span v-if="processingId === div.id" class="spinner"></span>
                    <span v-else>✓</span>
                  </button>
                  <button 
                    class="btn-action btn-delete" 
                    @click="deleteDividend(div.id)"
                    :disabled="processingId === div.id"
                    title="忽略"
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- 空狀態 -->
      <div v-else class="empty-state">
        <div class="empty-icon">🎉</div>
        <p class="empty-text">目前沒有待確認的配息</p>
        <p class="empty-hint">配息資訊將自動同步顯示</p>
      </div>
    </div>

    <!-- Mobile Cards -->
    <div class="mobile-cards">
      <div v-if="localDividends.length === 0" class="empty-state">
        <div class="empty-icon">🎉</div>
        <p class="empty-text">目前沒有待確認的配息</p>
        <p class="empty-hint">配息資訊將自動同步顯示</p>
      </div>

      <div v-else class="cards-container">
        <div 
          v-for="div in localDividends" 
          :key="'m_' + div.id" 
          class="dividend-card"
        >
          <!-- Card Header -->
          <div class="card-header">
            <div class="card-info">
              <span class="symbol-tag">{{ div.symbol }}</span>
              <span class="date-text">{{ formatFullDate(div.date) }}</span>
            </div>
          </div>
          
          <!-- Card Body -->
          <div class="card-body">
            <div class="form-row">
              <label class="form-label">
                <span class="label-icon">💵</span>
                實發總額 ({{ getCurrency(div.symbol) }})
              </label>
              <input 
                type="number" 
                v-model.number="div.amount" 
                class="form-input"
                step="0.01"
                placeholder="輸入總額"
              >
            </div>
            
            <div class="form-row">
              <label class="form-label">
                <span class="label-icon">📝</span>
                預扣稅金 ({{ getCurrency(div.symbol) }})
              </label>
              <input 
                type="number" 
                v-model.number="div.tax" 
                class="form-input"
                step="0.01"
                placeholder="輸入稅金"
              >
            </div>
            
            <div class="net-summary">
              <span class="summary-label">實際入帳淨額</span>
              <span class="summary-value">
                <span class="value-currency">{{ getCurrency(div.symbol) }}</span>
                {{ formatNumber((div.amount || 0) - (div.tax || 0), 2) }}
              </span>
            </div>
          </div>
          
          <!-- Card Footer -->
          <div class="card-footer">
            <button 
              class="btn-card btn-ignore" 
              @click="deleteDividend(div.id)"
              :disabled="processingId === div.id"
            >
              忽略
            </button>
            <button 
              class="btn-card btn-submit" 
              @click="confirmDividend(div)"
              :disabled="processingId === div.id"
            >
              <span v-if="processingId === div.id" class="spinner"></span>
              <span v-else>✓ 確認入帳</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const { addToast } = useToast();

const loading = ref(false);
const processingId = ref(null);
const localDividends = ref([]);

const isTWStock = (symbol) => {
  return /^\d{4}/.test(symbol) || /\.TW(O)?$/i.test(symbol);
};

const getCurrency = (symbol) => {
  return isTWStock(symbol) ? 'TWD' : 'USD';
};

watch(() => store.pending_dividends, (newVal) => {
  if (newVal && newVal.length > 0) {
    localDividends.value = newVal.map(d => {
      const gross = Number(d.total_gross) || 0;
      const net = Number(d.total_net_usd) || 0;
      const currency = getCurrency(d.symbol);
      
      let defaultTax = 0;
      if (currency === 'USD') {
        defaultTax = parseFloat((gross - net).toFixed(2));
        if (defaultTax < 0) defaultTax = 0;
      }

      return {
        ...d,
        amount: d.amount !== undefined ? d.amount : gross,
        tax: d.tax !== undefined ? d.tax : defaultTax
      };
    });
  } else {
    localDividends.value = [];
  }
}, { immediate: true, deep: true });

const fetchDividends = async () => {
  loading.value = true;
  try {
    await store.fetchAll();
    addToast('已刷新配息資訊', 'success');
  } catch (e) {
    addToast('刷新失敗', 'error');
  } finally {
    loading.value = false;
  }
};

const formatFullDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-TW', { 
    month: '2-digit', 
    day: '2-digit' 
  });
};

const formatNumber = (val, d = 2) => {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });
};

const confirmDividend = async (div) => {
  const finalAmount = Number(div.amount) || 0;
  const finalTax = Number(div.tax) || 0;
  const netAmount = finalAmount - finalTax;
  const currency = getCurrency(div.symbol);
  
  if (!confirm(`確認將 ${div.symbol} 的配息 ${currency} ${formatNumber(netAmount)} 入帳嗎？`)) return;
  
  processingId.value = div.id;
  try {
    const record = {
      txn_date: div.date,
      symbol: div.symbol,
      txn_type: 'DIV',
      qty: 0,
      price: 0,
      fee: 0,
      tax: finalTax,
      total_amount: finalAmount,
      tag: 'Auto-Dividend'
    };

    const success = await store.addRecord(record);
    if (success) {
      await fetch(`${CONFIG.API_BASE_URL}/api/pending_dividends?id=${div.id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${store.token || localStorage.getItem('token')}` 
        }
      }).catch(err => console.warn('刪除 pending 失敗', err));

      addToast(`${div.symbol} 配息已入帳`, 'success');
      localDividends.value = localDividends.value.filter(d => d.id !== div.id);
      setTimeout(async () => { await store.fetchAll(); }, 500);
    }
  } catch (e) {
    console.error(e);
    addToast('入帳失敗', 'error');
  } finally {
    processingId.value = null;
  }
};

const deleteDividend = async (id) => {
  if (!confirm('確定要忽略這筆配息嗎？')) return;
  processingId.value = id;
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/pending_dividends?id=${id}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${store.token || localStorage.getItem('token')}` 
      }
    });
    if (res.ok) {
      addToast('已移除', 'info');
      localDividends.value = localDividends.value.filter(d => d.id !== id);
      if (store.rawData && store.rawData.pending_dividends) {
        store.rawData.pending_dividends = store.rawData.pending_dividends.filter(d => d.id !== id);
      }
    } else {
      throw new Error('API delete failed');
    }
  } catch (e) {
    addToast('移除失敗', 'error');
  } finally {
    processingId.value = null;
  }
};
</script>

<style scoped>
/* ==================== 主容器 ==================== */
.dividend-manager {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

/* ==================== Header ==================== */
.dm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-card);
}

.dm-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.dm-title h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.01em;
}

.subtitle {
  font-size: 0.8rem;
  color: var(--text-sub);
  font-weight: 500;
}

.btn-refresh {
  width: 36px;
  height: 36px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-sub);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
  transform: translateY(-1px);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ==================== Desktop Table ==================== */
.desktop-table {
  display: block;
}

.table-wrapper {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead th {
  text-align: left;
  padding: 14px 20px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

thead th.text-right {
  text-align: right;
}

tbody .table-row {
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

tbody .table-row:hover {
  background: var(--bg-secondary);
}

tbody .table-row:last-child {
  border-bottom: none;
}

td {
  padding: 16px 20px;
  vertical-align: middle;
}

/* 日期顯示 */
.date-display {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main);
  font-family: 'JetBrains Mono', monospace;
}

/* 股票代碼 */
.symbol-tag {
  display: inline-block;
  padding: 6px 12px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
  color: var(--primary);
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.02em;
}

/* 輸入框組 */
.input-group {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.input-currency {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
}

.input-field {
  width: 120px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  text-align: right;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-main);
  transition: all 0.2s;
}

.input-field:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--bg-card);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-field::placeholder {
  color: var(--text-sub);
  opacity: 0.5;
}

.input-tax {
  width: 100px;
}

/* 淨額顯示 */
.net-display {
  display: inline-flex;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: var(--success);
}

/* 操作按鈕 */
.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-action {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-confirm {
  background: var(--success);
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: #059669;
  transform: scale(1.05);
}

.btn-delete {
  background: var(--bg-secondary);
  color: var(--text-sub);
  border: 1px solid var(--border-color);
}

.btn-delete:hover:not(:disabled) {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fca5a5;
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* ==================== 空狀態 ==================== */
.empty-state {
  padding: 60px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.empty-text {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 8px 0;
}

.empty-hint {
  font-size: 0.9rem;
  color: var(--text-sub);
  margin: 0;
}

/* ==================== Mobile Cards ==================== */
.mobile-cards {
  display: none;
}

.cards-container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dividend-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.card-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-card);
}

.card-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.date-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-sub);
  font-family: 'JetBrains Mono', monospace;
}

.card-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.label-icon {
  font-size: 1rem;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  text-align: right;
  font-size: 1.125rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-main);
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.net-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
  border-radius: 8px;
  margin-top: 4px;
}

.summary-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-main);
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: var(--success);
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.value-currency {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-sub);
}

.card-footer {
  padding: 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 12px;
}

.btn-card {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
}

.btn-ignore {
  background: var(--bg-secondary);
  color: var(--text-sub);
  border: 1px solid var(--border-color);
}

.btn-ignore:hover:not(:disabled) {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fca5a5;
}

.btn-submit {
  flex: 2;
  background: var(--success);
  color: white;
}

.btn-submit:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.2);
}

.btn-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==================== 工具類 ==================== */
.text-right {
  text-align: right;
}

/* ==================== 響應式設計 ==================== */
@media (max-width: 1024px) {
  .desktop-table {
    display: none;
  }
  
  .mobile-cards {
    display: block;
  }
  
  .dm-header {
    padding: 16px;
  }
  
  .title-icon {
    width: 36px;
    height: 36px;
    font-size: 1.125rem;
  }
  
  .dm-title h3 {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .cards-container {
    padding: 12px;
    gap: 12px;
  }
  
  .card-header,
  .card-body,
  .card-footer {
    padding: 12px;
  }
  
  .summary-value {
    font-size: 1.25rem;
  }
}
</style>