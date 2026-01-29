<template>
  <div class="dividend-manager">
    <!-- Header -->
    <div class="dm-header">
      <div class="dm-title">
        <div class="title-icon">💰</div>
        <div>
          <h3>待確認配息</h3>
          <span class="subtitle" v-if="localDividends.length > 0">
            {{ pendingCount }} 筆待處理
            <span v-if="confirmedCount > 0" class="confirmed-badge">
              / {{ confirmedCount }} 筆已確認
            </span>
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
              <th width="120">除息日</th>
              <th width="100">代碼</th>
              <th class="text-right" width="180">實發總額</th>
              <th class="text-right" width="160">稅金</th>
              <th class="text-center" width="140">淨額</th>
              <th width="100">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="div in localDividends" 
              :key="getDivKey(div)" 
              class="table-row"
              :class="{ 'row-confirmed': isConfirmed(div) }"
            >
              <!-- 日期 -->
              <td class="text-center">
                <div class="date-display">
                  {{ formatFullDate(div.ex_date) }}
                </div>
              </td>
              
              <!-- 股票代碼 -->
              <td class="text-center">
                <div class="symbol-wrapper">
                  <span class="symbol-tag">{{ div.symbol }}</span>
                  <span v-if="isConfirmed(div)" class="confirmed-label">✓ 已入帳</span>
                </div>
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
                    :disabled="isConfirmed(div)"
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
                    :disabled="isConfirmed(div)"
                  >
                  <span class="tax-rate">{{ getTaxRate(div) }}%</span>
                </div>
              </td>
              
              <!-- 淨額 -->
              <td class="text-center">
                <div class="net-display">
                  {{ formatNumber((div.amount || 0) - (div.tax || 0), 2) }}
                </div>
              </td>
              
              <!-- 操作按鈕 -->
              <td class="text-center">
                <div class="action-buttons">
                  <button 
                    class="btn-action btn-confirm" 
                    :class="{ 'btn-confirmed': isConfirmed(div) }"
                    @click="confirmDividend(div)"
                    :disabled="processingKey === getDivKey(div) || isConfirmed(div)"
                    :title="isConfirmed(div) ? '已確認入帳' : '確認入帳'"
                  >
                    <span v-if="processingKey === getDivKey(div)" class="spinner"></span>
                    <span v-else-if="isConfirmed(div)">✓</span>
                    <span v-else>✓</span>
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
          :key="'m_' + getDivKey(div)" 
          class="dividend-card"
          :class="{ 'card-confirmed': isConfirmed(div) }"
        >
          <!-- Card Header -->
          <div class="card-header">
            <div class="card-info">
              <span class="symbol-tag">{{ div.symbol }}</span>
              <span class="date-text">{{ formatFullDate(div.ex_date) }}</span>
            </div>
            <span v-if="isConfirmed(div)" class="confirmed-badge-mobile">
              ✓ 已入帳
            </span>
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
                :disabled="isConfirmed(div)"
              >
            </div>
            
            <div class="form-row">
              <label class="form-label">
                <span class="label-icon">📝</span>
                預扣稅金 ({{ getCurrency(div.symbol) }})
                <span class="tax-badge">{{ getTaxRate(div) }}%</span>
              </label>
              <input 
                type="number" 
                v-model.number="div.tax" 
                class="form-input"
                step="0.01"
                placeholder="輸入稅金"
                :disabled="isConfirmed(div)"
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
              class="btn-card btn-submit" 
              :class="{ 'btn-submitted': isConfirmed(div) }"
              @click="confirmDividend(div)"
              :disabled="processingKey === getDivKey(div) || isConfirmed(div)"
            >
              <span v-if="processingKey === getDivKey(div)" class="spinner"></span>
              <span v-else-if="isConfirmed(div)">✓ 已入帳</span>
              <span v-else>✓ 確認入帳</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const { addToast } = useToast();

const loading = ref(false);
const processingKey = ref(null);
const localDividends = ref([]);
const confirmedKeys = ref(new Set());

const STORAGE_KEY = 'confirmed_dividend_keys';

// 生成配息的唯一 Key (symbol_date)
const getDivKey = (div) => {
  return `${div.symbol}_${div.ex_date}`;
};

// 從 localStorage 載入已確認的配息
const loadConfirmedKeys = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      confirmedKeys.value = new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('載入已確認配息失敗:', e);
    confirmedKeys.value = new Set();
  }
};

// 保存已確認的配息到 localStorage
const saveConfirmedKeys = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(confirmedKeys.value)));
  } catch (e) {
    console.error('保存已確認配息失敗:', e);
  }
};

onMounted(() => {
  loadConfirmedKeys();
});

const isTWStock = (symbol) => {
  return /^\d{4}/.test(symbol) || /\.TW(O)?$/i.test(symbol);
};

const getCurrency = (symbol) => {
  return isTWStock(symbol) ? 'TWD' : 'USD';
};

const getTaxRate = (div) => {
  const amount = Number(div.amount) || 0;
  const tax = Number(div.tax) || 0;
  
  if (amount === 0) return 0;
  
  const rate = (tax / amount) * 100;
  return Math.round(rate);
};

const isConfirmed = (div) => {
  return confirmedKeys.value.has(getDivKey(div));
};

const pendingCount = computed(() => {
  return localDividends.value.filter(d => !isConfirmed(d)).length;
});

const confirmedCount = computed(() => {
  return confirmedKeys.value.size;
});

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
    
    // 清理已從後端消失的確認記錄
    const currentKeys = new Set(newVal.map(d => getDivKey(d)));
    const originalSize = confirmedKeys.value.size;
    confirmedKeys.value = new Set([...confirmedKeys.value].filter(key => currentKeys.has(key)));
    
    if (confirmedKeys.value.size !== originalSize) {
      saveConfirmedKeys();
    }
  } else {
    localDividends.value = [];
    if (confirmedKeys.value.size > 0) {
      confirmedKeys.value.clear();
      saveConfirmedKeys();
    }
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatNumber = (val, d = 2) => {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });
};

const confirmDividend = async (div) => {
  const divKey = getDivKey(div);
  
  // 防重複檢查
  if (confirmedKeys.value.has(divKey)) {
    addToast('此配息已確認入帳', 'info');
    return;
  }
  
  if (processingKey.value === divKey) {
    return;
  }
  
  const finalAmount = Number(div.amount) || 0;
  const finalTax = Number(div.tax) || 0;
  const netAmount = finalAmount - finalTax;
  const currency = getCurrency(div.symbol);
  
  if (finalAmount === 0) {
    addToast('請輸入實發總額', 'error');
    return;
  }
  
  if (!confirm(`確認將 ${div.symbol} 的配息 ${currency} ${formatNumber(netAmount)} 入帳嗎？`)) return;
  
  // 樂觀鎖定：立即標記為已確認
  confirmedKeys.value.add(divKey);
  saveConfirmedKeys();
  processingKey.value = divKey;
  
  try {
    // 嘗試從多個可能的欄位獲取持股數量
    let shares = 0;
    
    if (div.shares !== undefined && div.shares !== null) {
      shares = Number(div.shares);
    } else if (div.qty !== undefined && div.qty !== null) {
      shares = Number(div.qty);
    } else if (div.quantity !== undefined && div.quantity !== null) {
      shares = Number(div.quantity);
    } else if (div.holding_qty !== undefined && div.holding_qty !== null) {
      shares = Number(div.holding_qty);
    } else if (div.shares_held !== undefined && div.shares_held !== null) {
      shares = Number(div.shares_held);
    }
    
    const divPerShare = shares > 0 ? netAmount / shares : netAmount;
    const recordQty = shares > 0 ? shares : 1;
    
    const record = {
      txn_date: div.ex_date,
      symbol: div.symbol,
      txn_type: 'DIV',
      qty: recordQty,
      price: divPerShare,
      fee: 0,
      tax: finalTax,
      total_amount: netAmount,
      tag: 'Auto-Dividend'
    };

    const success = await store.addRecord(record);
    
    if (success) {
      addToast(`${div.symbol} 配息已入帳 (${currency} ${formatNumber(netAmount)})`, 'success');
      await store.fetchAll();
    } else {
      // 失敗時回滾
      confirmedKeys.value.delete(divKey);
      saveConfirmedKeys();
      addToast('入帳失敗：無法新增記錄', 'error');
    }
  } catch (e) {
    // 異常時回滾
    console.error('確認配息錯誤:', e);
    confirmedKeys.value.delete(divKey);
    saveConfirmedKeys();
    addToast(`入帳失敗: ${e.message || '未知錯誤'}`, 'error');
  } finally {
    processingKey.value = null;
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

.confirmed-badge {
  color: var(--success);
  font-weight: 600;
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

/* ==================== 已確認狀態樣式 ==================== */
.row-confirmed {
  opacity: 0.6;
  background: rgba(16, 185, 129, 0.05) !important;
}

.row-confirmed .date-display,
.row-confirmed .symbol-tag,
.row-confirmed .input-field,
.row-confirmed .net-display {
  text-decoration: line-through;
  color: var(--text-sub) !important;
}

.symbol-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.confirmed-label {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--success);
  background: rgba(16, 185, 129, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.btn-confirmed {
  background: var(--success) !important;
  opacity: 0.6;
  cursor: not-allowed !important;
}

.card-confirmed {
  opacity: 0.7;
  background: rgba(16, 185, 129, 0.05) !important;
}

.confirmed-badge-mobile {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--success);
  background: rgba(16, 185, 129, 0.15);
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.btn-submitted {
  background: var(--success) !important;
  opacity: 0.7;
  cursor: not-allowed !important;
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
  text-align: center;
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
  text-align: center;
}

thead th.text-center {
  text-align: center;
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

/* 文字對齊 */
.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
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
  justify-content: center;
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

.input-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-secondary);
}

.input-field::placeholder {
  color: var(--text-sub);
  opacity: 0.5;
}

.input-tax {
  width: 100px;
}

/* 稅率顯示 */
.tax-rate {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--warning);
  background: rgba(245, 158, 11, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

/* 淨額顯示 - 置中對齊 */
.net-display {
  display: inline-flex;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: var(--success);
  justify-content: center;
  align-items: center;
}

/* 操作按鈕 */
.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
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
  transition: all 0.2s;
}

.card-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-card);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-info {
  display: flex;
  align-items: center;
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

.tax-badge {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--warning);
  background: rgba(245, 158, 11, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
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

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-secondary);
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

.btn-submit {
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