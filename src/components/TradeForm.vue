<template>
  <div class="card trade-panel" id="trade-form-anchor">
    <div class="panel-header">
      <h3 class="panel-title">{{ isEditing ? '編輯交易' : '快速下單' }}</h3>
      <button v-if="isEditing" class="btn-close-edit" @click="resetForm" title="取消編輯">✕</button>
    </div>
    
    <div class="trade-type-switch">
        <button v-for="t in ['BUY', 'SELL', 'DIV']" :key="t"
            :class="['switch-btn', t.toLowerCase(), { active: form.txn_type === t }]"
            @click="setTxnType(t)">
            <span class="icon">{{ t === 'BUY' ? '📥' : t === 'SELL' ? '📤' : '💰' }}</span>
            {{ t === 'BUY' ? '買進' : t === 'SELL' ? '賣出' : '股息' }}
        </button>
    </div>

    <div class="form-grid">
        <div class="form-group full">
            <label>交易標的 (Symbol)</label>
            <div class="input-wrapper">
                <input 
                    type="text" 
                    v-model="form.symbol" 
                    @change="checkHoldings" 
                    placeholder="輸入代碼 (如 NVDA)" 
                    :disabled="isEditing" 
                    class="input-lg uppercase"
                >
            </div>
        </div>
        
        <div class="form-group full">
            <label>策略群組 (Groups)</label>
            
            <div v-if="form.txn_type === 'SELL' && holdingGroups.length > 0" class="smart-sell-options">
                <div class="hint-header">
                    <span class="hint-icon">⚠️</span>
                    <span class="hint-text">偵測到現有持倉，請勾選要賣出的部位：</span>
                </div>
                <div class="checkbox-group">
                    <label v-for="g in holdingGroups" :key="g" class="tag-checkbox">
                        <input type="checkbox" :value="g" v-model="selectedSellGroups" @change="updateTagsFromCheckboxes">
                        <span class="checkbox-custom"></span>
                        <span class="tag-name">{{ g }}</span>
                    </label>
                </div>
            </div>
            
            <div class="tag-input-container" :class="{ disabled: form.txn_type === 'SELL' && holdingGroups.length > 0 }">
                <div class="tags-list">
                    <span v-for="(tag, idx) in tagsArray" :key="idx" class="tag-chip">
                        {{ tag }}
                        <span class="remove-tag" @click="removeTag(idx)">×</span>
                    </span>
                    <input 
                        type="text" 
                        v-model="tagInput" 
                        @keydown.enter.prevent="addTag"
                        @keydown.tab.prevent="addTag"
                        @blur="addTag"
                        placeholder="輸入標籤..."
                        class="tag-input-field"
                        :disabled="form.txn_type === 'SELL' && holdingGroups.length > 0"
                    >
                </div>
            </div>
            
            <div class="quick-tags" v-if="form.txn_type !== 'SELL' || holdingGroups.length === 0">
                <span v-for="t in commonTags" :key="t" @click="pushTag(t)" class="quick-tag">+ {{ t }}</span>
            </div>
        </div>
        
        <div class="form-group">
            <label>日期</label>
            <input type="date" v-model="form.txn_date" class="input-md">
        </div>
        
        <div class="form-group">
            <label>成交單價 (USD)</label>
            <input 
                type="number" 
                v-model="form.price" 
                placeholder="0.00" 
                class="input-md" 
                step="0.0001"
                inputmode="decimal"
            >
        </div>

        <div class="form-group">
            <label>股數</label>
            <input 
                type="number" 
                v-model="form.qty" 
                @input="calcPriceFromInputs" 
                placeholder="0" 
                class="input-md" 
                step="0.0001"
                inputmode="decimal"
            >
        </div>

        <div class="form-group">
            <label>費用 (Fee / Tax)</label>
            <div class="dual-input">
                <input 
                    type="number" 
                    v-model="form.fee" 
                    @input="calcPriceFromInputs" 
                    placeholder="手續費" 
                    step="0.01"
                    inputmode="decimal"
                >
                <input 
                    type="number" 
                    v-model="form.tax" 
                    @input="calcPriceFromInputs" 
                    placeholder="稅金" 
                    step="0.01"
                    inputmode="decimal"
                >
            </div>
        </div>
    </div>

    <div class="summary-box">
        <div class="summary-label">交易總金額 (USD)</div>
        <div class="summary-input-wrapper">
             <span class="currency-symbol">$</span>
             <input 
                type="number" 
                v-model="form.total_amount" 
                @input="calcPriceFromInputs" 
                class="summary-value" 
                step="0.01" 
                placeholder="0.00"
                inputmode="decimal"
            >
        </div>
    </div>
    
    <div class="action-buttons">
        <button v-if="isEditing" @click="resetForm" class="btn btn-cancel">取消</button>
        <button 
            class="btn btn-submit" 
            @click="submit" 
            :disabled="loading" 
            :class="form.txn_type.toLowerCase()"
        >
            <span v-if="loading" class="spinner"></span>
            {{ loading ? '處理中...' : (isEditing ? '更新交易' : '送出委託') }}
        </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';

const store = usePortfolioStore();
const auth = useAuthStore();
const { addToast } = useToast();

const loading = ref(false);
const isEditing = ref(false);
const editingId = ref(null);

const tagInput = ref('');
const selectedSellGroups = ref([]);
const holdingGroups = ref([]);

const form = reactive({
    txn_date: new Date().toISOString().split('T')[0],
    symbol: '', 
    txn_type: 'BUY', 
    qty: '', 
    price: '', 
    fee: 0, 
    tax: 0, 
    total_amount: '',
    tag: '' 
});

const tagsArray = computed(() => {
    return (form.tag || '').split(/[,;]/).map(t=>t.trim()).filter(t=>t);
});

const commonTags = computed(() => {
    return store.availableGroups.filter(g => g !== 'all' && !tagsArray.value.includes(g));
});

const checkHoldings = () => {
    if (form.txn_type === 'SELL' && form.symbol) {
        holdingGroups.value = store.getGroupsWithHolding(form.symbol.toUpperCase());
        selectedSellGroups.value = [];
        if (isEditing.value) {
            const currentTags = (form.tag || '').split(',').map(t=>t.trim());
            selectedSellGroups.value = holdingGroups.value.filter(g => currentTags.includes(g));
        }
    } else {
        holdingGroups.value = [];
    }
};

const updateTagsFromCheckboxes = () => {
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

const removeTag = (index) => {
    const newTags = [...tagsArray.value];
    newTags.splice(index, 1);
    form.tag = newTags.join(', ');
    if (holdingGroups.value.length > 0) {
        selectedSellGroups.value = newTags.filter(t => holdingGroups.value.includes(t));
    }
};

const pushTag = (t) => {
    if (!tagsArray.value.includes(t)) {
        const newTags = [...tagsArray.value, t];
        form.tag = newTags.join(', ');
    }
};

watch(() => form.txn_type, () => checkHoldings());

const setTxnType = (type) => { 
    form.txn_type = type;
    checkHoldings();
};

const calcPriceFromInputs = () => {
    const qty = parseFloat(form.qty) || 0;
    const total = parseFloat(form.total_amount) || 0;
    const fee = parseFloat(form.fee) || 0;
    const tax = parseFloat(form.tax) || 0;
    
    // 如果使用者正在輸入總金額，反推單價
    if (qty > 0 && total > 0) {
        let avgCost = 0;
        if (form.txn_type === 'BUY') { 
            avgCost = (total - fee - tax) / qty; // 總支出扣除費用才是本金，本金除以數量 = 單價 (這裡採用反推邏輯，需視個人習慣)
            // 修正：一般券商介面 "總金額" = (股數 * 單價) + 費用
            // 所以 單價 = (總金額 - 費用) / 股數
            // 但為了簡單，這裡通常是:
            // 輸入股數、單價 -> 自動算總金額
            // 輸入股數、總金額 -> 自動算單價
             avgCost = Math.abs((total - fee - tax) / qty);
        } else {
             // 賣出：總回收 = (股數 * 單價) - 費用
             // 單價 = (總回收 + 費用) / 股數
             avgCost = Math.abs((total + fee + tax) / qty);
        }
        form.price = parseFloat(avgCost.toFixed(4));
    }
};

// 提交表單
const submit = async () => {
    if (!form.symbol || !form.qty || !form.price) { 
        addToast("請填寫完整資料 (代碼、股數、價格)", "error"); 
        return; 
    }
    
    if (form.txn_type === 'SELL' && holdingGroups.value.length > 0 && selectedSellGroups.value.length === 0) {
        addToast("請勾選要賣出的策略群組", "error");
        return;
    }
    
    if (!auth.token || auth.isTokenExpired()) {
        addToast("登入已過期，請重新登入", "error");
        setTimeout(() => auth.logout(), 2000);
        return;
    }
    
    loading.value = true;
    try {
        const payload = { ...form };
        // 確保數值型別正確
        ['qty', 'price', 'fee', 'tax', 'total_amount'].forEach(k => payload[k] = parseFloat(payload[k] || 0));
        
        let success = false;
        if (isEditing.value) {
            payload.id = editingId.value;
            success = await store.updateRecord(payload);
        } else {
            success = await store.addRecord(payload);
        }
        
        if (success) {
            resetForm(); 
            // 在手機版可選：自動關閉側邊欄 (需透過 emit 通知 App.vue，或由 App.vue 監聽 Store 變化)
        }
    } catch(e) { 
        console.error('❌ 提交錯誤:', e);
        addToast(`提交失敗: ${e.message}`, "error");
    } finally { 
        loading.value = false; 
    }
};

const resetForm = () => {
    isEditing.value = false; 
    editingId.value = null;
    form.symbol = ''; 
    form.qty = ''; 
    form.price = ''; 
    form.fee = 0; 
    form.tax = 0; 
    form.total_amount = '';
    form.tag = ''; 
    form.txn_type = 'BUY';
    holdingGroups.value = [];
    selectedSellGroups.value = [];
    tagInput.value = '';
};

const setupForm = (r) => {
    isEditing.value = true; 
    editingId.value = r.id;
    Object.keys(form).forEach(k => {
        if(r[k] !== undefined) form[k] = r[k];
    });
    // 重新觸發持倉檢查以正確顯示 Smart Sell
    checkHoldings();
};

defineExpose({ setupForm });
</script>

<style scoped>
.trade-panel { 
    border: 1px solid var(--border-color); 
    box-shadow: var(--shadow-card); 
    background: var(--bg-card); 
    padding: 24px; 
    height: 100%;
    display: flex;
    flex-direction: column;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.panel-title { 
    margin: 0; 
    font-size: 1.25rem; 
    color: var(--text-main); 
    font-weight: 700; 
    border-left: 4px solid var(--primary);
    padding-left: 12px;
}

.btn-close-edit {
    background: transparent;
    border: none;
    font-size: 1.2rem;
    color: var(--text-sub);
    cursor: pointer;
    padding: 4px;
}

/* Trade Type Switcher */
.trade-type-switch { 
    display: flex; 
    background: var(--bg-secondary); 
    padding: 4px; 
    border-radius: 12px; 
    margin-bottom: 24px; 
}

.switch-btn { 
    flex: 1; 
    border: none; 
    background: transparent; 
    padding: 10px; 
    font-weight: 500; 
    color: var(--text-sub); 
    cursor: pointer; 
    border-radius: 8px; 
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.switch-btn .icon { font-size: 1.1rem; }

.switch-btn.active { 
    background: var(--bg-card); 
    box-shadow: 0 2px 4px rgba(0,0,0,0.08); 
    color: var(--text-main); 
    font-weight: 700; 
    transform: scale(1.02);
}

.switch-btn.buy.active { color: var(--primary); border: 1px solid rgba(59, 130, 246, 0.2); }
.switch-btn.sell.active { color: var(--success); border: 1px solid rgba(16, 185, 129, 0.2); }
.switch-btn.div.active { color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.2); }

/* Form Grid */
.form-grid { 
    display: grid; 
    grid-template-columns: 1fr 1fr; 
    gap: 20px; 
    margin-bottom: 24px; 
}

.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group.full { grid-column: span 2; }

label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }

input { 
    padding: 12px; 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    font-size: 1rem; 
    width: 100%; 
    box-sizing: border-box; 
    font-family: 'JetBrains Mono', monospace; 
    transition: all 0.2s; 
    color: var(--text-main); 
    background: var(--bg-card); 
}

input:focus { 
    outline: none; 
    border-color: var(--primary); 
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); 
}

input:disabled { background: var(--bg-secondary); cursor: not-allowed; opacity: 0.7; }
.uppercase { text-transform: uppercase; }

.dual-input { display: flex; gap: 12px; }

/* Tag Input */
.tag-input-container { 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    padding: 8px; 
    background: var(--bg-card); 
    display: flex; 
    flex-wrap: wrap; 
    gap: 6px; 
    min-height: 48px; 
    transition: border 0.2s;
}

.tag-input-container:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.tag-input-container.disabled { opacity: 0.6; pointer-events: none; background: var(--bg-secondary); }

.tags-list { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; align-items: center; }

.tag-chip { 
    background: rgba(59, 130, 246, 0.1); 
    color: var(--primary); 
    padding: 4px 10px; 
    border-radius: 6px; 
    font-size: 0.9rem; 
    font-weight: 500; 
    display: flex; 
    align-items: center; 
    gap: 6px; 
}

.remove-tag { cursor: pointer; opacity: 0.6; font-weight: bold; font-size: 1.1rem; line-height: 1; }
.remove-tag:hover { opacity: 1; color: var(--danger); }

.tag-input-field { 
    border: none; 
    outline: none; 
    background: transparent; 
    flex: 1; 
    min-width: 100px; 
    padding: 4px; 
    color: var(--text-main); 
    font-family: 'Inter', sans-serif; 
    font-size: 0.95rem; 
}

.quick-tags { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
.quick-tag { 
    font-size: 0.8rem; 
    color: var(--text-sub); 
    border: 1px solid var(--border-color); 
    padding: 4px 10px; 
    border-radius: 99px; 
    cursor: pointer; 
    transition: all 0.2s; 
    background: var(--bg-card);
}
.quick-tag:hover { border-color: var(--primary); color: var(--primary); background: rgba(59, 130, 246, 0.05); }

/* Smart Sell Options */
.smart-sell-options { 
    background: rgba(245, 158, 11, 0.1); 
    border: 1px dashed var(--warning); 
    padding: 12px; 
    border-radius: 8px; 
    margin-bottom: 12px; 
}

.hint-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.hint-icon { font-size: 1.1rem; }
.hint-text { font-size: 0.9rem; color: var(--warning); font-weight: 600; }

.checkbox-group { display: flex; gap: 12px; flex-wrap: wrap; }
.tag-checkbox { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 8px; background: rgba(255,255,255,0.5); border-radius: 4px; }
.tag-checkbox input[type="checkbox"] { width: auto; margin: 0; }
.tag-name { font-size: 0.95rem; font-weight: 600; color: var(--text-main); }

/* Summary Box */
.summary-box { 
    background: var(--bg-secondary); 
    padding: 20px; 
    border-radius: 12px; 
    text-align: center; 
    margin-bottom: 24px; 
    border: 1px solid var(--border-color); 
    transition: all 0.2s;
}

.summary-box:focus-within { border-color: var(--primary); background: rgba(59, 130, 246, 0.05); }

.summary-label { font-size: 0.9rem; color: var(--text-sub); margin-bottom: 4px; font-weight: 600; text-transform: uppercase; }
.summary-input-wrapper { display: flex; align-items: center; justify-content: center; gap: 4px; }
.currency-symbol { font-size: 1.5rem; color: var(--text-sub); font-weight: 500; }
.summary-value { 
    background: transparent; 
    border: none; 
    text-align: center; 
    font-size: 2rem; 
    font-weight: 700; 
    color: var(--text-main); 
    padding: 0; 
    width: 200px;
}

/* Action Buttons */
.action-buttons { display: flex; gap: 16px; margin-top: auto; }
.btn { 
    flex: 1; 
    padding: 14px; 
    border: none; 
    border-radius: 10px; 
    font-weight: 600; 
    cursor: pointer; 
    transition: all 0.2s; 
    font-size: 1rem; 
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.btn-cancel { background: var(--bg-secondary); color: var(--text-sub); border: 1px solid var(--border-color); }
.btn-cancel:hover { background: var(--border-color); color: var(--text-main); }

.btn-submit { color: white; background: var(--primary); box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2); }
.btn-submit.buy { background: var(--primary); }
.btn-submit.sell { background: var(--success); box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2); }
.btn-submit.div { background: var(--warning); box-shadow: 0 4px 6px rgba(245, 158, 11, 0.2); }

.btn-submit:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }

.spinner {
    width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); 
    border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Mobile Responsive */
@media (max-width: 640px) {
    .trade-panel { padding: 20px; border: none; box-shadow: none; background: transparent; }
    .form-grid { grid-template-columns: 1fr; gap: 16px; }
    .form-group.full { grid-column: auto; }
    .summary-value { font-size: 1.8rem; width: 100%; }
}
</style>
