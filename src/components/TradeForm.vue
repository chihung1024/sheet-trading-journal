<template>
  <div class="card form-section">
    <div class="form-header">
      <h3>{{ isEditing ? '修改交易紀錄' : '新增交易紀錄' }}</h3>
      <button 
        v-if="isEditing" 
        @click="resetForm" 
        class="btn btn-secondary btn-sm"
        aria-label="取消編輯"
      >
        ✕ 取消修改
      </button>
    </div>

    <form @submit.prevent="submit" class="trade-form" novalidate>
      <div class="form-grid">
        <!-- 日期 -->
        <div class="form-group">
          <label for="txn-date">日期 <span class="required">*</span></label>
          <input 
            id="txn-date"
            v-model="form.txn_date" 
            type="date"
            required
            :aria-invalid="errors.txn_date ? 'true' : 'false'"
            aria-describedby="txn-date-error"
          >
          <span v-if="errors.txn_date" id="txn-date-error" class="error-text">{{ errors.txn_date }}</span>
        </div>

        <!-- 股票代碼 -->
        <div class="form-group">
          <label for="symbol">股票代碼 <span class="required">*</span></label>
          <input 
            id="symbol"
            v-model="form.symbol" 
            type="text"
            placeholder="例：NVDA、TSLA"
            :disabled="isEditing"
            required
            :aria-invalid="errors.symbol ? 'true' : 'false'"
            aria-describedby="symbol-error"
          >
          <span v-if="errors.symbol" id="symbol-error" class="error-text">{{ errors.symbol }}</span>
          <span v-if="isEditing" class="hint-text">編輯時無法變更股票代碼</span>
        </div>

        <!-- 交易類型 -->
        <div class="form-group">
          <label for="txn-type">交易類型 <span class="required">*</span></label>
          <select 
            id="txn-type"
            v-model="form.txn_type" 
            @change="calcTotal"
            :aria-invalid="errors.txn_type ? 'true' : 'false'"
          >
            <option value="BUY">買入 (BUY)</option>
            <option value="SELL">賣出 (SELL)</option>
            <option value="DIV">股息 (DIV)</option>
          </select>
          <span v-if="errors.txn_type" class="error-text">{{ errors.txn_type }}</span>
        </div>

        <!-- 股數 -->
        <div class="form-group">
          <label for="qty">股數 <span class="required">*</span></label>
          <input 
            id="qty"
            v-model="form.qty" 
            type="number" 
            step="0.01"
            min="0"
            placeholder="0.00"
            @input="calcTotal"
            required
            :aria-invalid="errors.qty ? 'true' : 'false'"
            aria-describedby="qty-error"
          >
          <span v-if="errors.qty" id="qty-error" class="error-text">{{ errors.qty }}</span>
        </div>

        <!-- 單價 -->
        <div class="form-group">
          <label for="price">單價 (平均成本) <span class="required">*</span></label>
          <input 
            id="price"
            v-model="form.price" 
            type="number" 
            step="0.01"
            min="0"
            placeholder="0.00"
            @input="calcTotal"
            required
            :aria-invalid="errors.price ? 'true' : 'false'"
            aria-describedby="price-error"
          >
          <span v-if="errors.price" id="price-error" class="error-text">{{ errors.price }}</span>
        </div>

        <!-- 手續費 -->
        <div class="form-group">
          <label for="fee">手續費 (Fee)</label>
          <input 
            id="fee"
            v-model="form.fee" 
            type="number" 
            step="0.01"
            min="0"
            placeholder="0.00"
            @input="calcTotal"
          >
        </div>

        <!-- 交易稅 -->
        <div class="form-group">
          <label for="tax">交易稅 (Tax)</label>
          <input 
            id="tax"
            v-model="form.tax" 
            type="number" 
            step="0.01"
            min="0"
            placeholder="0.00"
            @input="calcTotal"
          >
        </div>

        <!-- 交易總額 -->
        <div class="form-group">
          <label for="total">交易總額 (Total)</label>
          <input 
            id="total"
            v-model="form.total_amount" 
            type="number" 
            step="0.01"
            placeholder="自動計算"
            @input="calcPrice"
            aria-describedby="total-hint"
          >
          <span id="total-hint" class="hint-text">輸入總額可反推單價</span>
        </div>
      </div>

      <!-- 提交按鈕 -->
      <div class="form-actions">
        <button 
          type="submit" 
          class="btn btn-primary btn-lg"
          :disabled="loading || !isFormValid"
          :aria-busy="loading"
        >
          <span v-if="!loading">{{ isEditing ? '✓ 更新' : '+ 新增' }}</span>
          <span v-else class="loading-spinner">
            <span class="spinner-icon">⟳</span>
            <span>處理中...</span>
          </span>
        </button>
      </div>

      <!-- 成功/錯誤消息 -->
      <div v-if="submitError" class="alert alert-error" role="alert">
        {{ submitError }}
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const auth = useAuthStore();

const loading = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const submitError = ref('');

const form = reactive({
  txn_date: new Date().toISOString().split('T')[0],
  symbol: '',
  txn_type: 'BUY',
  qty: '',
  price: '',
  fee: 0,
  tax: 0,
  total_amount: ''
});

const errors = reactive({
  txn_date: '',
  symbol: '',
  txn_type: '',
  qty: '',
  price: ''
});

// 表單驗證
const validateForm = () => {
  errors.txn_date = '';
  errors.symbol = '';
  errors.txn_type = '';
  errors.qty = '';
  errors.price = '';

  if (!form.txn_date) {
    errors.txn_date = '請選擇日期';
  }

  if (!form.symbol || form.symbol.trim() === '') {
    errors.symbol = '請輸入股票代碼';
  } else if (form.symbol.length > 10) {
    errors.symbol = '股票代碼不超過10個字符';
  }

  if (!form.txn_type) {
    errors.txn_type = '請選擇交易類型';
  }

  const qty = parseFloat(form.qty);
  if (!form.qty || isNaN(qty) || qty <= 0) {
    errors.qty = '請輸入有效的股數 (必須大於0)';
  }

  const price = parseFloat(form.price);
  if (!form.price || isNaN(price) || price <= 0) {
    errors.price = '請輸入有效的單價 (必須大於0)';
  }

  return Object.values(errors).every(e => e === '');
};

const isFormValid = computed(() => {
  return form.symbol && form.qty && form.price && 
         !errors.symbol && !errors.qty && !errors.price;
});

// 計算邏輯：輸入股數/單價 -> 算總額
const calcTotal = () => {
  const qty = parseFloat(form.qty) || 0;
  const price = parseFloat(form.price) || 0;
  const fee = parseFloat(form.fee) || 0;
  const tax = parseFloat(form.tax) || 0;
  const base = qty * price;

  if (form.txn_type === 'BUY') {
    form.total_amount = parseFloat((base + fee + tax).toFixed(2));
  } else if (form.txn_type === 'SELL') {
    form.total_amount = parseFloat((base - fee - tax).toFixed(2));
  } else if (form.txn_type === 'DIV') {
    form.total_amount = parseFloat((base - tax).toFixed(2));
  }
};

// 計算邏輯：輸入總額 -> 反推單價
const calcPrice = () => {
  const qty = parseFloat(form.qty) || 0;
  const total = parseFloat(form.total_amount) || 0;
  const fee = parseFloat(form.fee) || 0;
  const tax = parseFloat(form.tax) || 0;

  if (qty <= 0) return;

  if (form.txn_type === 'BUY') {
    form.price = parseFloat(((total - fee - tax) / qty).toFixed(4));
  } else if (form.txn_type === 'SELL') {
    form.price = parseFloat(((total + fee + tax) / qty).toFixed(4));
  } else {
    form.price = parseFloat(((total + tax) / qty).toFixed(4));
  }
};

// 提交表單
const submit = async () => {
  submitError.value = '';

  if (!validateForm()) {
    submitError.value = '請修正表單中的錯誤';
    return;
  }

  loading.value = true;

  try {
    const method = isEditing.value ? 'PUT' : 'POST';
    const payload = {
      ...form,
      qty: parseFloat(form.qty),
      price: parseFloat(form.price),
      fee: parseFloat(form.fee || 0),
      tax: parseFloat(form.tax || 0)
    };

    if (isEditing.value) {
      payload.id = editingId.value;
    }

    const response = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
      method,
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {
      resetForm();
      await store.fetchRecords();
    } else {
      submitError.value = `操作失敗: ${data.error || '未知錯誤'}`;
    }
  } catch (error) {
    submitError.value = `連線錯誤: ${error.message}`;
    console.error('Form submission error:', error);
  } finally {
    loading.value = false;
  }
};

// 重置表單
const resetForm = () => {
  isEditing.value = false;
  editingId.value = null;
  form.txn_date = new Date().toISOString().split('T')[0];
  form.symbol = '';
  form.qty = '';
  form.price = '';
  form.fee = 0;
  form.tax = 0;
  form.total_amount = '';
  form.txn_type = 'BUY';
  submitError.value = '';
  Object.keys(errors).forEach(key => errors[key] = '');
};

// 暴露給父組件的方法
const setupForm = (record) => {
  isEditing.value = true;
  editingId.value = record.id;
  form.txn_date = record.txn_date;
  form.symbol = record.symbol;
  form.txn_type = record.txn_type;
  form.qty = record.qty;
  form.price = record.price;
  form.fee = record.fee || 0;
  form.tax = record.tax || 0;
  calcTotal();
};

defineExpose({ setupForm });
</script>

<style scoped>
.form-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border);
}

.form-header h3 {
  margin: 0;
  color: var(--text);
  font-size: 1.1rem;
}

.trade-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-weight: 600;
  color: var(--text);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

.required {
  color: var(--error-light);
  font-size: 1.2em;
  line-height: 1;
}

.form-group input,
.form-group select {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 200ms ease;
}

.form-group input::placeholder,
.form-group select::placeholder {
  color: var(--text-muted);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(31, 110, 251, 0.1);
  background: var(--card-bg);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg);
}

.form-group input[aria-invalid="true"],
.form-group select[aria-invalid="true"] {
  border-color: var(--error-light);
  box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.1);
}

.hint-text {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.error-text {
  font-size: 0.85rem;
  color: var(--error-light);
  animation: slideDown 200ms ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-actions {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-dark, var(--primary));
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(31, 110, 251, 0.3);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(31, 110, 251, 0.2);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-lg {
  padding: 12px 24px;
  font-size: 1rem;
  width: 100%;
}

.btn-secondary {
  background: var(--border);
  color: var(--text);
}

.btn-secondary:hover {
  background: var(--text-muted);
  color: white;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.loading-spinner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.spinner-icon {
  display: inline-block;
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.alert {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  margin-top: var(--space-md);
  animation: slideDown 200ms ease-out;
}

.alert-error {
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid var(--error-light);
  color: var(--error-light);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }
}
</style>
