<template>
  <div class="card trade-panel" :class="form.txn_type.toLowerCase() + '-mode'" id="trade-form-anchor">
    <div class="panel-header">
        <h3 class="panel-title">{{ isEditing ? '編輯交易' : '新增交易' }}</h3>
        <span class="mode-badge" v-if="isEditing">EDITING</span>
    </div>
    
    <div class="trade-type-switch">
        <button v-for="t in ['BUY', 'SELL', 'DIV']" :key="t"
            :class="['switch-btn', t.toLowerCase(), { active: form.txn_type === t }]"
            @click="setTxnType(t)" type="button">
            <span class="btn-icon">{{ t === 'BUY' ? '📥' : t === 'SELL' ? '📤' : '💰' }}</span>
            <span class="btn-text">{{ t === 'BUY' ? '買進' : t === 'SELL' ? '賣出' : '股息' }}</span>
        </button>
    </div>
    <p class="entry-context">記錄實際成交，不會向券商送出訂單</p>

    <div class="form-grid">
        <div class="form-group full">
            <label>交易標的 Symbol</label>
            <div class="input-wrapper">
                <input 
                    type="text" 
                    v-model="form.symbol" 
                    @change="checkHoldings" 
                    placeholder="如: NVDA, TSLA, 2330.TW" 
                    :disabled="isEditing" 
                    :aria-invalid="validationAttempted && !!validationErrors.symbol"
                    class="input-lg uppercase bold-text"
                >
            </div>
            <p v-if="validationAttempted && validationErrors.symbol" class="field-error" role="alert">{{ validationErrors.symbol }}</p>
        </div>
        
        <div class="form-group">
            <label>日期 Date</label>
            <input type="date" v-model="form.txn_date" class="input-md">
        </div>
        
        <div class="form-group">
            <label>成交單價 ({{ transactionCurrency }})</label>
            <div class="input-with-prefix">
                <span class="prefix">{{ transactionCurrencySymbol }}</span>
                <input 
                    type="number" 
                    v-model="form.price" 
                    placeholder="0.00" 
                    class="input-md font-num" 
                    step="0.0001"
                    inputmode="decimal"
                    :aria-invalid="validationAttempted && !!validationErrors.executionValue"
                >
            </div>
            <p v-if="validationAttempted && validationErrors.executionValue" class="field-error" role="alert">{{ validationErrors.executionValue }}</p>
        </div>

        <div class="form-group full shares-fee-row">
            <div class="triple-input">
                <div class="input-with-label">
                    <label>股數 Shares</label>
                    <input 
                        type="number" 
                        v-model="form.qty" 
                        placeholder="0" 
                        class="input-md font-num" 
                        step="0.0001"
                        inputmode="decimal"
                        :aria-invalid="validationAttempted && !!validationErrors.qty"
                    >
                    <p v-if="validationAttempted && validationErrors.qty" class="field-error" role="alert">{{ validationErrors.qty }}</p>
                </div>
                <div class="input-with-label">
                    <label>手續費 Fee</label>
                    <input type="number" v-model="form.fee" placeholder="0" class="font-num" step="0.01" inputmode="decimal">
                </div>
                <div class="input-with-label">
                    <label>稅金 Tax</label>
                    <input type="number" v-model="form.tax" placeholder="0" class="font-num" step="0.01" inputmode="decimal">
                </div>
            </div>
        </div>

        <div class="form-group full">
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
                <p v-if="validationAttempted && validationErrors.sellGroups" class="field-error" role="alert">{{ validationErrors.sellGroups }}</p>
            </div>
            
            <div class="tag-input-container" :class="{ disabled: form.txn_type === 'SELL' && holdingGroups.length > 0 }">
                <div class="tags-list">
                    <span v-for="(tag, idx) in tagsArray" :key="idx" class="tag-chip">
                        {{ tag }}
                        <button type="button" class="remove-tag" @click="removeTag(idx)" :aria-label="`移除標籤 ${tag}`">×</button>
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
                <button type="button" v-for="t in commonTags" :key="t" @click="pushTag(t)" class="quick-tag">+ {{ t }}</button>
            </div>
        </div>

        <div class="form-group full note-group">
            <div class="note-label-row">
                <label for="trade-note">交易備註 / 投資理由</label>
                <span class="note-count">{{ (form.note || '').length }} / 2000</span>
            </div>
            <textarea
                id="trade-note"
                v-model="form.note"
                class="note-textarea"
                maxlength="2000"
                rows="4"
                placeholder="記錄進場理由、風險、交易計畫或事後檢討…"
            ></textarea>
        </div>
    </div>

    <div class="summary-box">
        <div class="summary-header">
            <span class="summary-label">成交金額（未含費稅，{{ transactionCurrency }}）</span>
            <span class="calc-icon">🧮</span>
        </div>
        <div class="summary-input-wrapper">
            <span class="currency-symbol">{{ transactionCurrencySymbol }}</span>
            <input 
                type="number" 
                v-model="form.total_amount" 
                class="summary-value" 
                step="0.01" 
                placeholder="0.00"
                inputmode="decimal"
                :aria-invalid="validationAttempted && !!validationErrors.executionValue"
            >
        </div>
        <p class="field-help">可填成交單價或成交金額其中之一；若兩者都填，以成交單價記錄交易。</p>
    </div>
    
    <div class="action-buttons">
        <button v-if="isEditing" type="button" @click="resetForm" class="btn btn-cancel">取消</button>
        <button type="button" class="btn btn-submit" @click="submit" :disabled="loading" :class="form.txn_type.toLowerCase()">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? '處理中...' : (isEditing ? '更新交易' : submitButtonText) }}
        </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch, onUnmounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import { formatLocalCalendarDate } from '../services/calendarDate';
import {
    detectNativeCurrency,
    getCurrencyInputAffix,
} from '../services/instrumentCurrency.js';
import { subscribeRecordCreateRecoverySuccess } from '../services/recordCreateRecoverySignal.js';

const emit = defineEmits(['submitted']);
const store = usePortfolioStore();
const auth = useAuthStore();
const { addToast } = useToast();
const loading = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const validationAttempted = ref(false);
let unresolvedCreateBody = null;

const tagInput = ref('');
const selectedSellGroups = ref([]);
const holdingGroups = ref([]);

// Keep the long-standing financial form declaration stable; journal-only metadata
// is attached additively so existing transaction/idempotency contracts remain intact.
const form = reactive({
    txn_date: formatLocalCalendarDate(),
    symbol: '', 
    txn_type: 'BUY', 
    qty: '', 
    price: '', 
    fee: '', 
    tax: '', 
    total_amount: '',
    tag: '' 
});
const journalDefaults = Object.freeze({ note: '' });
Object.assign(form, journalDefaults);

const normalizedSymbol = computed(() => String(form.symbol || '').trim().toUpperCase());
const transactionCurrency = computed(() => detectNativeCurrency(normalizedSymbol.value));
const transactionCurrencySymbol = computed(() => getCurrencyInputAffix(transactionCurrency.value));

const submitButtonText = computed(() => {
    switch(form.txn_type) {
        case 'BUY': return '記錄買進';
        case 'SELL': return '記錄賣出';
        case 'DIV': return '記錄股息';
        default: return '記錄交易';
    }
});

const tagsArray = computed(() => {
    return (form.tag || '').split(/[,;]/).map(t=>t.trim()).filter(t=>t);
});

const commonTags = computed(() => {
    return store.availableGroups.filter(g => g !== 'all' && !tagsArray.value.includes(g));
});

const validationErrors = computed(() => ({
    symbol: !form.symbol ? '請輸入交易標的 Symbol' : '',
    qty: !form.qty ? '請輸入股數' : '',
    executionValue: (!form.price && !form.total_amount) ? '請輸入成交單價或成交金額' : '',
    sellGroups: (
        form.txn_type === 'SELL'
        && holdingGroups.value.length > 0
        && selectedSellGroups.value.length === 0
    ) ? '請勾選要賣出的群組' : '',
}));

const firstValidationError = computed(() => (
    validationErrors.value.symbol
    || validationErrors.value.qty
    || validationErrors.value.executionValue
    || validationErrors.value.sellGroups
    || ''
));

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

const buildRecordPayload = () => {
    const payload = { ...form };
    ['qty', 'price', 'fee', 'tax', 'total_amount'].forEach(k => payload[k] = parseFloat(payload[k] || 0));
    payload.note = String(payload.note || '').slice(0, 2000);
    if (payload.qty > 0) {
        if (payload.price <= 0 && payload.total_amount > 0) {
            payload.price = payload.total_amount / payload.qty;
        } else if (payload.total_amount <= 0 && payload.price > 0) {
            payload.total_amount = payload.price * payload.qty;
        }
    }
    return payload;
};

const submit = async () => {
    validationAttempted.value = true;
    if (firstValidationError.value) {
        addToast(firstValidationError.value, 'error');
        return;
    }
    
    if (!auth.token || auth.isTokenExpired()) {
        addToast("登入已過期，請重新登入", "error");
        setTimeout(() => auth.logout(), 2000);
        return;
    }
    
    loading.value = true;
    try {
        const payload = buildRecordPayload();
        
        let success = false;
        if (isEditing.value) {
            unresolvedCreateBody = null;
            payload.id = editingId.value;
            success = await store.updateRecord(payload);
        } else {
            unresolvedCreateBody = JSON.stringify(payload);
            success = await store.addRecord(payload);
        }
        
        if (success) {
            resetForm();
            emit('submitted');
        }
    } catch(e) { 
        console.error('❌ 提交錯誤:', e);
    } finally { 
        loading.value = false; 
    }
};

const resetForm = () => {
    unresolvedCreateBody = null;
    validationAttempted.value = false;
    isEditing.value = false; 
    editingId.value = null;
    form.txn_date = formatLocalCalendarDate();
    form.symbol = ''; 
    form.qty = ''; 
    form.price = ''; 
    form.fee = '';
    form.tax = '';
    form.total_amount = '';
    form.tag = '';
    form.note = '';
    form.txn_type = 'BUY';
    holdingGroups.value = [];
    selectedSellGroups.value = [];
    tagInput.value = '';
};

const setupForm = (r) => {
    unresolvedCreateBody = null;
    validationAttempted.value = false;
    isEditing.value = true; 
    editingId.value = r.id;
    Object.keys(form).forEach(k => form[k] = r[k]);
    form.note = r.note || '';
    checkHoldings();
};

const normalizeRecoveryOwner = value => (
    typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const unsubscribeRecordCreateRecovery = subscribeRecordCreateRecoverySuccess(event => {
    if (isEditing.value || !unresolvedCreateBody) return;
    if (event.owner !== normalizeRecoveryOwner(auth.user?.email)) return;
    if (event.body !== unresolvedCreateBody) return;

    const recoveredBody = unresolvedCreateBody;
    unresolvedCreateBody = null;

    let currentBody = null;
    try {
        currentBody = JSON.stringify(buildRecordPayload());
    } catch {
        currentBody = null;
    }

    if (currentBody !== recoveredBody) {
        addToast('先前未確認的新增交易已自動確認；目前表單已修改，已保留新的輸入', 'info');
        return;
    }

    resetForm();
    emit('submitted');
    addToast('先前未確認的新增交易已自動確認，表單已清空', 'success');
});

onUnmounted(() => unsubscribeRecordCreateRecovery());

defineExpose({ setupForm, resetForm });
</script>

<style scoped>
/* 基礎面板 */
.trade-panel { 
    background: var(--bg-card); 
    border: 1px solid var(--border-color); 
    padding: 24px; 
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
    margin-bottom: 20px;
}

.panel-title { margin: 0; font-size: 1.25rem; color: var(--text-main); font-weight: 700; }
.mode-badge { font-size: 0.75rem; background: var(--warning); color: white; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
.entry-context { margin: -14px 0 18px; color: var(--text-sub); font-size: 0.78rem; }

/* 交易類型切換 (Segmented Control) */
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
    font-weight: 600; 
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
    grid-template-columns: 1fr 1fr; 
    gap: 20px; 
    margin-bottom: 24px; 
}

.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group.full { grid-column: span 2; }

label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; margin-left: 2px; }

/* 輸入框通用樣式 */
input { 
    padding: 12px 14px; 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    font-size: 1rem; 
    width: 100%; 
    box-sizing: border-box; 
    font-family: 'Inter', sans-serif;
    transition: all 0.2s; 
    color: var(--text-main); 
    background: var(--bg-card); 
    height: 46px; /* 增加觸控高度 */
}

input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
input:disabled { background: var(--bg-secondary); cursor: not-allowed; opacity: 0.7; }
input[aria-invalid="true"] { border-color: var(--danger); }

.font-num { font-family: 'JetBrains Mono', monospace; }
.uppercase { text-transform: uppercase; }
.bold-text { font-weight: 700; }

/* 帶前綴的輸入框 */
.input-with-prefix { position: relative; }
.prefix { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.input-with-prefix input { padding-left: 38px; }
.field-help { margin: 0; color: var(--text-sub); font-size: 0.75rem; line-height: 1.45; }
.field-error { margin: 0; color: var(--danger); font-size: 0.78rem; font-weight: 600; line-height: 1.4; }

/* 雙欄輸入 (費用) */
.dual-input { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.input-with-label { display: flex; flex-direction: column; }
.sub-label { font-size: 0.75rem; color: var(--text-sub); text-align: center; margin-top: 4px; }

/* 三欄均分輸入 (股數、手續費、稅金) - 桌機版 */
.triple-input { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.triple-input .input-with-label { align-items: center; }
.triple-input .input-with-label label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; margin-bottom: 8px; text-align: center; }
.triple-input .input-with-label input { text-align: center; }

/* 標籤輸入區 */
.tag-input-container { 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    padding: 8px; 
    background: var(--bg-card); 
    display: flex; 
    flex-wrap: wrap; 
    gap: 6px; 
    min-height: 48px; 
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

.quick-tags { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
.quick-tag { 
    font-family: inherit;
    font-size: 0.8rem; 
    color: var(--text-sub); 
    border: 1px solid var(--border-color); 
    padding: 4px 10px; 
    border-radius: 12px; 
    cursor: pointer; 
    transition: all 0.2s; 
    background: var(--bg-card);
}
.quick-tag:hover { border-color: var(--primary); color: var(--primary); background: rgba(59, 130, 246, 0.05); }

.note-label-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.note-count { font-size: 0.75rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.note-textarea {
    width: 100%;
    min-height: 96px;
    padding: 12px 14px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    resize: vertical;
    box-sizing: border-box;
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    line-height: 1.5;
    color: var(--text-main);
    background: var(--bg-card);
    transition: all 0.2s;
}
.note-textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

/* 賣出提示 (Smart Sell) */
.smart-sell-options { background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 12px; }
.hint-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.hint-text { font-size: 0.85rem; color: var(--warning); font-weight: 600; }
.checkbox-group { display: flex; gap: 12px; flex-wrap: wrap; }
.tag-checkbox { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
.tag-checkbox input { width: 18px; height: 18px; margin: 0; }
.tag-name { font-size: 0.95rem; font-weight: 500; }

/* 總金額摘要 (Calculator Style) */
.summary-box { 
    background: var(--bg-secondary); 
    padding: 20px; 
    border-radius: 12px; 
    margin-bottom: 24px; 
    border: 1px solid var(--border-color); 
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.summary-header { display: flex; justify-content: space-between; align-items: center; color: var(--text-sub); }
.summary-label { font-size: 0.9rem; font-weight: 600; }
.summary-input-wrapper { display: flex; align-items: baseline; justify-content: flex-end; gap: 4px; }
.currency-symbol { font-size: 1.5rem; color: var(--text-main); font-weight: 500; }
.summary-value { 
    background: transparent; 
    border: none; 
    text-align: right; 
    font-size: 2.2rem; 
    font-weight: 700; 
    color: var(--text-main); 
    padding: 0; 
    width: 100%; 
    box-shadow: none; 
    height: auto;
    font-family: 'JetBrains Mono', monospace;
}
.summary-value:focus { box-shadow: none; }

/* 按鈕區 */
.action-buttons { display: flex; gap: 16px; margin-top: auto; }
.btn { 
    flex: 1; 
    padding: 14px; 
    border: none; 
    border-radius: 12px; 
    font-weight: 600; 
    cursor: pointer; 
    transition: all 0.2s; 
    font-size: 1.05rem; 
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
    .entry-context { margin-top: -12px; }
    
    .form-grid { 
        grid-template-columns: 1fr; /* 強制單欄 */
        gap: 16px; 
    }
    
    .form-group.full { grid-column: span 1; }
    
    /* 輸入框更加寬大舒適 */
    input, .note-textarea { font-size: 1.1rem; padding: 14px; }
    
    .dual-input { gap: 16px; }
    
    /* 手機版：股數整列，費用與稅金並排，減少表單高度 */
    .triple-input { grid-template-columns: 1fr 1fr; gap: 16px; }
    .triple-input .input-with-label:first-child { grid-column: 1 / -1; }
    .triple-input .input-with-label { align-items: flex-start; }
    .triple-input .input-with-label label { text-align: left; }
    .triple-input .input-with-label input { text-align: left; }
    
    .summary-value { font-size: 2rem; }
    
    .switch-btn { padding: 12px; }
}

@media (max-width: 380px) {
    .triple-input { grid-template-columns: 1fr; }
    .triple-input .input-with-label:first-child { grid-column: auto; }
}
</style>
