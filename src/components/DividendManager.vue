<template>
  <div class="card dividend-manager">
    <!-- Header 區塊 -->
    <div class="card-header">
      <div class="header-content">
        <div class="title-wrapper">
          <div class="icon-badge">💰</div>
          <div class="title-group">
            <h3>待確認配息</h3>
            <span class="badge-count" v-if="localDividends.length > 0">
              <span class="badge-dot"></span>
              {{ localDividends.length }} 筆
            </span>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn-refresh" @click="fetchDividends" :disabled="loading" title="重新檢查配息">
          <span :class="{ 'spinning': loading }">↻</span>
        </button>
      </div>
    </div>

    <!-- Desktop 表格 -->
    <div class="table-container desktop-view">
      <table v-if="localDividends.length > 0">
        <thead>
          <tr>
            <th width="100">日期</th>
            <th width="100">代碼</th>
            <th class="text-right" width="180">實發總額</th>
            <th class="text-right" width="160">稅金</th>
            <th class="text-right" width="140">淨額</th>
            <th class="text-right" width="150">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="div in localDividends" :key="div.id" class="div-row">
            <!-- 日期 -->
            <td class="date-cell">
              <div class="date-badge">
                <span class="date-icon">📅</span>
                {{ formatDate(div.date) }}
              </div>
            </td>
            
            <!-- 代碼 -->
            <td>
              <span class="symbol-badge">{{ div.symbol }}</span>
            </td>
            
            <!-- 實發總額 -->
            <td class="text-right input-cell">
              <div class="input-wrapper">
                <span class="currency-tag">{{ getCurrency(div.symbol) }}</span>
                <input 
                  type="number" 
                  v-model.number="div.amount" 
                  class="inline-input font-num" 
                  step="0.01"
                  placeholder="0.00"
                >
              </div>
            </td>
            
            <!-- 稅金 -->
            <td class="text-right input-cell">
              <div class="input-wrapper tax-input">
                <span class="tax-icon">📝</span>
                <input 
                  type="number" 
                  v-model.number="div.tax" 
                  class="inline-input font-num" 
                  step="0.01"
                  placeholder="0.00"
                >
              </div>
            </td>
            
            <!-- 淨額 -->
            <td class="text-right">
              <div class="net-amount">
                <span class="amount-value font-num">
                  {{ formatNumber((div.amount || 0) - (div.tax || 0), 2) }}
                </span>
              </div>
            </td>
            
            <!-- 操作按鈕 -->
            <td class="actions-cell">
              <button 
                class="btn-confirm" 
                @click="confirmDividend(div)" 
                :disabled="processingId === div.id"
                :class="{ 'loading': processingId === div.id }"
              >
                <span v-if="processingId === div.id" class="btn-spinner"></span>
                <span v-else>✓ 確認</span>
              </button>
              <button 
                class="btn-delete" 
                @click="deleteDividend(div.id)" 
                :disabled="processingId === div.id"
                title="忽略此配息"
              >
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- 空狀態 -->
      <div v-else class="empty-state">
        <div class="empty-animation">
          <div class="empty-icon">🎉</div>
          <div class="empty-sparkles">✨</div>
        </div>
        <p class="empty-text">目前沒有待確認的配息紀錄</p>
        <p class="empty-subtext">配息資訊將自動同步顯示</p>
      </div>
    </div>

    <!-- Mobile 卡片 -->
    <div class="mobile-view">
      <div v-if="localDividends.length === 0" class="empty-state">
        <div class="empty-animation">
          <div class="empty-icon">🎉</div>
          <div class="empty-sparkles">✨</div>
        </div>
        <p class="empty-text">目前沒有待確認的配息</p>
        <p class="empty-subtext">配息資訊將自動同步顯示</p>
      </div>

      <div v-else class="mobile-cards">
        <div v-for="div in localDividends" :key="'mob_'+div.id" class="div-card">
          <div class="card-top">
            <div class="card-date">
              <span class="date-icon">📅</span>
              {{ formatDate(div.date) }}
            </div>
            <span class="symbol-badge">{{ div.symbol }}</span>
          </div>
          
          <div class="card-main">
            <div class="edit-row">
              <label>💵 總額 ({{ getCurrency(div.symbol) }})</label>
              <input 
                type="number" 
                v-model.number="div.amount" 
                class="mobile-input font-num"
                step="0.01"
                placeholder="輸入總額"
              >
            </div>
            <div class="edit-row">
              <label>📝 稅金 ({{ getCurrency(div.symbol) }})</label>
              <input 
                type="number" 
                v-model.number="div.tax" 
                class="mobile-input font-num"
                step="0.01"
                placeholder="輸入稅金"
              >
            </div>
            
            <div class="amount-row">
              <span class="label">✅ 淨額試算</span>
              <span class="value font-num">
                <small class="currency-tag">{{ getCurrency(div.symbol) }}</small> 
                {{ formatNumber((div.amount || 0) - (div.tax || 0), 2) }}
              </span>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-card-delete" @click="deleteDividend(div.id)" :disabled="processingId === div.id">
              ✕ 刪除
            </button>
            <button class="btn-card-confirm" @click="confirmDividend(div)" :disabled="processingId === div.id">
              <span v-if="processingId === div.id" class="btn-spinner"></span>
              <span v-else>✓ {{ processingId === div.id ? '處理中...' : '確認入帳' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
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

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
};

const formatNumber = (val, d=2) => {
  return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
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
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  margin-bottom: 24px;
  border-left: 4px solid var(--warning);
  transition: all 0.3s ease;
}

.dividend-manager:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
}

/* ==================== Header 樣式 ==================== */
.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%);
}

.header-content {
  flex: 1;
}

.title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-badge {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
}

.title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.02em;
}

.badge-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  color: white;
  font-size: 0.8rem;
  padding: 4px 12px;
  border-radius: 14px;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.badge-dot {
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
  animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 刷新按鈕 */
.btn-refresh {
  background: white;
  border: 1px solid var(--border-color);
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-sub);
  font-size: 1.1rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.btn-refresh:hover:not(:disabled) {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.2);
}

.btn-refresh:active:not(:disabled) {
  transform: translateY(0);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ==================== 表格樣式 ==================== */
.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

thead th {
  text-align: left;
  padding: 14px 20px;
  font-size: 0.8rem;
  color: var(--text-sub);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 1;
}

tbody tr {
  transition: all 0.2s ease;
  background: var(--bg-card);
}

tbody tr:hover {
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.03) 0%, rgba(59, 130, 246, 0.01) 100%);
  transform: translateX(2px);
}

td {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.95rem;
  color: var(--text-main);
  vertical-align: middle;
}

tbody tr:last-child td {
  border-bottom: none;
}

/* 日期樣式 */
.date-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
  border: 1px solid var(--border-color);
}

.date-icon {
  font-size: 0.9rem;
}

/* 股票代碼 */
.symbol-badge {
  display: inline-block;
  font-weight: 700;
  color: var(--primary);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%);
  padding: 6px 12px;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  border: 1px solid rgba(59, 130, 246, 0.15);
  letter-spacing: 0.02em;
  transition: all 0.2s ease;
}

.symbol-badge:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(59, 130, 246, 0.12) 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.15);
}

/* 輸入框樣式 */
.input-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  transition: all 0.2s ease;
  min-width: 140px;
}

.input-wrapper:hover {
  border-color: var(--primary);
  background: white;
}

.input-wrapper:focus-within {
  border-color: var(--primary);
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.currency-tag, .tax-icon {
  font-size: 0.75rem;
  color: var(--text-sub);
  font-weight: 600;
  white-space: nowrap;
}

.inline-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: right;
  font-size: 0.95rem;
  color: var(--text-main);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  outline: none;
}

.inline-input::placeholder {
  color: var(--text-sub);
  opacity: 0.5;
}

/* 淨額顯示 */
.net-amount {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
  border-radius: 8px;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.amount-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--success);
  letter-spacing: -0.01em;
}

/* 操作按鈕 */
.actions-cell {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
  min-width: 70px;
}

.btn-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
}

.btn-confirm:active:not(:disabled) {
  transform: translateY(0);
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-confirm.loading {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
}

.btn-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.btn-delete:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
  transform: scale(1.05);
}

.btn-delete:active:not(:disabled) {
  transform: scale(0.95);
}

/* Loading Spinner */
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* 空狀態 */
.empty-state {
  padding: 60px 20px;
  text-align: center;
}

.empty-animation {
  position: relative;
  display: inline-block;
  margin-bottom: 20px;
}

.empty-icon {
  font-size: 4rem;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.empty-sparkles {
  position: absolute;
  top: -10px;
  right: -10px;
  font-size: 1.5rem;
  animation: sparkle 1.5s ease-in-out infinite;
}

@keyframes sparkle {
  0%, 100% { opacity: 0; transform: rotate(0deg) scale(0.8); }
  50% { opacity: 1; transform: rotate(180deg) scale(1.2); }
}

.empty-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 8px 0;
}

.empty-subtext {
  font-size: 0.9rem;
  color: var(--text-sub);
  margin: 0;
}

/* ==================== Mobile 樣式 ==================== */
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
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.div-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--border-color);
}

.card-date {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: var(--text-sub);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
}

.card-main {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.edit-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.edit-row label {
  font-size: 0.85rem;
  color: var(--text-sub);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.mobile-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  text-align: right;
  font-size: 1rem;
  background: var(--bg-card);
  color: var(--text-main);
  box-sizing: border-box;
  font-weight: 600;
  transition: all 0.2s ease;
}

.mobile-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
  border-radius: 8px;
  margin-top: 4px;
}

.amount-row .label {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main);
}

.amount-row .value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--success);
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.card-actions {
  display: flex;
  gap: 12px;
}

.btn-card-delete {
  flex: 1;
  padding: 12px;
  background: white;
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-card-delete:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

.btn-card-confirm {
  flex: 2;
  padding: 12px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-card-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
}

/* ==================== 工具類 ==================== */
.text-right {
  text-align: right;
}

.font-num {
  font-family: 'JetBrains Mono', monospace;
}

.font-bold {
  font-weight: 700;
}

.text-sub {
  color: var(--text-sub);
}

.text-success {
  color: var(--success);
}

/* ==================== 響應式 ==================== */
@media (max-width: 768px) {
  .desktop-view {
    display: none;
  }
  .mobile-view {
    display: block;
  }
  .card-header {
    padding: 16px;
  }
  .icon-badge {
    width: 36px;
    height: 36px;
    font-size: 1.1rem;
  }
  h3 {
    font-size: 1.1rem;
  }
}
</style>