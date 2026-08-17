<template>
  <div class="cash-page">
    <section class="card cash-header">
      <div>
        <p class="eyebrow">Ledger Truth · Cash</p>
        <h2>現金管理</h2>
        <p class="subtitle">記錄各幣別期初現金、入金與出金。這些資料目前只建立可信現金帳本，尚未納入總資產與績效。</p>
      </div>
      <button type="button" class="btn-secondary" :disabled="loading || saving" @click="loadEvents">{{ loading ? '更新中…' : '重新整理' }}</button>
    </section>

    <div class="cash-boundary" role="note">
      <strong>目前不影響 NAV / TWR / XIRR</strong>
      <span>交易與配息的現金效果仍由既有交易紀錄推導；請不要把 BUY、SELL、DIV 再手動輸入成現金事件。</span>
    </div>

    <section v-if="pendingIntent" class="card pending-card" role="status">
      <div>
        <strong>上一筆新增結果待確認</strong>
        <p>{{ eventTypeLabel(pendingIntent.event.event_type) }} · {{ pendingIntent.event.currency }} · {{ pendingIntent.event.event_date }}。使用原 Idempotency-Key 再送一次可安全確認，不會重複入帳。</p>
      </div>
      <button type="button" class="btn-primary" :disabled="saving" @click="reconcilePending">{{ saving ? '確認中…' : '確認上一筆結果' }}</button>
    </section>

    <section class="card cash-editor">
      <div class="section-title-row">
        <div>
          <h3>{{ editing ? '修改現金紀錄' : '新增現金紀錄' }}</h3>
          <p>{{ editing ? '儲存時會檢查你編輯的仍是最新版本，避免覆蓋其他分頁的變更。' : '每個幣別只能有一筆期初現金；入金與出金請輸入正數。' }}</p>
        </div>
        <button v-if="editing" type="button" class="btn-link" :disabled="saving" @click="resetForm">取消修改</button>
      </div>

      <div v-if="form.event_type === 'OPENING_BALANCE'" class="opening-guidance" role="note">
        <strong>期初現金是「已知基準」，不是系統推算值</strong>
        <span>請填入你能確認的實際現金餘額。基準日前的交易／入出金會視為已包含在這個金額內；基準日若同時有 BUY、SELL、DIV、入金或出金，因目前沒有日內先後順序，現金帳本仍會保持待確認。不要為了完成狀態而猜測金額或自動填 0。</span>
      </div>

      <form class="cash-form" @submit.prevent="submitForm">
        <label>
          <span>類型</span>
          <select v-model="form.event_type" :disabled="saving">
            <option value="OPENING_BALANCE">期初現金</option>
            <option value="DEPOSIT">入金</option>
            <option value="WITHDRAWAL">出金</option>
          </select>
        </label>
        <label>
          <span>日期</span>
          <input v-model="form.event_date" type="date" required :disabled="saving" />
        </label>
        <label>
          <span>幣別</span>
          <input v-model="form.currency" type="text" inputmode="text" maxlength="3" autocapitalize="characters" placeholder="USD" required :disabled="saving" @input="normalizeCurrency" />
        </label>
        <label>
          <span>金額</span>
          <input v-model="form.amount" type="number" step="any" :min="form.event_type === 'OPENING_BALANCE' ? undefined : '0.00000001'" required :disabled="saving" />
          <small v-if="form.event_type === 'OPENING_BALANCE'">期初現金可為正、零或負數（例如融資 / debit cash）。</small>
          <small v-else>入金／出金請輸入正數，方向由類型決定。</small>
        </label>
        <label class="note-field">
          <span>備註（選填）</span>
          <input v-model="form.note" type="text" maxlength="500" placeholder="例如：首次建帳、外部匯款" :disabled="saving" />
        </label>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving || (!editing && !!pendingIntent)">{{ saving ? '處理中…' : (editing ? '儲存修改' : '新增紀錄') }}</button>
        </div>
      </form>
    </section>

    <section class="card cash-list-card">
      <div class="section-title-row">
        <div>
          <h3>現金流水</h3>
          <p>依事件日期排序；建立時間不是財務事件時間。</p>
        </div>
        <span class="count-badge">{{ events.length }} 筆</span>
      </div>

      <div v-if="loading && events.length === 0" class="empty-state">正在載入現金紀錄…</div>
      <div v-else-if="loadError && events.length === 0" class="empty-state error-state">{{ loadError }}</div>
      <div v-else-if="events.length === 0" class="empty-state">目前沒有現金紀錄。新增表單會先切到「期初現金」；請用你能確認的實際基準餘額開始，不要把第一筆交易金額當成期初現金。</div>

      <div v-else class="cash-table-wrap">
        <table class="cash-table">
          <thead><tr><th>日期</th><th>類型</th><th>幣別</th><th class="amount-col">金額</th><th>備註</th><th class="action-col">操作</th></tr></thead>
          <tbody>
            <tr v-for="event in events" :key="event.id">
              <td class="mono">{{ event.event_date }}</td>
              <td><span class="type-pill" :class="event.event_type.toLowerCase()">{{ eventTypeLabel(event.event_type) }}</span></td>
              <td class="mono currency">{{ event.currency }}</td>
              <td class="mono amount-col" :class="amountClass(event)">{{ displayAmount(event) }}</td>
              <td class="note-cell">{{ event.note || '—' }}</td>
              <td class="action-col">
                <button type="button" class="btn-link" :disabled="saving" @click="editEvent(event)">修改</button>
                <button type="button" class="btn-link danger" :disabled="saving" @click="removeEvent(event)">刪除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';
import { createCashEvent, deleteCashEvent, fetchCashEvents, normalizeCashEventState, updateCashEvent } from '../services/cashEventApi.js';
import { beginCashCreateIntent, completeCashCreateIntent, readCashCreateIntent } from '../services/cashCreateIntent.js';
import { formatRequestError } from '../services/requestErrors.js';
import { formatCashEventAmount, localCalendarDate } from '../services/cashEventPresentation.js';

const authStore = useAuthStore();
const { addToast } = useToast();
const events = ref([]);
const loading = ref(false);
const saving = ref(false);
const loadError = ref('');
const editing = ref(null);
const pendingIntent = ref(null);

const freshForm = () => ({ event_date: localCalendarDate(), event_type: 'DEPOSIT', amount: '', currency: 'USD', note: '' });
const form = reactive(freshForm());
const apiOptions = () => ({ apiBaseUrl: CONFIG.API_BASE_URL, token: authStore.token });
const owner = () => authStore.user?.email;

const eventTypeLabel = (type) => ({ OPENING_BALANCE: '期初現金', DEPOSIT: '入金', WITHDRAWAL: '出金' }[type] || type);
const normalizeCurrency = () => { form.currency = String(form.currency || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); };
const expectedState = (event) => normalizeCashEventState(event);
const amountClass = (event) => ({ positive: event.event_type === 'DEPOSIT' || (event.event_type === 'OPENING_BALANCE' && event.amount > 0), negative: event.event_type === 'WITHDRAWAL' || (event.event_type === 'OPENING_BALANCE' && event.amount < 0) });
const displayAmount = (event) => formatCashEventAmount(event);
const isUntouchedCreateForm = () => {
  if (editing.value) return false;
  const pristine = freshForm();
  return Object.entries(pristine).every(([key, value]) => form[key] === value);
};

const refreshPendingIntent = () => {
  try { pendingIntent.value = readCashCreateIntent(localStorage, owner()); }
  catch (error) { console.error('Cash pending intent read failed:', error); pendingIntent.value = null; }
};

const loadEvents = async ({ silent = false } = {}) => {
  if (!silent) loading.value = true;
  loadError.value = '';
  try {
    events.value = [...await fetchCashEvents(apiOptions())];
    return true;
  } catch (error) {
    console.error('Cash events load failed:', error);
    loadError.value = formatRequestError(error, { action: '載入現金紀錄', method: 'GET' });
    if (!silent) addToast(loadError.value, 'error');
    return false;
  } finally {
    if (!silent) loading.value = false;
  }
};

const resetForm = () => {
  editing.value = null;
  Object.assign(form, freshForm());
};

const editEvent = (event) => {
  editing.value = event;
  Object.assign(form, expectedState(event), { amount: String(event.amount) });
  window.scrollTo?.({ top: 0, behavior: 'smooth' });
};

const handleConflict = async (error) => {
  if (!['CASH_EVENT_CHANGED', 'OPENING_BALANCE_EXISTS'].includes(error?.apiCode)) return false;
  await loadEvents({ silent: true });
  resetForm();
  addToast(error.apiCode === 'CASH_EVENT_CHANGED'
    ? '這筆現金紀錄已在其他操作中變更，已載入最新狀態，請確認後再修改。'
    : '同一幣別只能有一筆期初現金，已載入目前紀錄。', 'warning');
  return true;
};

const submitForm = async () => {
  if (saving.value) return;
  let event;
  try { event = normalizeCashEventState({ ...form, amount: Number(form.amount) }); }
  catch (error) { addToast(error.message, 'error'); return; }
  const wasEditing = !!editing.value;
  let attemptedCreateIntent = null;
  saving.value = true;
  try {
    if (wasEditing) {
      await updateCashEvent({ ...apiOptions(), id: editing.value.id, expected: expectedState(editing.value), event });
      addToast('現金紀錄已更新', 'success');
      resetForm();
    } else {
      const intent = beginCashCreateIntent(localStorage, owner(), event);
      pendingIntent.value = intent;
      attemptedCreateIntent = intent;
      const result = await createCashEvent({ ...apiOptions(), event: intent.event, idempotencyKey: intent.idempotencyKey });
      completeCashCreateIntent(localStorage, owner(), intent.idempotencyKey);
      pendingIntent.value = null;
      addToast(result.deduplicated ? '已確認上一筆現金紀錄，沒有重複新增' : '現金紀錄已新增', 'success');
      resetForm();
    }
    await loadEvents({ silent: true });
  } catch (error) {
    console.error('Cash mutation failed:', error);

    // Only a request that was actually sent may retire its pending create intent.
    // Local validation/pending-intent errors must preserve the earlier unresolved intent.
    if (attemptedCreateIntent && error?.outcomeAmbiguous !== true) {
      completeCashCreateIntent(localStorage, owner(), attemptedCreateIntent.idempotencyKey);
      pendingIntent.value = null;
    }

    if (await handleConflict(error)) return;

    if (wasEditing && error?.outcomeAmbiguous === true) {
      const refreshed = await loadEvents({ silent: true });
      resetForm();
      addToast(
        refreshed
          ? '修改結果不確定，已重新載入伺服器目前狀態，請確認後再操作。'
          : '修改結果不確定，且目前無法重新載入資料。請重新整理頁面確認結果。',
        'warning',
      );
      return;
    }

    addToast(formatRequestError(error, { action: wasEditing ? '修改現金紀錄' : '新增現金紀錄', method: wasEditing ? 'PUT' : 'POST' }), error?.outcomeAmbiguous ? 'warning' : 'error');
  } finally { saving.value = false; }
};

const reconcilePending = async () => {
  if (!pendingIntent.value || saving.value) return;
  saving.value = true;
  const intent = pendingIntent.value;
  try {
    const result = await createCashEvent({ ...apiOptions(), event: intent.event, idempotencyKey: intent.idempotencyKey });
    completeCashCreateIntent(localStorage, owner(), intent.idempotencyKey);
    pendingIntent.value = null;
    addToast(result.deduplicated ? '已確認上一筆操作：伺服器先前已完成，沒有重複入帳' : '上一筆操作已安全完成', 'success');
    await loadEvents({ silent: true });
  } catch (error) {
    // A failed replay does not resolve the earlier ambiguous POST. Keep the exact
    // intent/key so a later authenticated retry cannot accidentally create a duplicate.
    if (await handleConflict(error)) return;
    addToast(formatRequestError(error, { action: '確認現金新增', method: 'POST' }), error?.outcomeAmbiguous ? 'warning' : 'error');
  } finally { saving.value = false; }
};

const removeEvent = async (event) => {
  if (saving.value || !confirm(`確定刪除 ${event.event_date} 的「${eventTypeLabel(event.event_type)} ${event.currency} ${displayAmount(event)}」嗎？`)) return;
  saving.value = true;
  try {
    await deleteCashEvent({ ...apiOptions(), id: event.id, expected: expectedState(event) });
    addToast('現金紀錄已刪除', 'success');
    if (editing.value?.id === event.id) resetForm();
    await loadEvents({ silent: true });
  } catch (error) {
    if (await handleConflict(error)) return;
    addToast(formatRequestError(error, { action: '刪除現金紀錄', method: 'DELETE' }), error?.outcomeAmbiguous ? 'warning' : 'error');
    if (error?.outcomeAmbiguous) {
      await loadEvents({ silent: true });
      if (editing.value?.id === event.id) resetForm();
    }
  } finally { saving.value = false; }
};

onMounted(async () => {
  refreshPendingIntent();
  const loaded = await loadEvents();
  if (loaded && events.value.length === 0 && !pendingIntent.value && isUntouchedCreateForm()) {
    form.event_type = 'OPENING_BALANCE';
  }
});
</script>

<style scoped>
.cash-page { display: grid; gap: 16px; }
.cash-header, .section-title-row, .pending-card { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.cash-header h2, .cash-editor h3, .cash-list-card h3 { margin: 0; }
.eyebrow { margin: 0 0 5px; color: var(--primary); font-size: var(--type-label); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.subtitle, .section-title-row p, .pending-card p { margin: 6px 0 0; color: var(--text-sub); font-size: var(--type-label); line-height: 1.55; }
.cash-boundary, .opening-guidance { display: grid; gap: 4px; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border-color)); border-radius: 12px; background: color-mix(in srgb, var(--primary) 7%, var(--bg-card)); }
.cash-boundary span, .opening-guidance span { color: var(--text-sub); font-size: var(--type-label); line-height: 1.55; }
.opening-guidance { margin-top: 14px; }
.pending-card { border-color: color-mix(in srgb, #d97706 45%, var(--border-color)); }
.cash-form { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.cash-form label { display: grid; gap: 6px; min-width: 0; }
.cash-form label > span { color: var(--text-sub); font-size: var(--type-label); font-weight: 600; }
.cash-form input, .cash-form select { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 11px; background: var(--bg-secondary); color: var(--text-main); }
.cash-form small { color: var(--text-sub); line-height: 1.4; }
.note-field { grid-column: span 3; }
.form-actions { display: flex; align-items: end; justify-content: flex-end; }
.btn-primary, .btn-secondary { border-radius: 10px; padding: 10px 14px; cursor: pointer; font-weight: 700; }
.btn-primary { border: 1px solid var(--primary); background: var(--primary); color: white; }
.btn-secondary { border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); }
.btn-primary:disabled, .btn-secondary:disabled, .btn-link:disabled { opacity: .55; cursor: not-allowed; }
.btn-link { border: 0; background: transparent; color: var(--primary); cursor: pointer; padding: 5px; }
.btn-link.danger { color: #dc2626; }
.count-badge { border: 1px solid var(--border-color); border-radius: 999px; padding: 5px 9px; color: var(--text-sub); font-size: var(--type-label); }
.cash-table-wrap { overflow-x: auto; margin-top: 14px; }
.cash-table { width: 100%; border-collapse: collapse; min-width: 720px; }
.cash-table th, .cash-table td { padding: 11px 9px; border-bottom: 1px solid var(--border-color); text-align: left; vertical-align: middle; }
.cash-table th { color: var(--text-sub); font-size: var(--type-label); }
.amount-col { text-align: right !important; }
.action-col { text-align: right !important; white-space: nowrap; }
.mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
.currency { font-weight: 700; }
.positive { color: #059669; }
.negative { color: #dc2626; }
.type-pill { display: inline-flex; border-radius: 999px; padding: 4px 8px; font-size: var(--type-label); background: var(--bg-secondary); border: 1px solid var(--border-color); white-space: nowrap; }
.note-cell { max-width: 260px; overflow-wrap: anywhere; }
.empty-state { margin-top: 14px; padding: 28px 16px; text-align: center; color: var(--text-sub); border: 1px dashed var(--border-color); border-radius: 12px; }
.error-state { color: #dc2626; }
@media (max-width: 900px) {
  .cash-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .note-field { grid-column: span 2; }
  .form-actions { grid-column: span 2; }
}
@media (max-width: 600px) {
  .cash-header, .section-title-row, .pending-card { flex-direction: column; align-items: stretch; }
  .cash-form { grid-template-columns: 1fr; }
  .note-field, .form-actions { grid-column: auto; }
  .form-actions .btn-primary, .pending-card .btn-primary { width: 100%; }
}
</style>