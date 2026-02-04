<template>
  <div class="card trade-panel" :class="form.txn_type.toLowerCase() + '-mode'" id="trade-form-anchor">
    <div class="panel-header">
        <h3 class="panel-title">{{ isEditing ? '編輯交易' : '新增交易' }}</h3>
        <span class="mode-badge" v-if="isEditing">EDITING</span>
    </div>
    
    <div class="trade-type-switch">
        <button v-for="t in ['BUY', 'SELL', 'DIV']" :key="t"
            :class="['switch-btn', t.toLowerCase(), { active: form.txn_type === t }]"
            @click="setTxnType(t)">
            <span class="btn-icon">{{ t === 'BUY' ? '📥' : t === 'SELL' ? '📤' : '💰' }}</span>
            <span class="btn-text">{{ t === 'BUY' ? '買進' : t === 'SELL' ? '賣出' : '股息' }}</span>
        </button>
    </div>

    <div class="form-grid">
        <div class="form-group span-2">
            <label>交易標的 Symbol</label>
            <div class="input-wrapper">
                <input 
                    type="text" 
                    v-model="form.symbol" 
                    @change="checkHoldings" 
                    placeholder="如: NVDA, TSLA" 
                    :disabled="isEditing" 
                    class="input-lg uppercase bold-text"
                >
            </div>
        </div>

        <div class="form-group">
            <label>日期 Date</label>
            <input type="date" v-model="form.txn_date" class="input-md">
        </div>
        
        <div class="form-group span-3">
            <label>策略群組 (Tags)</label>
            
            <div v-if="form.txn_type === 'SELL' && holdingGroups.length > 0" class="smart-sell-options">
                <div class="hint-header">
                    <span class="hint-icon">⚠️</span>
                    <span class="hint-text">此標的屬於以下群組，請勾選要賣出的部位：</span>
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
                        <button class="remove-tag" @click="removeTag(idx)">×</button>
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
            <label>成交單價 (USD)</label>
            <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input 
                    type="number" 
                    v-model="form.price" 
                    placeholder="0.00" 
                    class="input-md font-num" 
                    step="0.0001"
                    inputmode="decimal"
                >
            </div>
            <p class="field-hint">可輸入成交單價或留白，擇一與總額搭配即可。</p>
        </div>

        <div class="form-group">
            <label>股數 Shares</label>
            <input 
                type="number" 
                v-model="form.qty" 
                placeholder="0" 
                class="input-md font-num" 
                step="0.0001"
                inputmode="decimal"
            >
        </div>

        <div class="form-group span-2">
            <label>費用 (Fee + Tax)</label>
            <div class="dual-input wide-inputs">
                <div class="input-with-label">
                    <input type="number" v-model="form.fee" placeholder="0" step="0.01" inputmode="decimal">
                    <span class="sub-label">手續費</span>
                </div>
                <div class="input-with-label">
                    <input type="number" v-model="form.tax" placeholder="0" step="0.01" inputmode="decimal">
                    <span class="sub-label">稅金</span>
                </div>
            </div>
            <p class="field-hint">請輸入單筆交易的手續費與稅金，系統會在紀錄中換算平均成本。</p>
        </div>

        <div class="form-group summary-field">
            <label>交易總金額 (USD)</label>
            <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input 
                    type="number" 
                    v-model="form.total_amount" 
                    class="input-md font-num summary-input"
                    step="0.01" 
                    placeholder="0.00"
                    inputmode="decimal"
                >
            </div>
            <p class="field-hint">可輸入總額或成交單價其中一項，平均成本會依費用與稅金計算。</p>
        </div>
    </div>

    <div class="form-footer">
        <div class="action-buttons">
            <button v-if="isEditing" @click="resetForm" class="btn btn-cancel">取消</button>
            <button class="btn btn-submit" @click="submit" :disabled="loading" :class="form.txn_type.toLowerCase()">
                <span v-if="loading" class="spinner"></span>
                {{ loading ? '處理中...' : (isEditing ? '更新交易' : submitButtonText) }}
            </button>
        </div>
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

const submitButtonText = computed(() => {
    switch(form.txn_type) {
        case 'BUY': return '送出買單';
        case 'SELL': return '送出賣單';
        case 'DIV': return '記錄股息';
        default: return '送出';
    }
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

const submit = async () => {
    if (!form.symbol || !form.qty || (!form.price && !form.total_amount)) { 
        addToast("請填寫完整資料", "error"); 
        return; 
    }
    
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
        const payload = { ...form };
        ['qty', 'price', 'fee', 'tax', 'total_amount'].forEach(k => payload[k] = parseFloat(payload[k] || 0));
        if (payload.qty > 0) {
            if (payload.price <= 0 && payload.total_amount > 0) {
                payload.price = payload.total_amount / payload.qty;
            } else if (payload.total_amount <= 0 && payload.price > 0) {
                payload.total_amount = payload.price * payload.qty;
            }
        }
        
        let success = false;
        if (isEditing.value) {
            payload.id = editingId.value;
            success = await store.updateRecord(payload);
        } else {
            success = await store.addRecord(payload);
        }
        
        if (success) {
            resetForm(); 
            // 如果是在手機 Bottom Sheet 中，這裡可以 emit event 通知父層關閉，
            // 但 App.vue 已經有監聽 @submitted 事件，這裡可以透過 emit 傳遞
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

defineExpose({ setupForm, resetForm });
</script>

<style scoped>
/* 基礎面板 */
.trade-panel { 
    background: var(--bg-card); 
    border: 1px solid var(--border-color); 
    padding: 16px; 
    border-radius: var(--radius);
    transition: border-color 0.3s ease;
}

/* 根據模式改變邊框顏色 (視覺提示) */
.trade-panel.buy-mode { border-top: 4px solid var(--primary); }
.trade-panel.sell-mode { border-top: 4px solid var(--success); } /* Sell 用綠色代表獲利了結? 或紅色代表出貨? 這裡維持原案 Success 綠 */
.trade-panel.div-mode { border-top: 4px solid var(--warning); }

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.panel-title { margin: 0; font-size: 1.25rem; color: var(--text-main); font-weight: 700; }
.mode-badge { font-size: 0.75rem; background: var(--warning); color: white; padding: 2px 6px; border-radius: 4px; font-weight: 600; }

/* 交易類型切換 (Segmented Control) */
.trade-type-switch { 
    display: flex; 
    background: var(--bg-secondary); 
    padding: 4px; 
    border-radius: 12px; 
    margin-bottom: 12px; 
}

.switch-btn { 
    flex: 1; 
    border: none; 
    background: transparent; 
    padding: 8px; 
    font-weight: 600; 
    color: var(--text-sub); 
    cursor: pointer; 
    border-radius: 8px; 
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
    font-size: 0.9rem; 
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.switch-btn.active { 
    background: var(--bg-card); 
    box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
    color: var(--text-main); 
    transform: scale(1.02);
}

.switch-btn.buy.active { color: var(--primary); }
.switch-btn.sell.active { color: var(--success); }
.switch-btn.div.active { color: var(--warning); }

/* 表單佈局 */
.form-grid { 
    display: grid; 
    grid-template-columns: repeat(3, minmax(0, 1fr)); 
    gap: 10px; 
    margin-bottom: 12px; 
}

.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group.span-2 { grid-column: span 2; }
.form-group.span-3 { grid-column: span 3; }

label { font-size: 0.82rem; color: var(--text-sub); font-weight: 600; margin-left: 2px; letter-spacing: 0.2px; }
.field-hint {
    margin: 2px 0 0;
    font-size: 0.72rem;
    color: var(--text-sub);
    opacity: 0.75;
}

.wide-inputs .input-with-label input { min-width: 110px; }

/* 輸入框通用樣式 */
input { 
    padding: 8px 12px; 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    font-size: 1rem; 
    width: 100%; 
    box-sizing: border-box; 
    font-family: 'Inter', sans-serif;
    transition: all 0.2s; 
    color: var(--text-main); 
    background: var(--bg-card); 
    height: 38px;
}

input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
input:disabled { background: var(--bg-secondary); cursor: not-allowed; opacity: 0.7; }

.font-num { font-family: 'JetBrains Mono', monospace; }
.uppercase { text-transform: uppercase; }
.bold-text { font-weight: 700; }

/* 帶前綴的輸入框 */
.input-with-prefix { position: relative; }
.prefix { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.input-with-prefix input { padding-left: 30px; }

/* 雙欄輸入 (費用) */
.dual-input { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.input-with-label { display: flex; flex-direction: column; }
.sub-label { font-size: 0.75rem; color: var(--text-sub); text-align: center; margin-top: 4px; }

/* 標籤輸入區 */
.tag-input-container { 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    padding: 6px 8px; 
    background: linear-gradient(180deg, rgba(59, 130, 246, 0.04), transparent 80%); 
    display: flex; 
    flex-wrap: wrap; 
    gap: 6px; 
    min-height: 44px; 
}
.tag-input-container.disabled { opacity: 0.6; pointer-events: none; background: var(--bg-secondary); }

.tag-chip { 
    background: var(--bg-secondary); 
    color: var(--primary); 
    padding: 4px 8px 4px 12px; 
    border-radius: 6px; 
    font-size: 0.9rem; 
    font-weight: 600; 
    display: flex; 
    align-items: center; 
    gap: 4px; 
}
.remove-tag { 
    background: none; border: none; cursor: pointer; color: var(--text-sub); font-size: 1.1rem; line-height: 1; padding: 0 4px; display: flex; align-items: center; 
}
.remove-tag:hover { color: var(--danger); }
.tag-input-field { border: none; outline: none; background: transparent; flex: 1; min-width: 80px; padding: 4px; height: auto; }

.quick-tags { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
.quick-tag { 
    font-size: 0.8rem; 
    color: var(--text-sub); 
    border: 1px solid var(--border-color); 
    padding: 2px 10px; 
    border-radius: 12px; 
    cursor: pointer; 
    transition: all 0.2s; 
    background: var(--bg-card);
}
.quick-tag:hover { border-color: var(--primary); color: var(--primary); background: rgba(59, 130, 246, 0.05); }

/* 賣出提示 (Smart Sell) */
.smart-sell-options { background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 12px; }
.hint-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.hint-text { font-size: 0.85rem; color: var(--warning); font-weight: 600; }
.checkbox-group { display: flex; gap: 12px; flex-wrap: wrap; }
.tag-checkbox { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
.tag-checkbox input { width: 18px; height: 18px; margin: 0; }
.tag-name { font-size: 0.95rem; font-weight: 500; }

/* 總金額區塊 */
.summary-field {
    background: var(--bg-secondary);
    border-radius: 10px;
    padding: 10px;
    border: 1px solid var(--border-color);
}

.summary-field label {
    margin-left: 0;
}

.summary-input {
    font-size: 1.05rem;
    font-weight: 700;
}

/* 按鈕區 */
.form-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 6px;
}

.action-buttons { display: flex; gap: 12px; justify-content: flex-end; width: 100%; }
.btn { 
    flex: 1; 
    padding: 12px; 
    border: none; 
    border-radius: 12px; 
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

.btn-submit { color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.btn-submit.buy { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); }
.btn-submit.sell { background: linear-gradient(135deg, var(--success), #059669); }
.btn-submit.div { background: linear-gradient(135deg, var(--warning), #d97706); }

.btn-submit:hover { opacity: 0.95; transform: translateY(-1px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); }
.btn-submit:active { transform: translateY(0); }
.btn-submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; filter: grayscale(0.5); }

.spinner {
    width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* RWD Media Queries */
@media (max-width: 768px) {
    .trade-panel { 
        border: none; 
        box-shadow: none; 
        padding: 0; 
        background: transparent;
    }
    
    .panel-header { display: none; } /* 手機版通常有 Sheet Header，隱藏內部標題 */
    
    .form-grid { 
        grid-template-columns: 1fr; /* 強制單欄 */
        gap: 12px; 
    }
    
    .form-group.span-2,
    .form-group.span-3 { grid-column: span 1; }
    
    /* 輸入框更加寬大舒適 */
    input { font-size: 1.05rem; padding: 12px; }
    
    .dual-input { gap: 16px; }
    
    .switch-btn { padding: 12px; }

    .form-footer {
        justify-content: center;
    }

    .action-buttons { flex-direction: row; }
}
</style>
