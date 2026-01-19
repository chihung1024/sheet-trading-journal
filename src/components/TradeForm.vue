<template>
  <div class="card trade-panel no-padding-mobile" id="trade-form-anchor">
    <h3 class="panel-title">{{ isEditing ? '編輯交易紀錄' : '快速新增交易' }}</h3>
    
    <div class="trade-type-switch">
        <button v-for="t in ['BUY', 'SELL', 'DIV']" :key="t"
            :class="['switch-btn', t.toLowerCase(), { active: form.txn_type === t }]"
            @click="setTxnType(t)">
            {{ t === 'BUY' ? '買進' : t === 'SELL' ? '賣出' : '股息' }}
        </button>
    </div>

    <div class="form-grid">
        <div class="form-group full">
            <label>交易標的</label>
            <input 
              type="text" 
              v-model="form.symbol" 
              @change="checkHoldings" 
              placeholder="輸入代碼 (如 NVDA)" 
              :disabled="isEditing" 
              class="input-lg uppercase"
            >
        </div>
        
        <div class="form-group full">
            <label>策略標籤 (Groups)</label>
            
            <div v-if="form.txn_type === 'SELL' && holdingGroups.length > 0" class="smart-sell-options">
                <span class="hint">⚠️ 此標的目前持倉於以下群組，請勾選：</span>
                <div class="checkbox-group">
                    <label v-for="g in holdingGroups" :key="g" class="tag-checkbox">
                        <input type="checkbox" :value="g" v-model="selectedSellGroups" @change="updateTagsFromCheckboxes">
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
                        placeholder="新增標籤..."
                        class="tag-input-field"
                        :disabled="form.txn_type === 'SELL' && holdingGroups.length > 0"
                    >
                </div>
            </div>
            
            <div class="quick-tags" v-if="form.txn_type !== 'SELL' || holdingGroups.length === 0">
                <span v-for="t in commonTags" :key="t" @click="pushTag(t)" class="quick-tag">{{ t }}</span>
            </div>
        </div>
        
        <div class="form-group">
            <label>交易日期</label>
            <input type="date" v-model="form.txn_date" class="input-md">
        </div>
        
        <div class="form-group">
            <label>成交單價 (USD)</label>
            <input type="number" v-model="form.price" @input="calcTotalFromInputs" placeholder="0.00" class="input-md" step="0.0001">
        </div>

        <div class="form-group">
            <label>成交股數</label>
            <input type="number" v-model="form.qty" @input="calcTotalFromInputs" placeholder="0" class="input-md" step="0.0001">
        </div>

        <div class="form-group">
            <label>相關費用 (USD)</label>
            <div class="dual-input">
                <input type="number" v-model="form.fee" @input="calcTotalFromInputs" placeholder="手續費" step="0.01">
                <input type="number" v-model="form.tax" @input="calcTotalFromInputs" placeholder="稅金" step="0.01">
            </div>
        </div>
    </div>

    <div class="summary-box">
        <div class="summary-label">預估總金額 (USD)</div>
        <input type="number" v-model="form.total_amount" @input="calcPriceFromTotal" class="summary-value" step="0.01" placeholder="0.00">
    </div>
    
    <div class="action-buttons">
        <button v-if="isEditing" @click="resetForm" class="btn btn-cancel">取消</button>
        <button class="btn btn-submit" @click="submit" :disabled="loading" :class="form.txn_type.toLowerCase()">
            {{ loading ? '傳送中...' : (isEditing ? '更新紀錄' : '送出委託') }}
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

// MODIFIED: 增加雙向計算邏輯
const calcTotalFromInputs = () => {
    const qty = parseFloat(form.qty) || 0;
    const price = parseFloat(form.price) || 0;
    const fee = parseFloat(form.fee) || 0;
    const tax = parseFloat(form.tax) || 0;
    if (qty <= 0 || price <= 0) return;
    
    let total = 0;
    if (form.txn_type === 'BUY') total = (qty * price) + fee + tax;
    else if (form.txn_type === 'SELL') total = (qty * price) - fee - tax;
    else total = (qty * price) - tax;
    
    form.total_amount = parseFloat(total.toFixed(2));
};

const calcPriceFromTotal = () => {
    const qty = parseFloat(form.qty) || 0;
    const total = parseFloat(form.total_amount) || 0;
    const fee = parseFloat(form.fee) || 0;
    const tax = parseFloat(form.tax) || 0;
    if (qty <= 0 || total <= 0) return;

    let price = 0;
    if (form.txn_type === 'BUY') price = (total - fee - tax) / qty;
    else if (form.txn_type === 'SELL') price = (total + fee + tax) / qty;
    else price = (total + tax) / qty;
    
    form.price = parseFloat(price.toFixed(4));
};

const submit = async () => {
    if (!form.symbol || !form.qty || !form.price) { 
        addToast("請填寫完整交易資料", "error"); 
        return; 
    }
    
    if (form.txn_type === 'SELL' && holdingGroups.value.length > 0 && selectedSellGroups.value.length === 0) {
        addToast("請先勾選要扣除持倉的群組", "error");
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
            // 在 App.vue 的 handleEditRecord 中已經處理了捲動
        }
    } catch(e) { 
        console.error('Submit Error:', e);
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
    Object.keys(form).forEach(k => form[k] = r[k]);
    checkHoldings();
};

defineExpose({ setupForm });
</script>

<style scoped>
/* MODIFIED: 基礎容器樣式適配行動端 */
.trade-panel { padding: 24px; border: 1px solid var(--border-color); }
.panel-title { margin-bottom: 20px; font-size: 1.25rem; font-weight: 700; color: var(--text-main); }

.trade-type-switch { display: flex; background: var(--bg-secondary); padding: 4px; border-radius: 12px; margin-bottom: 24px; }
.switch-btn { flex: 1; border: none; background: transparent; padding: 12px; font-weight: 600; color: var(--text-sub); cursor: pointer; border-radius: 8px; transition: all 0.2s; font-size: 0.95rem; }
.switch-btn.active { background: var(--bg-card); box-shadow: var(--shadow-sm); color: var(--text-main); }
.switch-btn.buy.active { color: var(--primary); }
.switch-btn.sell.active { color: var(--success); }
.switch-btn.div.active { color: var(--warning); }

/* MODIFIED: 網格系統重構 (Mobile First) */
.form-grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin-bottom: 20px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group.full { grid-column: 1 / -1; }

label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; padding-left: 2px; }
input { padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 1rem; width: 100%; font-family: 'JetBrains Mono', monospace; transition: all 0.2s; color: var(--text-main); background: var(--bg-card); min-height: 46px; }
input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.uppercase { text-transform: uppercase; }

.dual-input { display: flex; gap: 10px; }
.dual-input input { flex: 1; }

/* MODIFIED: 標籤輸入區域優化 */
.tag-input-container { border: 1px solid var(--border-color); border-radius: 10px; padding: 8px; background: var(--bg-card); display: flex; flex-wrap: wrap; gap: 6px; min-height: 48px; }
.tags-list { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; align-items: center; }
.tag-chip { background: var(--bg-secondary); color: var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(59, 130, 246, 0.1); }
.remove-tag { cursor: pointer; opacity: 0.5; font-weight: bold; font-size: 1.1rem; padding: 0 2px; }
.remove-tag:hover { opacity: 1; color: var(--danger); }
.tag-input-field { border: none !important; outline: none; background: transparent; flex: 1; min-width: 80px; padding: 4px !important; min-height: unset !important; font-size: 0.9rem; }

.quick-tags { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
.quick-tag { font-size: 0.75rem; color: var(--text-sub); border: 1px solid var(--border-color); padding: 4px 10px; border-radius: 12px; cursor: pointer; }
.quick-tag:active { background: var(--primary); color: white; border-color: var(--primary); }

/* MODIFIED: 總覽區塊行動端視覺加強 */
.summary-box { background: var(--bg-secondary); padding: 16px; border-radius: 14px; text-align: center; margin-bottom: 24px; border: 2px dashed var(--border-color); }
.summary-label { font-size: 0.8rem; color: var(--text-sub); margin-bottom: 6px; font-weight: 700; text-transform: uppercase; }
.summary-value { background: transparent !important; border: none !important; text-align: center; font-size: 1.8rem !important; font-weight: 800 !important; color: var(--text-main); padding: 0 !important; min-height: auto !important; box-shadow: none !important; }

.action-buttons { display: flex; gap: 12px; }
.btn { flex: 1; padding: 14px; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 1rem; }
.btn-submit { color: white; background: var(--primary); box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2); }
.btn-submit.buy { background: var(--primary); }
.btn-submit.sell { background: var(--success); }
.btn-submit.div { background: var(--warning); }
.btn-submit:active { transform: scale(0.97); opacity: 0.9; }

/* MODIFIED: 行動端特定樣式中斷點 */
@media (min-width: 640px) {
    .form-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 768px) {
    .no-padding-mobile { padding: 16px !important; border-radius: 0; border-left: none; border-right: none; }
    .panel-title { font-size: 1.15rem; }
}
</style>
