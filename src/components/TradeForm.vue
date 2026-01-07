<template>
  <div class="form-section card">
    <div class="form-header">
      <h2>{{ isEditMode ? '編輯交易' : '新增交易' }}</h2>
      <button
        v-if="isEditMode"
        class="btn btn-secondary btn-sm"
        @click="resetForm"
      >
        新增
      </button>
    </div>

    <form @submit.prevent="submitForm" class="trade-form">
      <div class="form-grid">
        <div class="form-group">
          <label for="ticker">股票代碼 <span class="required">*</span></label>
          <input
            id="ticker"
            v-model="form.ticker"
            type="text"
            placeholder="例如: AAPL"
            class="form-input"
            :class="{ 'input-error': errors.ticker }"
            @blur="validateField('ticker')"
          />
          <span v-if="errors.ticker" class="error-text">{{ errors.ticker }}</span>
        </div>

        <div class="form-group">
          <label for="type">交易類型 <span class="required">*</span></label>
          <select
            id="type"
            v-model="form.type"
            class="form-input"
            :class="{ 'input-error': errors.type }"
            @change="validateField('type')"
          >
            <option value="">-- 選擇 --</option>
            <option value="BUY">買入</option>
            <option value="SELL">賣出</option>
            <option value="DIV">配息</option>
          </select>
          <span v-if="errors.type" class="error-text">{{ errors.type }}</span>
        </div>

        <div class="form-group">
          <label for="date">交易日期 <span class="required">*</span></label>
          <input
            id="date"
            v-model="form.date"
            type="date"
            class="form-input"
            :class="{ 'input-error': errors.date }"
            @change="validateField('date')"
          />
          <span v-if="errors.date" class="error-text">{{ errors.date }}</span>
        </div>

        <div class="form-group">
          <label for="quantity">股數 <span class="required">*</span></label>
          <input
            id="quantity"
            v-model.number="form.quantity"
            type="number"
            placeholder="0"
            step="0.01"
            class="form-input"
            :class="{ 'input-error': errors.quantity }"
            @blur="validateField('quantity')"
          />
          <span v-if="errors.quantity" class="error-text">{{ errors.quantity }}</span>
        </div>

        <div class="form-group">
          <label for="price">單價 (USD) <span class="required">*</span></label>
          <input
            id="price"
            v-model.number="form.price"
            type="number"
            placeholder="0.00"
            step="0.01"
            class="form-input"
            :class="{ 'input-error': errors.price }"
            @blur="validateField('price')"
          />
          <span v-if="errors.price" class="error-text">{{ errors.price }}</span>
        </div>

        <div class="form-group">
          <label for="fee">費用 (USD)</label>
          <input
            id="fee"
            v-model.number="form.fee"
            type="number"
            placeholder="0.00"
            step="0.01"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="tag">標籤</label>
          <input
            id="tag"
            v-model="form.tag"
            type="text"
            placeholder="例如: 科技股"
            class="form-input"
          />
        </div>

        <div class="form-group full-width">
          <label for="note">備註</label>
          <textarea
            id="note"
            v-model="form.note"
            placeholder="輸入任何備註..."
            class="form-input form-textarea"
            rows="3"
          ></textarea>
        </div>
      </div>

      <div v-if="showPreview" class="preview-box">
        <h3>交易預覽</h3>
        <div class="preview-items">
          <div class="preview-item">
            <span class="label">總成本 (USD)</span>
            <span class="value">{{ (form.quantity * form.price + form.fee).toFixed(2) }}</span>
          </div>
          <div class="preview-item">
            <span class="label">每股成本</span>
            <span class="value">{{ form.quantity > 0 ? ((form.quantity * form.price + form.fee) / form.quantity).toFixed(2) : '0.00' }}</span>
          </div>
        </div>
      </div>

      <div class="form-footer">
        <button
          type="button"
          class="btn btn-secondary"
          @click="resetForm"
          :disabled="isSubmitting"
        >
          清除
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="isSubmitting"
        >
          <span v-if="!isSubmitting">
            {{ isEditMode ? '更新' : '新增' }}交易
          </span>
          <span v-else class="loading-spinner">⟳ 提交中...</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToastStore } from '../stores/toast';

const toastStore = useToastStore();

const form = ref({
  ticker: '',
  type: '',
  date: new Date().toISOString().split('T')[0],
  quantity: 0,
  price: 0,
  fee: 0,
  tag: '',
  note: '',
});

const errors = ref({});
const isSubmitting = ref(false);
const isEditMode = ref(false);
const editingId = ref(null);

const showPreview = computed(() => {
  return form.value.quantity > 0 && form.value.price > 0;
});

const resetForm = () => {
  form.value = {
    ticker: '',
    type: '',
    date: new Date().toISOString().split('T')[0],
    quantity: 0,
    price: 0,
    fee: 0,
    tag: '',
    note: '',
  };
  errors.value = {};
  isEditMode.value = false;
  editingId.value = null;
};

const validateField = (fieldName) => {
  const fieldValue = form.value[fieldName];

  switch (fieldName) {
    case 'ticker':
      if (!fieldValue || fieldValue.trim() === '') {
        errors.value.ticker = '股票代碼為必填';
      } else if (!/^[A-Z]{1,5}$/.test(fieldValue.toUpperCase())) {
        errors.value.ticker = '股票代碼格式不正確 (1-5 個大寫字母)';
      } else {
        delete errors.value.ticker;
      }
      break;

    case 'type':
      if (!fieldValue) {
        errors.value.type = '交易類型為必填';
      } else {
        delete errors.value.type;
      }
      break;

    case 'date':
      if (!fieldValue) {
        errors.value.date = '交易日期為必填';
      } else {
        delete errors.value.date;
      }
      break;

    case 'quantity':
      if (fieldValue <= 0) {
        errors.value.quantity = '股數必須大於 0';
      } else {
        delete errors.value.quantity;
      }
      break;

    case 'price':
      if (fieldValue <= 0) {
        errors.value.price = '單價必須大於 0';
      } else {
        delete errors.value.price;
      }
      break;
  }
};

const validateForm = () => {
  errors.value = {};
  validateField('ticker');
  validateField('type');
  validateField('date');
  validateField('quantity');
  validateField('price');
  return Object.keys(errors.value).length === 0;
};

const submitForm = async () => {
  if (!validateForm()) {
    toastStore.warning('請檢查表單內容');
    return;
  }

  isSubmitting.value = true;

  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('提交交易:', form.value);

    toastStore.success(
      isEditMode.value ? '交易已更新！' : '交易已新增！'
    );

    emit('success', isEditMode.value ? '交易已更新' : '交易已新增');
    resetForm();
  } catch (error) {
    toastStore.error('提交失敗，請重試');
    console.error('Submit error:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const setupForm = (record) => {
  isEditMode.value = true;
  editingId.value = record.id;
  form.value = {
    ticker: record.ticker || '',
    type: record.type || '',
    date: record.date || '',
    quantity: record.quantity || 0,
    price: record.price || 0,
    fee: record.fee || 0,
    tag: record.tag || '',
    note: record.note || '',
  };
};

defineExpose({ setupForm, resetForm });

const emit = defineEmits(['success']);
</script>

<style scoped>
.form-section {
  animation: fadeInUp 500ms var(--easing-ease-out) 400ms both;
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

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
  gap: var(--space-md);
}

@media (max-width: 480px) {
  .form-header {
    flex-direction: column;
    align-items: flex-start;
  }
}

.form-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text);
}

.trade-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  font-weight: 600;
  color: var(--text);
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

.required {
  color: var(--error-light);
  font-size: 1.2rem;
  line-height: 1;
}

.form-input,
.form-textarea {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 200ms ease;
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: var(--text-muted);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(31, 110, 251, 0.1);
  background: var(--card-bg);
}

.form-input:disabled,
.form-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-secondary);
}

.form-input.input-error {
  border-color: var(--error-light);
  box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.1);
}

.form-input.input-error:focus {
  border-color: var(--error-light);
  box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-textarea.input-error {
  border-color: var(--error-light);
  box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.1);
}

.error-text {
  color: var(--error-light);
  font-size: 0.85rem;
  margin-top: -4px;
  animation: slideDown 200ms ease-out;
  display: flex;
  align-items: center;
  gap: 4px;
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

.preview-box {
  background: var(--bg-secondary);
  border: 2px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  animation: slideDown 200ms ease-out;
}

.preview-box h3 {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.preview-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.preview-item .label {
  font-size: 0.85rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.preview-item .value {
  font-weight: 700;
  color: var(--primary);
  font-size: 1.1rem;
}

.form-footer {
  display: flex;
  gap: var(--space-md);
  justify-content: flex-end;
  padding-top: var(--space-md);
  border-top: 1px solid var(--border);
}

@media (max-width: 480px) {
  .form-footer {
    flex-direction: column;
    gap: var(--space-sm);
  }

  .form-footer .btn {
    width: 100%;
  }
}

.loading-spinner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
