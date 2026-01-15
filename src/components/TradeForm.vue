<template>
  <div class="trade-form-card">
    <div class="card-header">
      <h3>新增交易紀錄</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <form @submit.prevent="handleSubmit" class="form-body">
      <div class="form-row">
        <div class="form-group">
          <label>日期</label>
          <input type="date" v-model="formData.date" required />
        </div>
        <div class="form-group">
          <label>交易類型</label>
          <div class="type-selector">
            <button 
              type="button" 
              :class="{ active: formData.type === 'BUY' }" 
              @click="setTxType('BUY')"
            >買入</button>
            <button 
              type="button" 
              :class="{ active: formData.type === 'SELL' }" 
              @click="setTxType('SELL')"
            >賣出</button>
            <button 
              type="button" 
              :class="{ active: formData.type === 'DIV' }" 
              @click="setTxType('DIV')"
            >配息</button>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>股票代號 (Symbol)</label>
        <input 
          type="text" 
          v-model="formData.symbol" 
          @input="handleSymbolInput" 
          placeholder="e.g. AAPL" 
          required 
          class="symbol-input"
        />
        <div class="symbol-status" v-if="formData.symbol && holdingSummary">
           <span class="badge info">目前持倉: {{ holdingSummary.qty }} 股</span>
           <span class="badge warning" v-if="formData.type === 'SELL' && formData.qty > holdingSummary.qty">
             庫存不足
           </span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>{{ formData.type === 'DIV' ? '持有股數' : '股數 (Qty)' }}</label>
          <input type="number" v-model.number="formData.qty" step="any" required min="0.0001" />
        </div>
        <div class="form-group">
          <label>{{ formData.type === 'DIV' ? '配息總額 (Net)' : '單價 (Price)' }}</label>
          <input type="number" v-model.number="formData.price" step="any" required min="0" />
        </div>
      </div>

      <div class="form-row" v-if="formData.type !== 'DIV'">
        <div class="form-group">
          <label>手續費</label>
          <input type="number" v-model.number="formData.commission" step="any" min="0" />
        </div>
        <div class="form-group">
          <label>稅金 (Tax)</label>
          <input type="number" v-model.number="formData.tax" step="any" min="0" />
        </div>
      </div>

      <div class="form-group tag-section">
        <label>
          群組歸屬 (Tags)
          <span class="hint" v-if="formData.type === 'SELL'">* 賣出請勾選要扣抵的庫存群組</span>
        </label>
        
        <div v-if="formData.type === 'SELL'" class="inventory-panel">
          <div v-if="holdingsDistribution.length === 0" class="no-stock-warning">
            ⚠️ 此股票目前無庫存，無法指定群組賣出 (將視為放空或總帳調整)
          </div>
          
          <div 
            v-for="item in holdingsDistribution" 
            :key="item.groupId" 
            class="inventory-item"
            :class="{ selected: selectedTags.includes(item.groupId) }"
            @click="toggleTag(item.groupId)"
          >
            <div class="checkbox">
              {{ selectedTags.includes(item.groupId) ? '☑' : '☐' }}
            </div>
            <div class="group-info">
              <span class="g-name" :style="{ color: item.color }">{{ item.groupName }}</span>
              <span class="g-qty">庫存: {{ item.qty }}</span>
            </div>
          </div>
        </div>

        <div v-else class="tag-selector">
          <div class="available-tags">
            <span 
              v-for="group in portfolioStore.availableGroups" 
              :key="group.id"
              class="tag-chip"
              :class="{ active: selectedTags.includes(group.id) }"
              :style="selectedTags.includes(group.id) ? { backgroundColor: group.color, borderColor: group.color } : { borderColor: group.color, color: group.color }"
              @click="toggleTag(group.id)"
            >
              {{ group.name }}
            </span>
          </div>
          
          <input 
            type="text" 
            v-model="newTagInput" 
            @keydown.enter.prevent="addNewTag"
            @blur="addNewTag"
            placeholder="+ 新增標籤 (Enter)" 
            class="new-tag-input"
          />
        </div>
        
        <input type="hidden" :value="formData.tag">
      </div>

      <div class="form-actions">
        <div class="total-estimate" v-if="formData.qty && formData.price">
          總額: {{ formatCurrency(estimatedTotal) }}
        </div>
        <button type="submit" class="btn-submit" :disabled="isSubmitting">
          {{ isSubmitting ? '儲存中...' : '確認新增' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { createTransaction } from '../js/api'; // 假設 API 方法路徑

const props = defineProps(['initialData']);
const emit = defineEmits(['close', 'submit-success']);

const portfolioStore = usePortfolioStore();
const toast = useToast();

const isSubmitting = ref(false);
const newTagInput = ref('');
const selectedTags = ref([]); // 用於 UI 互動的標籤陣列

// 表單資料初始化
const formData = reactive({
  date: new Date().toISOString().split('T')[0],
  type: 'BUY',
  symbol: '',
  qty: '',
  price: '',
  commission: 0,
  tax: 0,
  tag: '' // 最終傳給後端的字串 (逗號分隔)
});

// --- Computed & Helpers ---

// 計算預估總金額
const estimatedTotal = computed(() => {
  const base = (formData.qty || 0) * (formData.price || 0);
  if (formData.type === 'BUY') return base + (formData.commission || 0) + (formData.tax || 0);
  if (formData.type === 'SELL') return base - (formData.commission || 0) - (formData.tax || 0);
  return base; // DIV
});

// 查詢總持倉摘要 (不分群組)
const holdingSummary = computed(() => {
  if (!formData.symbol) return null;
  // 從 ALL 群組找總持倉
  const allGroup = portfolioStore.rawSnapshot?.groups?.['ALL'];
  if (!allGroup) return null;
  return allGroup.holdings.find(h => h.symbol === formData.symbol);
});

// 【關鍵】取得該股票在各群組的庫存分佈 (賣出防呆用)
const holdingsDistribution = computed(() => {
  if (!formData.symbol) return [];
  // 呼叫 Store 的 Helper Getter
  return portfolioStore.getHoldingsDistribution(formData.symbol);
});

// --- Methods ---

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

const handleSymbolInput = () => {
  formData.symbol = formData.symbol.toUpperCase();
};

const setTxType = (type) => {
  formData.type = type;
  // 切換類型時，重置標籤選擇，避免混淆
  selectedTags.value = []; 
  
  // UX 優化：如果是賣出，且只有一個群組有庫存，是否自動幫他選？
  // 根據 "Logic B (Force Manual)"，我們不自動選，讓使用者自己點，比較保險。
};

const toggleTag = (tagId) => {
  const index = selectedTags.value.indexOf(tagId);
  if (index === -1) {
    selectedTags.value.push(tagId);
  } else {
    selectedTags.value.splice(index, 1);
  }
};

const addNewTag = () => {
  const val = newTagInput.value.trim();
  if (val && !selectedTags.value.includes(val)) {
    selectedTags.value.push(val);
  }
  newTagInput.value = '';
};

// 監聽 selectedTags 變動，同步回 formData.tag
watch(selectedTags, (newTags) => {
  formData.tag = newTags.join(',');
}, { deep: true });

// 監聽 Symbol 變動，若是賣出模式，重新檢查庫存 (可選)
watch(() => formData.symbol, () => {
  if (formData.type === 'SELL') {
    selectedTags.value = []; // 換股票了，清空已選標籤
  }
});

const handleSubmit = async () => {
  if (isSubmitting.value) return;
  
  // 賣出防呆檢查
  if (formData.type === 'SELL') {
    // 如果有庫存但沒選標籤 -> 警告
    if (holdingsDistribution.value.length > 0 && selectedTags.value.length === 0) {
      if (!confirm('⚠️ 您尚未選擇要扣抵的群組。\n\n這將會導致「總帳」庫存減少，但「子群組」庫存不變 (可能導致數據不一致)。\n\n確定要繼續嗎？')) {
        return;
      }
    }
  }

  isSubmitting.value = true;
  try {
    // 呼叫 API 新增交易
    await createTransaction(formData);
    
    toast.success('交易新增成功！');
    emit('submit-success');
    emit('close');
    
    // 觸發 Store 更新 (雖然 Phase 2 後端計算可能需要幾秒，但先觸發)
    portfolioStore.refresh();
    
  } catch (error) {
    console.error(error);
    toast.error('新增失敗: ' + (error.message || '未知錯誤'));
  } finally {
    isSubmitting.value = false;
  }
};

// 初始化
onMounted(() => {
  if (props.initialData) {
    Object.assign(formData, props.initialData);
    if (formData.tag) {
      selectedTags.value = formData.tag.split(',').filter(t => t);
    }
  }
});
</script>

<style scoped>
.trade-form-card {
  background: var(--card-bg, #25252b);
  border: 1px solid #444;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-header {
  padding: 16px 20px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 { margin: 0; color: #fff; font-size: 1.1rem; }
.close-btn { background: none; border: none; color: #888; font-size: 1.5rem; cursor: pointer; }

.form-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 0.85rem;
  color: #aaa;
}

.hint {
  font-size: 0.75rem;
  color: #ff9800;
  margin-left: 8px;
}

input {
  background: #1a1a1e;
  border: 1px solid #333;
  padding: 10px;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #40a9ff;
}

/* 類型選擇器 */
.type-selector {
  display: flex;
  background: #1a1a1e;
  border-radius: 6px;
  padding: 2px;
  border: 1px solid #333;
}

.type-selector button {
  flex: 1;
  background: none;
  border: none;
  color: #888;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.type-selector button.active {
  background: #40a9ff;
  color: white;
  font-weight: bold;
}

.symbol-input {
  text-transform: uppercase;
  font-weight: bold;
  letter-spacing: 1px;
}

.symbol-status {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
}
.badge.info { background: #333; color: #ccc; }
.badge.warning { background: #5a1e1e; color: #ff6b6b; }

/* --- 標籤與庫存面板樣式 --- */
.tag-section {
  background: rgba(0,0,0,0.2);
  padding: 12px;
  border-radius: 8px;
  border: 1px dashed #444;
}

/* 賣出庫存面板 */
.inventory-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.no-stock-warning {
  color: #888;
  font-style: italic;
  font-size: 0.85rem;
  text-align: center;
  padding: 10px;
}

.inventory-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: #2a2a30;
  border: 1px solid #333;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.inventory-item:hover {
  background: #303036;
}

.inventory-item.selected {
  border-color: #40a9ff;
  background: rgba(64, 169, 255, 0.1);
}

.checkbox {
  font-size: 1.2rem;
  color: #666;
}
.inventory-item.selected .checkbox {
  color: #40a9ff;
}

.group-info {
  display: flex;
  justify-content: space-between;
  flex: 1;
  font-size: 0.95rem;
}

.g-name { font-weight: 500; }
.g-qty { color: #888; font-family: monospace; }

/* 買入標籤選擇器 */
.tag-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.tag-chip {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  cursor: pointer;
  border: 1px solid transparent;
  background: rgba(255,255,255,0.05);
  transition: all 0.2s;
}

.tag-chip.active {
  color: white !important;
  font-weight: 500;
}

.new-tag-input {
  flex: 1;
  min-width: 120px;
  background: transparent;
  border: none;
  border-bottom: 1px solid #444;
  border-radius: 0;
  padding: 4px;
  font-size: 0.9rem;
}

/* --- 底部按鈕 --- */
.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.total-estimate {
  font-size: 0.9rem;
  color: #40a9ff;
  font-weight: bold;
}

.btn-submit {
  background: #40a9ff;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
  margin-left: auto; /* 若 total-estimate 隱藏，靠右對齊 */
}

.btn-submit:disabled {
  background: #555;
  cursor: not-allowed;
}

.btn-submit:hover:not(:disabled) {
  background: #2e90e8;
}
</style>
