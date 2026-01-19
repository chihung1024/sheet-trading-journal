<template>
  <div class="card trade-panel" id="trade-form-anchor">
    <h3 class="panel-title">{{ isEditing ? '編輯交易' : '快速下單' }}</h3>
    
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
            <input type="text" v-model="form.symbol" @change="checkHoldings" placeholder="輸入代碼 (如 NVDA)" :disabled="isEditing" class="input-lg uppercase">
        </div>
        
        <div class="form-group full">
            <label>策略標籤 (Groups)</label>
            
            <div v-if="form.txn_type === 'SELL' && holdingGroups.length > 0" class="smart-sell-options">
                <span class="hint">⚠️ 此標的目前持倉於以下群組，請勾選要賣出的部位：</span>
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
                        placeholder="輸入標籤後按 Enter..."
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
            <label>日期</label>
            <input type="date" v-model="form.txn_date" class="input-md">
        </div>
        
        <div class="form-group">
            <label>成交單價 (USD)</label>
            <input type="number" v-model="form.price" placeholder="0.00" class="input-md" step="0.0001">
        </div>

        <div class="form-group">
            <label>股數</label>
            <input type="number" v-model="form.qty" @input="calcPriceFromInputs" placeholder="0" class="input-md" step="0.0001">
        </div>

        <div class="form-group">
            <label>費用 (Fee/Tax)</label>
            <div class="dual-input">
                <input type="number" v-model="form.fee" @input="calcPriceFromInputs" placeholder="手續費" step="0.01">
                <input type="number" v-model="form.tax" @input="calcPriceFromInputs" placeholder="稅金" step="0.01">
            </div>
        </div>
    </div>

    <div class="summary-box">
        <div class="summary-label">交易總金額 (USD)</div>
        <input type="number" v-model="form.total_amount" @input="calcPriceFromInputs" class="summary-value" step="0.01" placeholder="0.00">
    </div>
    
    <div class="action-buttons">
        <button v-if="isEditing" @click="resetForm" class="btn btn-cancel">取消</button>
        <button class="btn btn-submit" @click="submit" :disabled="loading" :class="form.txn_type.toLowerCase()">
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
import { CONFIG } from '../config';

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

// 解析 tag 字串為陣列
const tagsArray = computed(() => {
    return (form.tag || '').split(/[,;]/).map(t=>t.trim()).filter(t=>t);
});

// 常見標籤建議 (排除已選取的)
const commonTags = computed(() => {
    return (store.availableGroups || []).filter(g => g !== 'all' && !tagsArray.value.includes(g));
});

// 智慧持倉檢查
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
    
    if (qty <= 0 || total <= 0) return;
    
    let avgCost = 0;
    if (form.txn_type === 'BUY') {
        avgCost = (total + fee + tax) / qty;
    } else if (form.txn_type === 'SELL') {
        avgCost = (total - fee - tax) / qty;
    } else {
        avgCost = (total - tax) / qty;
    }
    form.price = parseFloat(avgCost.toFixed(4));
};

/**
 * 核心提交邏輯
 */
const submit = async () => {
    if (!form.symbol || !form.qty || !form.price) { 
        addToast("請填寫完整資料", "error"); 
        return; 
    }
    
    // 賣出檢核：必須歸屬於策略群組
    if (form.txn_type === 'SELL' && holdingGroups.value.length > 0 && selectedSellGroups.value.length === 0) {
        addToast("請勾選要賣出的群組", "error");
        return;
    }
    
    if (!auth.token || auth.isTokenExpired()) {
        addToast("登入已過期，請重新登入", "error");
        setTimeout(() => auth.logout(), 2000);
        return;
    }
    
    loading.value = true;
    try {
        const method = isEditing.value ? "PUT" : "POST";
        const payload = { ...form, id: isEditing.value ? editingId.value : undefined };
        
        // 強制轉換代碼為大寫
        payload.symbol = payload.symbol.toUpperCase();
        
        // 安全轉換數值，避免 NaN [修正點]
        ['qty', 'price', 'fee', 'tax', 'total_amount'].forEach(k => {
            payload[k] = parseFloat(payload[k]) || 0;
        });
        
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method, 
            headers: { 
                'Authorization': `Bearer ${auth.token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });
        
        if (res.status === 401) {
            addToast("身份驗證失敗，請重新登入", "error");
            setTimeout(() => auth.logout(), 2000);
            return;
        }
        
        const json = await res.json();
        
        if (json.success) {
            addToast(isEditing.value ? "更新成功" : "新增成功", "success");
            resetForm(); 
            
            // 1. 立即更新紀錄列表
            await store.fetchRecords();
            
            // 2. 觸發智慧輪詢等待背景計算完成 [優化點]
            store.startPolling(); 
        } else { 
            addToast(json.error || "操作失敗", "error"); 
        }
    } catch(e) { 
        console.error('❌ 提交錯誤:', e);
        addToast("連線錯誤，請稍後再試", "error"); 
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
/* 樣式保持完整，確保視覺一致性 */
.trade-panel { border: 1px solid var(--border-color); box-shadow: var(--shadow-card); background: var(--bg-card); padding: 24px; }
.panel-title { margin-bottom: 24px; font-size: 1.3rem; color: var(--text-main); font-weight: 700; }
.trade-type-switch { display: flex; background: var(--bg-secondary); padding: 4px; border-radius: 12px; margin-bottom: 24px; }
.switch-btn { flex: 1; border: none; background: transparent; padding: 10px; font-weight: 500; color: var(--text-sub); cursor: pointer; border-radius: 8px; transition: all 0.2s; font-size: 1rem; }
.switch-btn.active { background: var(--bg-card); box-shadow: var(--shadow-sm); color: var(--text-main); font-weight: 600; }
.switch-btn.buy.active { color: var(--primary); }
.switch-btn.sell.active { color: var(--success); }
.switch-btn.div.active { color: var(--warning); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group.full { grid-column: span 2; }
label { font-size: 0.9rem; color: var(--text-sub); font-weight: 600; }
input { padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1.05rem; width: 100%; box-sizing: border-box; font-family: 'JetBrains Mono', monospace; transition: all 0.2s; color: var(--text-main); background: var(--bg-card); }
input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
input:disabled { background: var(--bg-secondary); cursor: not-allowed; opacity: 0.7; }
.uppercase { text-transform: uppercase; }
.dual-input { display: flex; gap: 12px; }
.tag-input-container { border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; background: var(--bg-card); display: flex; flex-wrap: wrap; gap: 6px; min-height: 46px; }
.tag-input-container.disabled { opacity: 0.6; pointer-events: none; }
.tags-list { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; align-items: center; }
.tag-chip { background: var(--bg-secondary); color: var(--primary); padding: 4px 8px; border-radius: 6px; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.remove-tag { cursor: pointer; opacity: 0.6; font-weight: bold; font-size: 1.1rem; }
.tag-input-field { border: none; outline: none; background: transparent; flex: 1; min-width: 100px; padding: 4px; color: var(--text-main); font-family: 'Inter', sans-serif; font-size: 0.95rem; }
.quick-tags { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
.quick-tag { font-size: 0.8rem; color: var(--text-sub); border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
.quick-tag:hover { border-color: var(--primary); color: var(--primary); }
.smart-sell-options { background: rgba(245, 158, 11, 0.1); border: 1px dashed var(--warning); padding: 12px; border-radius: 8px; margin-bottom: 12px; }
.hint { display: block; font-size: 0.85rem; color: var(--warning); margin-bottom: 8px; font-weight: 600; }
.checkbox-group { display: flex; gap: 12px; flex-wrap: wrap; }
.tag-checkbox { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.tag-name { font-size: 0.95rem; font-weight: 500; color: var(--text-main); }
.summary-box { background: var(--bg-secondary); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px; border: 1px dashed var(--border-color); }
.summary-label { font-size: 0.95rem; color: var(--text-sub); margin-bottom: 8px; font-weight: 500; }
.summary-value { background: transparent; border: none; text-align: center; font-size: 2rem; font-weight: 700; color: var(--text-main); padding: 0; width: 100%; box-shadow: none; }
.action-buttons { display: flex; gap: 16px; }
.btn { flex: 1; padding: 14px; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 1.05rem; letter-spacing: 0.02em; }
.btn-cancel { background: var(--bg-secondary); color: var(--text-sub); border: 1px solid var(--border-color); }
.btn-submit { color: white; background: var(--primary); }
.btn-submit.buy { background: var(--primary); }
.btn-submit.sell { background: var(--success); }
.btn-submit.div { background: var(--warning); }
.btn-submit:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: var(--shadow-card); }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
@media (max-width: 768px) { .trade-panel { padding: 20px; } .form-grid { gap: 16px; } }
</style>
