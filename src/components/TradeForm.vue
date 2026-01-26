<template>
  <div class="card trade-panel" id="trade-form-anchor">
    <div class="panel-header">
      <h3 class="panel-title">
        <span class="icon">{{ isEditing ? '✏️' : '⚡' }}</span>
        {{ isEditing ? '編輯交易' : '快速下單' }}
      </h3>
      <button v-if="isEditing" class="btn-close" @click="resetForm" title="取消編輯">✕</button>
    </div>
    
    <div class="trade-type-switch">
        <button v-for="t in ['BUY', 'SELL', 'DIV']" :key="t"
            :class="['switch-btn', t.toLowerCase(), { active: form.txn_type === t }]"
            @click="setTxnType(t)">
            <span class="type-icon">{{ t === 'BUY' ? '📥' : t === 'SELL' ? '📤' : '💰' }}</span>
            {{ t === 'BUY' ? '買進' : t === 'SELL' ? '賣出' : '配息' }}
        </button>
    </div>

    <div class="form-grid">
        <div class="form-group full" :class="{ 'has-error': errors.symbol }">
            <label>交易標的</label>
            <div class="input-wrapper">
                <input 
                    type="text" 
                    v-model="form.symbol" 
                    @change="checkHoldings" 
                    placeholder="輸入代碼 (如 NVDA)" 
                    :disabled="isEditing" 
                    class="input-lg uppercase"
                    list="history-symbols"
                    @input="clearError('symbol')"
                >
                <datalist id="history-symbols">
                    <option v-for="s in historySymbols" :key="s" :value="s"></option>
                </datalist>
            </div>
            <span class="error-msg" v-if="errors.symbol">請輸入股票代碼</span>
        </div>
        
        <div class="form-group full">
            <label>策略標籤 (Groups)</label>
            
            <transition name="slide-fade">
                <div v-if="form.txn_type === 'SELL' && holdingGroups.length > 0" class="smart-sell-options">
                    <div class="hint-header">
                        <span class="hint-icon">⚠️</span>
                        <span>此標的持有於以下群組，請勾選賣出部位：</span>
                    </div>
                    <div class="checkbox-group">
                        <label v-for="g in holdingGroups" :key="g" class="tag-checkbox">
                            <input type="checkbox" :value="g" v-model="selectedSellGroups" @change="updateTagsFromCheckboxes">
                            <span class="tag-name">{{ g }}</span>
                        </label>
                    </div>
                </div>
            </transition>
            
            <div class="tag-input-container" :class="{ disabled: form.txn_type === 'SELL' && holdingGroups.length > 0 }">
                <div class="tags-list">
                    <transition-group name="list">
                        <span v-for="(tag, idx) in tagsArray" :key="tag" class="tag-chip">
                            {{ tag }}
                            <span class="remove-tag" @click="removeTag(idx)">×</span>
                        </span>
                    </transition-group>
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
            <div class="date-input-group">
                <input type="date" v-model="form.txn_date" class="input-md">
                <div class="date-shortcuts">
                    <button type="button" @click="setDate('today')" class="btn-xs">今天</button>
                    <button type="button" @click="setDate('yesterday')" class="btn-xs">昨天</button>
                </div>
            </div>
        </div>
        
        <div class="form-group" :class="{ 'has-error': errors.price }">
            <label>成交單價 (USD)</label>
            <input 
                type="number" 
                v-model="form.price" 
                @input="handlePriceInput" 
                placeholder="0.00" 
                class="input-md" 
                step="0.0001"
            >
        </div>

        <div class="form-group" :class="{ 'has-error': errors.qty }">
            <label>股數</label>
            <input 
                type="number" 
                v-model="form.qty" 
                @input="handleQtyInput" 
                placeholder="0" 
                class="input-md" 
                step="0.0001"
            >
        </div>

        <div class="form-group">
            <label>費用 (Fee / Tax)</label>
            <div class="dual-input">
                <div class="input-with-label">
                    <span class="sub-label">手續費</span>
                    <input type="number" v-model="form.fee" @input="calcTotal" placeholder="0" step="0.01">
                </div>
                <div class="input-with-label">
                    <span class="sub-label">稅金</span>
                    <input type="number" v-model="form.tax" @input="calcTotal" placeholder="0" step="0.01">
                </div>
            </div>
        </div>
    </div>

    <div class="summary-box">
        <div class="summary-header">
            <div class="summary-label">交易總金額 (USD)</div>
            <div class="calc-hint" v-if="lastCalcMode">
                {{ lastCalcMode === 'forward' ? '⚡ 自動計算中' : '↺ 反推單價模式' }}
            </div>
        </div>
        <input 
            type="number" 
            v-model="form.total_amount" 
            @input="handleTotalInput" 
            class="summary-value" 
            step="0.01" 
            placeholder="0.00"
            :class="{ 'highlight-calc': lastCalcMode === 'forward' }"
        >
    </div>
    
    <div class="action-buttons">
        <button v-if="isEditing" @click="resetForm" class="btn btn-cancel">取消</button>
        <button class="btn btn-submit" @click="submit" :disabled="loading" :class="form.txn_type.toLowerCase()">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? '處理中...' : (isEditing ? '更新委託' : '送出委託') }}
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
const errors = reactive({});
const lastCalcMode = ref(''); // 'forward' (Price*Qty->Total) or 'reverse' (Total->Price)

const form = reactive({
    txn_date: new Date().toISOString().split('T')[0],
    symbol: '', 
    txn_type: 'BUY', 
    qty: '', 
    price: '', 
    fee: '', 
    tax: '', 
    total_amount: '',
    tag: '' 
});

// Autocomplete Data
const historySymbols = computed(() => {
    const symbols = new Set(store.records.map(r => r.symbol));
    return Array.from(symbols).sort();
});

const tagsArray = computed(() => {
    return (form.tag || '').split(/[,;]/).map(t=>t.trim()).filter(t=>t);
});

const commonTags = computed(() => {
    return store.availableGroups.filter(g => g !== 'all' && !tagsArray.value.includes(g));
});

// Logic
const setDate = (type) => {
    const d = new Date();
    if (type === 'yesterday') d.setDate(d.getDate() - 1);
    form.txn_date = d.toISOString().split('T')[0];
};

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
    clearError('symbol');
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
    calcTotal(); // Recalculate as fee logic might change
};

// --- Bidirectional Calculation ---

// 1. Inputs trigger Forward Calculation (Price * Qty -> Total)
const handlePriceInput = () => {
    clearError('price');
    calcTotal();
};
const handleQtyInput = () => {
    clearError('qty');
    calcTotal();
};

const calcTotal = () => {
    if (lastCalcMode.value === 'reverse') return; // Prevent loop if needed, though simpler is better
    
    lastCalcMode.value = 'forward';
    const qty = parseFloat(form.qty) || 0;
    const price = parseFloat(form.price) || 0;
    const fee = parseFloat(form.fee) || 0;
    const tax = parseFloat(form.tax) || 0;
    
    if (qty > 0 && price > 0) {
        let total = 0;
        if (form.txn_type === 'BUY') {
            total = (price * qty) + fee + tax;
        } else {
            // SELL or DIV
            total = (price * qty) - fee - tax;
        }
        form.total_amount = parseFloat(total.toFixed(2));
    }
};

// 2. Total triggers Reverse Calculation (Total -> Price)
const handleTotalInput = () => {
    lastCalcMode.value = 'reverse';
    const qty = parseFloat(form.qty) || 0;
    const total = parseFloat(form.total_amount) || 0;
    const fee = parseFloat(form.fee) || 0;
    const tax = parseFloat(form.tax) || 0;

    if (qty > 0 && total > 0) {
        let baseAmount = 0;
        if (form.txn_type === 'BUY') {
            baseAmount = total - fee - tax;
        } else {
            baseAmount = total + fee + tax;
        }
        
        // Avoid division by zero
        if (baseAmount > 0) {
            const price = baseAmount / qty;
            form.price = parseFloat(price.toFixed(4));
        }
    }
};

const clearError = (field) => {
    if (errors[field]) delete errors[field];
};

const validate = () => {
    let isValid = true;
    errors.symbol = !form.symbol;
    errors.qty = !form.qty || form.qty <= 0;
    errors.price = !form.price || form.price <= 0;
    
    if (form.txn_type === 'SELL' && holdingGroups.value.length > 0 && selectedSellGroups.value.length === 0) {
        addToast("請勾選要賣出的策略群組", "error");
        isValid = false;
    }
    
    if (errors.symbol || errors.qty || errors.price) isValid = false;
    return isValid;
};

const submit = async () => {
    if (!validate()) {
        addToast("請檢查必填欄位", "error");
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
            // Reset calc mode after successful submit
            lastCalcMode.value = '';
        }
    } catch(e) { 
        console.error('❌ 提交錯誤:', e);
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
    form.fee = ''; 
    form.tax = ''; 
    form.total_amount = '';
    form.tag = ''; 
    form.txn_type = 'BUY';
    holdingGroups.value = [];
    selectedSellGroups.value = [];
    tagInput.value = '';
    lastCalcMode.value = '';
    Object.keys(errors).forEach(k => delete errors[k]);
};

const setupForm = (r) => {
    isEditing.value = true; 
    editingId.value = r.id;
    Object.keys(form).forEach(k => form[k] = r[k]);
    checkHoldings();
    // Scroll to form
    const el = document.getElementById('trade-form-anchor');
    if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

defineExpose({ setupForm });
</script>

<style scoped>
.trade-panel { 
    background: var(--bg-card); 
    border-radius: var(--radius-lg); 
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-card);
    padding: 24px;
    transition: all 0.3s ease;
}

/* Header */
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.panel-title { font-size: 1.25rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px; margin: 0; }
.btn-close { background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-sub); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
.btn-close:hover { background: var(--bg-secondary); color: var(--text-main); }

/* Switch */
.trade-type-switch { display: flex; background: var(--bg-secondary); padding: 4px; border-radius: 12px; margin-bottom: 24px; }
.switch-btn { flex: 1; border: none; background: transparent; padding: 10px; font-weight: 600; color: var(--text-sub); cursor: pointer; border-radius: 10px; transition: all 0.2s; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 6px; }
.switch-btn:hover { color: var(--text-main); }
.switch-btn.active { background: var(--bg-card); box-shadow: 0 2px 4px rgba(0,0,0,0.05); color: var(--text-main); transform: scale(1.02); }
.switch-btn.buy.active { color: var(--primary); border: 1px solid rgba(59, 130, 246, 0.1); }
.switch-btn.sell.active { color: var(--success); border: 1px solid rgba(16, 185, 129, 0.1); }
.switch-btn.div.active { color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.1); }

/* Form Grid */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.form-group { display: flex; flex-direction: column; gap: 8px; position: relative; }
.form-group.full { grid-column: span 2; }
.form-group.has-error input { border-color: var(--danger); box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1); }
.error-msg { color: var(--danger); font-size: 0.8rem; position: absolute; bottom: -20px; left: 0; }

label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }

/* Inputs */
input { padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 1rem; width: 100%; box-sizing: border-box; font-family: 'JetBrains Mono', monospace; transition: all 0.2s; color: var(--text-main); background: var(--bg-app); }
input:focus { outline: none; border-color: var(--primary); background: var(--bg-card); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
input:disabled { opacity: 0.7; cursor: not-allowed; }
.uppercase { text-transform: uppercase; }

/* Date Input Group */
.date-input-group { display: flex; gap: 8px; align-items: center; }
.date-shortcuts { display: flex; gap: 4px; }
.btn-xs { padding: 4px 8px; font-size: 0.75rem; border: 1px solid var(--border-color); background: var(--bg-card); border-radius: 6px; cursor: pointer; color: var(--text-sub); transition: all 0.2s; white-space: nowrap; }
.btn-xs:hover { border-color: var(--primary); color: var(--primary); }

/* Dual Input */
.dual-input { display: flex; gap: 12px; }
.input-with-label { flex: 1; position: relative; }
.sub-label { position: absolute; top: -20px; left: 0; font-size: 0.75rem; color: var(--text-sub); }

/* Tags */
.tag-input-container { border: 1px solid var(--border-color); border-radius: 10px; padding: 8px; background: var(--bg-app); display: flex; flex-wrap: wrap; gap: 6px; min-height: 48px; transition: border-color 0.2s; }
.tag-input-container:focus-within { border-color: var(--primary); background: var(--bg-card); }
.tag-chip { background: var(--bg-secondary); color: var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(59, 130, 246, 0.1); }
.remove-tag { cursor: pointer; opacity: 0.6; font-size: 1.1rem; line-height: 1; }
.remove-tag:hover { opacity: 1; color: var(--danger); }
.tag-input-field { border: none; outline: none; background: transparent; flex: 1; min-width: 100px; padding: 4px; color: var(--text-main); font-family: 'Inter', sans-serif; }
.quick-tags { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
.quick-tag { font-size: 0.8rem; color: var(--text-sub); border: 1px dashed var(--border-color); padding: 4px 10px; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
.quick-tag:hover { border-color: var(--primary); color: var(--primary); background: rgba(59, 130, 246, 0.05); }

/* Smart Sell */
.smart-sell-options { background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 12px; }
.hint-header { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: #b45309; margin-bottom: 8px; font-weight: 600; }
.checkbox-group { display: flex; gap: 12px; flex-wrap: wrap; }
.tag-checkbox { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 8px; background: rgba(255,255,255,0.5); border-radius: 4px; }

/* Summary Box */
.summary-box { background: var(--bg-secondary); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px; border: 1px solid var(--border-color); position: relative; overflow: hidden; }
.summary-header { display: flex; justify-content: center; align-items: center; gap: 8px; margin-bottom: 8px; }
.calc-hint { font-size: 0.75rem; color: var(--primary); background: rgba(59, 130, 246, 0.1); padding: 2px 6px; border-radius: 4px; animation: fadeIn 0.3s; }
.summary-value { background: transparent; border: none; text-align: center; font-size: 2.2rem; font-weight: 700; color: var(--text-main); padding: 0; width: 100%; transition: color 0.2s; }
.summary-value.highlight-calc { color: var(--primary); }
.summary-value::placeholder { color: var(--text-muted); opacity: 0.3; }

/* Actions */
.action-buttons { display: flex; gap: 12px; }
.btn { flex: 1; padding: 14px; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 8px; }
.btn-cancel { background: transparent; color: var(--text-sub); border: 1px solid var(--border-color); }
.btn-cancel:hover { background: var(--bg-secondary); color: var(--text-main); }
.btn-submit { color: white; background: var(--text-main); box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.btn-submit.buy { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); }
.btn-submit.sell { background: linear-gradient(135deg, var(--success), #059669); }
.btn-submit.div { background: linear-gradient(135deg, var(--warning), #d97706); }
.btn-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); opacity: 0.95; }
.btn-submit:disabled { opacity: 0.7; cursor: not-allowed; filter: grayscale(0.5); }

.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }

/* Animations */
.slide-fade-enter-active { transition: all 0.3s ease-out; }
.slide-fade-leave-active { transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1); }
.slide-fade-enter-from, .slide-fade-leave-to { transform: translateY(-10px); opacity: 0; }
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: scale(0.9); }

@media (max-width: 768px) {
    .trade-panel { padding: 20px; border: none; box-shadow: none; background: transparent; }
    .form-grid { gap: 16px; }
    .dual-input { flex-direction: column; gap: 20px; }
    .sub-label { top: -22px; }
}
</style>
