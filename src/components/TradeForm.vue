<template>
  <div class="card trade-panel" id="trade-form-anchor">
    <div class="card-header">
      <h3>{{ isEditing ? '編輯交易' : '新增交易' }}</h3>
      <button v-if="isEditing" @click="resetForm" class="btn-text">取消編輯</button>
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label>類型</label>
        <select v-model="form.txn_type" :disabled="isEditing" class="input-lg">
          <option value="BUY">買入 (Buy)</option>
          <option value="SELL">賣出 (Sell)</option>
          <option value="DIV">股息 (Dividend)</option>
        </select>
      </div>

      <div class="form-group">
        <label>日期</label>
        <input type="date" v-model="form.txn_date" class="input-lg">
      </div>

      <div class="form-group full">
        <label>交易標的</label>
        <input 
            type="text" 
            v-model="form.symbol" 
            @input="form.symbol = form.symbol.toUpperCase()"
            @change="checkHoldings" 
            placeholder="輸入代碼 (如 NVDA)" 
            :disabled="isEditing" 
            class="input-lg uppercase"
        >
      </div>

      <div class="form-group">
        <label>股數 (Qty)</label>
        <input type="number" v-model.number="form.qty" step="any" class="input-lg">
      </div>

      <div class="form-group">
        <label>單價 (Price)</label>
        <input type="number" v-model.number="form.price" step="any" class="input-lg">
      </div>

      <div class="form-group">
        <label>手續費</label>
        <input type="number" v-model.number="form.commission" step="any">
      </div>
      <div class="form-group">
        <label>稅金</label>
        <input type="number" v-model.number="form.tax" step="any">
      </div>

      <div class="form-group full">
        <label>策略群組 (Tags)</label>
        
        <div v-if="form.txn_type === 'SELL' && form.symbol" class="smart-sell-panel">
            <div v-if="holdingDistribution.length > 0">
                <p class="hint-text">⚠️ 持倉分佈檢測：請勾選要同步賣出的群組視圖</p>
                <div class="position-list">
                    <label 
                        v-for="pos in holdingDistribution" 
                        :key="pos.group" 
                        class="position-item"
                        :class="{ selected: selectedSellGroups.includes(pos.group) }"
                    >
                        <input 
                            type="checkbox" 
                            :value="pos.group" 
                            v-model="selectedSellGroups"
                            @change="updateTagsFromSelection"
                        >
                        <div class="pos-info">
                            <span class="pos-group">{{ pos.group }}</span>
                            <span class="pos-detail">現有持倉: {{ pos.qty }} 股</span>
                        </div>
                    </label>
                </div>
                <p class="sub-hint">※ 勾選多個群組代表此筆賣出動作將同時記錄於這些群組中。</p>
            </div>
            <div v-else class="warning-box">
                <span class="icon">🚫</span>
                <span>系統查無此標的庫存，這將是一筆「賣空 (Short)」交易。</span>
            </div>
        </div>

        <div class="tag-input-wrapper" :class="{ disabled: form.txn_type === 'SELL' && holdingDistribution.length > 0 }">
            <div class="current-tags">
                <span v-for="t in tagsArray" :key="t" class="tag-chip">
                    {{ t }}
                    <span class="remove" @click="removeTag(t)" v-if="!(form.txn_type === 'SELL' && holdingDistribution.length > 0)">×</span>
                </span>
            </div>
            
            <div class="tag-controls" v-if="!(form.txn_type === 'SELL' && holdingDistribution.length > 0)">
                <input 
                    v-model="tagInput" 
                    @keydown.enter.prevent="addTag" 
                    placeholder="輸入新標籤..." 
                    class="tag-input"
                >
                <div class="quick-tags">
                    <span 
                        v-for="g in suggestedGroups" 
                        :key="g" 
                        class="quick-tag-chip"
                        @click="pushTag(g)"
                    >
                        + {{ g }}
                    </span>
                </div>
            </div>
        </div>
      </div>
    </div>

    <div class="form-actions">
        <div class="total-display">
            總金額: <span>{{ formatCurrency(calculatedTotal) }}</span>
        </div>
        <button @click="submit" :disabled="loading" class="btn-submit">
            {{ loading ? '處理中...' : (isEditing ? '更新紀錄' : '新增紀錄') }}
        </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';

// Props & Emits (若無外部傳入可保持空)
const props = defineProps(['initialData']);
const emit = defineEmits(['submit']);

const store = usePortfolioStore();
const { addToast } = useToast();

const loading = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const tagInput = ref('');

// 狀態管理：賣出邏輯專用
const selectedSellGroups = ref([]);
const holdingDistribution = ref([]);

const form = reactive({
    txn_date: new Date().toISOString().split('T')[0],
    symbol: '',
    txn_type: 'BUY',
    qty: '',
    price: '',
    commission: 0,
    tax: 0,
    tag: ''
});

// --- Computeds ---

// 解析當前 tag 字串為陣列
const tagsArray = computed(() => form.tag ? form.tag.split(',').map(t => t.trim()).filter(t=>t) : []);

// 計算總金額 (預覽用)
const calculatedTotal = computed(() => {
    const amt = (parseFloat(form.qty) || 0) * (parseFloat(form.price) || 0);
    const comm = (parseFloat(form.commission) || 0);
    const tax = (parseFloat(form.tax) || 0);
    
    if (form.txn_type === 'BUY') return amt + comm + tax;
    if (form.txn_type === 'SELL') return amt - comm - tax;
    return amt; // DIV
});

// 建議群組 (排除已選的與 'all')
const suggestedGroups = computed(() => {
    return store.availableGroups
        .filter(g => g !== 'all' && !tagsArray.value.includes(g))
        .sort();
});

// --- Methods: 標籤管理 ---

// 檢查持倉分佈 (當 Symbol 變動或切換至 Sell 時觸發)
const checkHoldings = () => {
    if (form.txn_type === 'SELL' && form.symbol) {
        holdingDistribution.value = store.getHoldingDistribution(form.symbol.toUpperCase());
        
        // 編輯模式下，嘗試回填 checkbox
        if (isEditing.value) {
            // 找出哪些群組在當前的 tag 中
            const currentTags = tagsArray.value;
            selectedSellGroups.value = holdingDistribution.value
                .map(h => h.group)
                .filter(g => currentTags.includes(g));
                
            // 若有不在 holdingDistribution 中的 tag (例如已清倉)，也應該保留
            const extraTags = currentTags.filter(t => !holdingDistribution.value.some(h => h.group === t));
            // 這裡視需求決定是否要顯示額外的 tag，目前簡化處理
        } else {
            selectedSellGroups.value = []; // 新增模式預設不勾選，強迫使用者確認
            form.tag = ''; 
        }
    } else {
        holdingDistribution.value = [];
        selectedSellGroups.value = [];
    }
};

// 根據 Checkbox 選擇更新 form.tag
const updateTagsFromSelection = () => {
    form.tag = selectedSellGroups.value.join(', ');
};

const addTag = () => {
    const val = tagInput.value.trim();
    if (val && !tagsArray.value.includes(val)) {
        const newTags = [...tagsArray.value, val];
        form.tag = newTags.join(', ');
    }
    tagInput.value = '';
};

const pushTag = (val) => {
    if (!tagsArray.value.includes(val)) {
        form.tag = [...tagsArray.value, val].join(', ');
    }
};

const removeTag = (val) => {
    const newTags = tagsArray.value.filter(t => t !== val);
    form.tag = newTags.join(', ');
    // 若在賣出模式，同步移除 checkbox
    if (form.txn_type === 'SELL') {
        selectedSellGroups.value = selectedSellGroups.value.filter(g => g !== val);
    }
};

const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

// --- Watchers ---
watch(() => form.txn_type, () => checkHoldings());

// --- Core Logic: 提交驗證 ---

const validateSubmit = () => {
    if (!form.symbol || !form.qty || !form.price) {
        addToast('請填寫完整交易資訊 (代碼、股數、價格)', 'error');
        return false;
    }

    // 賣出防呆檢核
    if (form.txn_type === 'SELL') {
        // 1. 若系統有庫存紀錄，使用者必須明確勾選
        if (holdingDistribution.value.length > 0) {
            if (selectedSellGroups.value.length === 0) {
                addToast('請勾選此筆賣出交易要同步歸屬的群組', 'error');
                return false;
            }
            
            // 2. 庫存量檢核 (防止意外超賣/Short)
            const sellQty = parseFloat(form.qty);
            for (const group of selectedSellGroups.value) {
                const holding = holdingDistribution.value.find(h => h.group === group);
                
                // 情況 A: 該群組其實沒貨 (可能是手動輸入 Tag 導致，或資料延遲)
                if (!holding) {
                     if (!confirm(`警示：群組 [${group}] 目前顯示無此股票庫存。\n您確定要對該群組記上一筆賣出嗎？（將導致負庫存）`)) {
                        return false;
                    }
                    continue;
                }

                // 情況 B: 賣出量 > 該群組持倉
                if (sellQty > holding.qty) {
                    if (!confirm(`警示：群組 [${group}] 僅持有 ${holding.qty} 股，但交易數量為 ${sellQty} 股。\n\n這將導致該群組出現負庫存 (Short Position)。\n確定要繼續嗎？`)) {
                        return false;
                    }
                }
            }
        } else {
            // 3. 該股票在所有群組完全沒有庫存
            if (!confirm(`系統查無 ${form.symbol} 在任何群組的庫存。\n\n這將是一筆全新的「賣空 (Short)」交易。\n確定要送出嗎？`)) {
                return false;
            }
        }
    }

    return true;
};

const submit = async () => {
    if (!validateSubmit()) return;
    
    loading.value = true;
    try {
        const payload = { ...form };
        
        if (isEditing.value) {
            await store.updateRecord({ id: editingId.value, ...payload });
            addToast('交易更新成功', 'success');
        } else {
            await store.addRecord(payload);
            addToast('交易新增成功', 'success');
            // 新增成功後重置表單
            resetForm(); 
        }
        
        // 觸發後端重新計算
        store.triggerUpdate();
        
    } catch (e) {
        addToast(e.message || '發生錯誤', 'error');
    } finally {
        loading.value = false;
    }
};

const resetForm = () => {
    isEditing.value = false;
    editingId.value = null;
    form.txn_date = new Date().toISOString().split('T')[0];
    form.symbol = '';
    form.qty = '';
    form.price = '';
    form.tag = '';
    form.commission = 0;
    form.tax = 0;
    selectedSellGroups.value = [];
    holdingDistribution.value = [];
    tagInput.value = '';
};

// 暴露給父層的方法 (用於 RecordList 點選編輯時呼叫)
const setupForm = (record) => {
    isEditing.value = true;
    editingId.value = record.id;
    
    // 欄位回填
    Object.keys(form).forEach(k => {
        if (record[k] !== undefined) form[k] = record[k];
    });
    
    // 初始化檢查 (會自動勾選對應的群組)
    checkHoldings();
    
    // 滾動到表單位置
    const el = document.getElementById('trade-form-anchor');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
};

defineExpose({ setupForm });
</script>

<style scoped>
.trade-panel {
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    border-radius: 12px;
    padding: 20px;
    box-shadow: var(--shadow-sm);
}

.card-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 20px;
}
.card-header h3 { margin: 0; font-size: 1.1rem; }
.btn-text { background: none; border: none; color: var(--text-sub); cursor: pointer; text-decoration: underline; }

.form-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
}
.full { grid-column: span 2; }

.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 0.85rem; color: var(--text-sub); font-weight: 500; }
.form-group input, .form-group select {
    padding: 10px; border: 1px solid var(--border-color);
    border-radius: 6px; background: var(--bg-main); color: var(--text-main);
    font-size: 0.95rem;
}
.uppercase { text-transform: uppercase; }

/* 標籤輸入區樣式 */
.tag-input-wrapper {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px;
    background: var(--bg-main);
    display: flex; flex-direction: column; gap: 8px;
}
.tag-input-wrapper.disabled { opacity: 0.7; pointer-events: none; }

.current-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag-chip {
    background: var(--primary); color: white;
    padding: 4px 10px; border-radius: 16px;
    font-size: 0.85rem; display: flex; align-items: center; gap: 6px;
}
.remove { cursor: pointer; font-weight: bold; opacity: 0.8; }
.remove:hover { opacity: 1; }

.tag-controls { display: flex; flex-direction: column; gap: 8px; }
.tag-input { border: none !important; background: transparent !important; padding: 4px !important; outline: none; }

.quick-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.quick-tag-chip {
    font-size: 0.8rem; border: 1px dashed var(--border-color); padding: 2px 8px;
    border-radius: 12px; color: var(--text-sub); cursor: pointer; transition: all 0.2s;
}
.quick-tag-chip:hover { border-color: var(--primary); color: var(--primary); }

/* 賣出智慧面板樣式 */
.smart-sell-panel {
    background: #fffbeb; 
    border: 1px solid #fcd34d;
    padding: 12px; border-radius: 8px; margin-bottom: 8px;
}
.hint-text {
    color: #92400e; font-size: 0.9rem; font-weight: bold; margin-bottom: 8px; margin-top: 0;
}
.sub-hint { font-size: 0.8rem; color: #b45309; margin-top: 8px; margin-bottom: 0; }

.position-list { display: flex; flex-direction: column; gap: 6px; }
.position-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; background: white;
    border: 1px solid #e5e7eb; border-radius: 6px;
    cursor: pointer; transition: all 0.2s;
}
.position-item:hover { background: #fff7ed; }
.position-item.selected { border-color: #f59e0b; background: #fff7ed; }

.pos-info { display: flex; flex-direction: column; }
.pos-group { font-weight: 600; font-size: 0.95rem; color: #1f2937; }
.pos-detail { font-size: 0.8rem; color: #6b7280; }

.warning-box {
    display: flex; gap: 8px; align-items: center; color: #dc2626; font-size: 0.9rem; font-weight: 500;
}

/* 底部按鈕 */
.form-actions {
    margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);
    display: flex; justify-content: space-between; align-items: center;
}
.total-display { font-size: 0.9rem; color: var(--text-sub); font-weight: 600; }
.total-display span { color: var(--text-main); font-size: 1.1rem; margin-left: 4px; }

.btn-submit {
    background: var(--primary); color: white; border: none;
    padding: 10px 24px; border-radius: 6px; font-weight: 600; cursor: pointer;
    transition: background 0.2s;
}
.btn-submit:hover { filter: brightness(1.1); }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

/* Dark Mode 適配 */
:global(.dark-mode) .smart-sell-panel {
    background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3);
}
:global(.dark-mode) .hint-text { color: #fcd34d; }
:global(.dark-mode) .sub-hint { color: #fbbf24; }
:global(.dark-mode) .position-item { background: var(--bg-main); border-color: var(--border-color); }
:global(.dark-mode) .pos-group { color: #f3f4f6; }
</style>
