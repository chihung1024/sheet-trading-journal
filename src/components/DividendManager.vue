<template>
  <div class="dividend-manager">
    <div class="header">
      <div class="title-section">
        <h3>配息管理</h3>
        <span class="badge" v-if="pendingDividends.length > 0">
          {{ pendingDividends.length }} 筆待確認
        </span>
      </div>
      <div class="actions">
        <button 
          class="btn btn-primary" 
          @click="confirmAllDividends"
          :disabled="pendingDividends.length === 0 || isProcessing"
        >
          <span class="icon">✅</span>
          全部確認
        </button>
      </div>
    </div>

    <div v-if="pendingDividends.length === 0" class="empty-state">
      <div class="empty-icon">🎉</div>
      <p>目前沒有待確認的配息</p>
      <small>系統會自動抓取配息並顯示在這裡</small>
    </div>

    <div v-else class="dividend-list">
      <div 
        v-for="(div, index) in pendingDividends" 
        :key="index"
        class="dividend-card"
      >
        <div class="dividend-header">
          <div class="symbol-info">
            <span class="symbol">{{ div.symbol }}</span>
            <span class="date">除息日: {{ div.ex_date }}</span>
          </div>
          <div class="status-badge pending">待確認</div>
        </div>

        <div class="dividend-body">
          <div class="info-grid">
            <div class="info-item">
              <label>持股數</label>
              <span class="value">{{ formatNumber(div.shares_held, 2) }} 股</span>
            </div>
            <div class="info-item">
              <label>每股配息 (稅前)</label>
              <span class="value">${{ formatNumber(div.dividend_per_share_gross, 4) }}</span>
            </div>
            <div class="info-item">
              <label>總配息 (稅前)</label>
              <span class="value">${{ formatNumber(div.total_gross, 2) }}</span>
            </div>
            <div class="info-item">
              <label>匯率</label>
              <span class="value">{{ formatNumber(div.fx_rate, 4) }}</span>
            </div>
          </div>

          <div class="edit-section" v-if="editingIndex === index">
            <div class="form-grid">
              <div class="form-group">
                <label>稅率 (%)</label>
                <input 
                  type="number" 
                  v-model.number="editForm.tax_rate"
                  step="0.01"
                  min="0"
                  max="100"
                  class="input-field"
                >
              </div>
              <div class="form-group">
                <label>實收金額 (USD)</label>
                <input 
                  type="number" 
                  v-model.number="editForm.total_net_usd"
                  step="0.01"
                  class="input-field"
                >
              </div>
              <div class="form-group full-width">
                <label>發放日 (選填)</label>
                <input 
                  type="date" 
                  v-model="editForm.pay_date"
                  class="input-field"
                >
              </div>
              <div class="form-group full-width">
                <label>備註 (選填)</label>
                <textarea 
                  v-model="editForm.notes"
                  rows="2"
                  class="input-field"
                  placeholder="可輸入配息相關備註..."
                ></textarea>
              </div>
            </div>

            <div class="calculated-info">
              <div class="calc-item">
                <span class="label">稅後配息 (TWD):</span>
                <span class="value highlight">NT${{ formatNumber(editForm.total_net_usd * div.fx_rate, 0) }}</span>
              </div>
            </div>
          </div>

          <div class="summary-section" v-else>
            <div class="summary-item">
              <span class="label">稅率:</span>
              <span class="value">{{ div.tax_rate }}%</span>
            </div>
            <div class="summary-item highlight">
              <span class="label">稅後配息:</span>
              <span class="value">${{ formatNumber(div.total_net_usd, 2) }} / NT${{ formatNumber(div.total_net_twd, 0) }}</span>
            </div>
          </div>
        </div>

        <div class="dividend-footer">
          <template v-if="editingIndex === index">
            <button class="btn btn-secondary" @click="cancelEdit">
              取消
            </button>
            <button class="btn btn-success" @click="saveEdit(index)">
              儲存修改
            </button>
          </template>
          <template v-else>
            <button class="btn btn-secondary" @click="ignoreDividend(index)">
              忽略
            </button>
            <button class="btn btn-ghost" @click="startEdit(index)">
              編輯
            </button>
            <button class="btn btn-primary" @click="confirmSingleDividend(index)">
              確認
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const auth = useAuthStore();
const { addToast } = useToast();

const isProcessing = ref(false);
const editingIndex = ref(null);
const editForm = reactive({
  tax_rate: 30.0,
  total_net_usd: 0,
  pay_date: '',
  notes: ''
});

// 待確認配息列表
const pendingDividends = computed(() => {
  const snapshot = store.stats.pending_dividends || [];
  return snapshot;
});

const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

// 開始編輯
const startEdit = (index) => {
  const div = pendingDividends.value[index];
  editingIndex.value = index;
  editForm.tax_rate = div.tax_rate;
  editForm.total_net_usd = div.total_net_usd;
  editForm.pay_date = div.pay_date || '';
  editForm.notes = div.notes || '';
};

// 取消編輯
const cancelEdit = () => {
  editingIndex.value = null;
};

// 儲存編輯
const saveEdit = (index) => {
  // 更新當前配息的資料
  const div = pendingDividends.value[index];
  div.tax_rate = editForm.tax_rate;
  div.total_net_usd = editForm.total_net_usd;
  div.total_net_twd = editForm.total_net_usd * div.fx_rate;
  div.pay_date = editForm.pay_date;
  div.notes = editForm.notes;
  
  editingIndex.value = null;
  addToast('修改已儲存，請點擊「確認」寫入交易記錄', 'success');
};

// 確認單筆配息
const confirmSingleDividend = async (index) => {
  const div = pendingDividends.value[index];
  
  if (!confirm(`確認將 ${div.symbol} 的配息寫入交易記錄？`)) return;
  
  isProcessing.value = true;
  
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        txn_date: div.pay_date || div.ex_date,
        symbol: div.symbol,
        txn_type: 'DIV',
        qty: div.shares_held,
        price: div.total_net_usd,  // DIV 類型的 price 字段放總金額
        commission: 0,
        tax: 0,
        tag: div.notes || '系統自動確認'
      })
    });
    
    const json = await response.json();
    
    if (json.success) {
      addToast(`${div.symbol} 配息已確認`, 'success');
      // 重新載入數據
      await store.fetchAll();
    } else {
      addToast(json.error || '確認失敗', 'error');
    }
  } catch (e) {
    console.error('確認配息錯誤:', e);
    addToast('連線錯誤', 'error');
  } finally {
    isProcessing.value = false;
  }
};

// 全部確認
const confirmAllDividends = async () => {
  if (!confirm(`確認將所有 ${pendingDividends.value.length} 筆配息寫入交易記錄？`)) return;
  
  isProcessing.value = true;
  
  try {
    for (const div of pendingDividends.value) {
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          txn_date: div.pay_date || div.ex_date,
          symbol: div.symbol,
          txn_type: 'DIV',
          qty: div.shares_held,
          price: div.total_net_usd,
          commission: 0,
          tax: 0,
          tag: div.notes || '系統自動確認'
        })
      });
      
      const json = await response.json();
      if (!json.success) {
        throw new Error(`${div.symbol} 確認失敗: ${json.error}`);
      }
    }
    
    addToast('所有配息已確認', 'success');
    await store.fetchAll();
  } catch (e) {
    console.error('批量確認錯誤:', e);
    addToast(e.message || '部分配息確認失敗', 'error');
  } finally {
    isProcessing.value = false;
  }
};

// 忽略配息 (暂時從列表移除，下次更新還會出現)
const ignoreDividend = (index) => {
  const div = pendingDividends.value[index];
  if (!confirm(`確認忽略 ${div.symbol} 的配息？`)) return;
  
  pendingDividends.value.splice(index, 1);
  addToast('已忽略此配息', 'info');
};
</script>

<style scoped>
.dividend-manager {
  width: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--border-color);
}

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-section h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
}

.badge {
  background: var(--warning);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 12px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-sub);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state p {
  font-size: 1.1rem;
  margin-bottom: 8px;
}

.empty-state small {
  font-size: 0.9rem;
  opacity: 0.7;
}

.dividend-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dividend-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
}

.dividend-card:hover {
  box-shadow: var(--shadow-card);
  border-color: var(--primary);
}

.dividend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.symbol-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.symbol {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--primary);
}

.date {
  font-size: 0.9rem;
  color: var(--text-sub);
  font-family: 'JetBrains Mono', monospace;
}

.status-badge {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-badge.pending {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
  border: 1px solid var(--warning);
}

.dividend-body {
  margin-bottom: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item label {
  font-size: 0.85rem;
  color: var(--text-sub);
  font-weight: 500;
}

.info-item .value {
  font-size: 1rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.edit-section {
  background: var(--bg-secondary);
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group.full-width {
  grid-column: span 2;
}

.form-group label {
  font-size: 0.9rem;
  color: var(--text-sub);
  font-weight: 600;
}

.input-field {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 1rem;
  font-family: 'JetBrains Mono', monospace;
  transition: all 0.2s ease;
  background: var(--bg-card);
  color: var(--text-main);
}

.input-field:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

textarea.input-field {
  font-family: inherit;
  resize: vertical;
}

.calculated-info {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px dashed var(--border-color);
}

.calc-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.calc-item .label {
  font-size: 0.95rem;
  color: var(--text-sub);
}

.calc-item .value.highlight {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--success);
  font-family: 'JetBrains Mono', monospace;
}

.summary-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-item .label {
  font-size: 0.9rem;
  color: var(--text-sub);
}

.summary-item .value {
  font-size: 1rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.summary-item.highlight .value {
  color: var(--success);
  font-size: 1.1rem;
}

.dividend-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #4338ca;
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.btn-success {
  background: var(--success);
  color: white;
}

.btn-success:hover {
  background: #059669;
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-sub);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--border-color);
  color: var(--text-main);
}

.btn-ghost {
  background: transparent;
  color: var(--text-sub);
  border: 1px solid transparent;
}

.btn-ghost:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.icon {
  font-size: 1.1rem;
}

/* 響應式 */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .form-group.full-width {
    grid-column: span 1;
  }
  
  .dividend-footer {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>