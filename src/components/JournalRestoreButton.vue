<template>
  <div class="journal-restore-action">
    <input
      ref="fileInput"
      class="restore-file-input"
      type="file"
      accept=".json,application/json"
      @change="handleFileChange"
    >
    <button
      type="button"
      class="restore-button"
      :disabled="checking || busy"
      :aria-busy="checking || busy"
      aria-label="檢查交易紀錄與現金事件備份並安全還原"
      title="先驗證備份與目前帳戶；只有空白帳戶且伺服器能力可用時才可確認還原"
      @click="chooseFile"
    >
      <span aria-hidden="true">{{ checking || busy ? '⏳' : '↥' }}</span>
      <span>{{ checking ? '檢查中…' : busy ? '處理中…' : '還原備份' }}</span>
    </button>

    <div
      v-if="preview || previewError"
      class="restore-dialog-backdrop"
      role="presentation"
      @click.self="closePreview"
    >
      <section
        class="restore-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-preview-title"
      >
        <div class="restore-dialog-header">
          <div>
            <h3 id="restore-preview-title">安全還原</h3>
            <p>先驗證備份與目前帳戶，再確認正式還原。系統不會合併、覆寫或刪除既有交易資料。</p>
          </div>
          <button
            type="button"
            class="restore-close"
            aria-label="關閉安全還原"
            :disabled="busy"
            @click="closePreview"
          >✕</button>
        </div>

        <div v-if="previewError" class="restore-result error" role="alert">
          <strong>無法使用這份備份</strong>
          <span>{{ previewError }}</span>
        </div>

        <template v-else-if="preview">
          <div class="restore-count-grid">
            <div class="restore-count-card">
              <span>備份交易</span>
              <strong>{{ preview.backup_counts.records }}</strong>
            </div>
            <div class="restore-count-card">
              <span>備份現金事件</span>
              <strong>{{ preview.backup_counts.cash_events }}</strong>
            </div>
            <div class="restore-count-card">
              <span>目前交易</span>
              <strong>{{ preview.current_counts.records }}</strong>
            </div>
            <div class="restore-count-card">
              <span>目前現金事件</span>
              <strong>{{ preview.current_counts.cash_events }}</strong>
            </div>
          </div>

          <div v-if="preview.status === 'already_restored'" class="restore-result success">
            <strong>目前資料已與備份一致</strong>
            <span>交易與現金事件已用完整可還原欄位逐筆計數比對，不需要再次寫入。</span>
          </div>

          <template v-else-if="preview.status === 'empty_ready'">
            <div class="restore-result ready">
              <strong>空白帳戶，可準備安全還原</strong>
              <span>
                預計建立 {{ preview.planned_creates.records }} 筆交易與
                {{ preview.planned_creates.cash_events }} 筆現金事件。正式送出前仍會再次確認伺服器能力。
              </span>
            </div>

            <div v-if="capability.status === 'checking'" class="restore-result neutral" role="status">
              <strong>正在確認正式還原能力…</strong>
              <span>這是非寫入檢查，不會改變任何交易或現金資料。</span>
            </div>

            <div v-else-if="capability.status === 'unavailable'" class="restore-result blocked" role="alert">
              <strong>正式還原目前尚未啟用</strong>
              <span>{{ capabilityMessage }}</span>
              <button type="button" class="restore-inline-action" :disabled="busy" @click="checkCapability">
                重新檢查
              </button>
            </div>

            <div v-else-if="capability.status === 'available'" class="restore-capability" role="status">
              <span class="restore-capability-dot" aria-hidden="true"></span>
              <span>伺服器已通過非寫入 capability 檢查</span>
            </div>

            <div v-if="executionState === 'ambiguous'" class="restore-result warning" role="alert">
              <strong>還原結果待確認</strong>
              <span>{{ restoreMessage }}</span>
              <span>系統已保留原本的安全識別碼；重新確認不會產生新的 Idempotency-Key。</span>
              <button type="button" class="restore-inline-action primary" :disabled="busy" @click="retryAmbiguousRestore">
                使用原識別碼重新確認
              </button>
            </div>

            <div v-else-if="executionState === 'verification_pending'" class="restore-result warning" role="alert">
              <strong>伺服器已接受還原，仍待權威讀回確認</strong>
              <span>{{ restoreMessage }}</span>
              <button type="button" class="restore-inline-action primary" :disabled="busy" @click="retryAmbiguousRestore">
                重新確認伺服器資料
              </button>
            </div>

            <div v-else-if="executionState === 'error'" class="restore-result error" role="alert">
              <strong>尚未完成安全還原</strong>
              <span>{{ restoreMessage }}</span>
            </div>

            <div v-else-if="executionState === 'success'" class="restore-result success" role="status">
              <strong>交易資料已安全還原</strong>
              <span>{{ restoreMessage }}</span>
              <span v-if="recalculationMessage">{{ recalculationMessage }}</span>
            </div>

            <div v-if="executionState === 'restoring'" class="restore-result neutral" role="status">
              <strong>正在提交原子還原…</strong>
              <span>請保持此視窗開啟；若網路中斷，系統會保留同一個安全識別碼供後續確認。</span>
            </div>

            <div v-else-if="executionState === 'verifying'" class="restore-result neutral" role="status">
              <strong>正在從伺服器重新讀回確認…</strong>
              <span>只有交易與現金事件逐筆一致後，才會宣告還原成功並啟動正常重算。</span>
            </div>

            <div v-if="canStartConfirmation" class="restore-execution-actions">
              <button type="button" class="restore-execute" @click="beginConfirmation">繼續安全還原</button>
            </div>

            <div v-else-if="executionState === 'confirming'" class="restore-confirmation" role="group" aria-label="最終還原確認">
              <strong>最終確認</strong>
              <p>
                你即將在目前空白帳戶建立 {{ preview.planned_creates.records }} 筆交易與
                {{ preview.planned_creates.cash_events }} 筆現金事件。系統不會匯入舊的績效快照；完成讀回驗證後會走正常重新計算流程。
              </p>
              <div class="restore-confirmation-actions">
                <button type="button" class="restore-cancel" @click="cancelConfirmation">返回</button>
                <button type="button" class="restore-execute danger" @click="confirmRestore">確認建立紀錄</button>
              </div>
            </div>
          </template>

          <div v-else class="restore-result blocked">
            <strong>已阻擋自動還原</strong>
            <span>
              目前帳戶已有資料且與備份不完全一致。系統不會用欄位相似度猜測哪些是重複資料，
              也不會覆寫或刪除既有紀錄。
            </span>
          </div>
        </template>

        <div class="restore-dialog-footer">
          <span class="restore-safety-boundary">只允許空白帳戶 · 不合併、不覆寫</span>
          <button type="button" class="restore-done" :disabled="busy" @click="closePreview">完成</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';
import {
  createJournalRestorePreview,
  parseJournalRestoreBackupText,
} from '../services/journalRestorePreview.js';
import {
  executeJournalRestore,
  probeJournalRestoreCapability,
  verifyJournalRestoreReadback,
} from '../services/journalRestoreExecution.js';
import {
  beginJournalRestoreIntent,
  completeJournalRestoreIntent,
  completeJournalRestoreIntentForBackup,
} from '../services/journalRestoreIntent.js';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { addToast } = useToast();
const fileInput = ref(null);
const checking = ref(false);
const preview = ref(null);
const previewError = ref('');
const selectedBackup = ref(null);
const capability = ref({ status: 'unknown', detail: null });
const executionState = ref('idle');
const restoreMessage = ref('');
const recalculationMessage = ref('');

const owner = () => authStore.user?.email || '';
const apiAuthOptions = () => ({
  apiBaseUrl: CONFIG.API_BASE_URL,
  getToken: () => authStore.token,
  refreshToken: () => authStore.refreshToken(),
});
const busy = computed(() => ['restoring', 'verifying'].includes(executionState.value));
const canStartConfirmation = computed(() => (
  preview.value?.status === 'empty_ready'
  && capability.value.status === 'available'
  && executionState.value === 'idle'
));
const capabilityMessage = computed(() => {
  const reason = capability.value.detail?.reason;
  if (reason === 'route_unavailable') return '正式環境尚未提供已審查的還原 route；目前不會送出任何寫入要求。';
  if (reason === 'capability_check_failed') return '目前無法確認伺服器還原能力；為避免誤寫，執行功能保持關閉。';
  return '伺服器沒有回傳已審查的還原 capability contract；執行功能保持關閉。';
});

const resetExecutionState = () => {
  capability.value = { status: 'unknown', detail: null };
  executionState.value = 'idle';
  restoreMessage.value = '';
  recalculationMessage.value = '';
};

const chooseFile = () => {
  if (checking.value || busy.value) return;
  preview.value = null;
  previewError.value = '';
  selectedBackup.value = null;
  resetExecutionState();
  fileInput.value?.click();
};

const resetInput = () => {
  if (fileInput.value) fileInput.value.value = '';
};

const checkCapability = async () => {
  if (busy.value || preview.value?.status !== 'empty_ready') return false;
  capability.value = { status: 'checking', detail: null };
  const detail = await probeJournalRestoreCapability({ apiBaseUrl: CONFIG.API_BASE_URL });
  capability.value = { status: detail.available ? 'available' : 'unavailable', detail };
  if (!detail.available && executionState.value === 'confirming') executionState.value = 'idle';
  return detail.available;
};

const handleFileChange = async (event) => {
  const file = event?.target?.files?.[0];
  if (!file || checking.value || busy.value) {
    resetInput();
    return;
  }

  checking.value = true;
  preview.value = null;
  previewError.value = '';
  selectedBackup.value = null;
  resetExecutionState();
  try {
    const backup = parseJournalRestoreBackupText(await file.text());
    selectedBackup.value = backup;
    preview.value = await createJournalRestorePreview({
      backup,
      ...apiAuthOptions(),
    });

    if (preview.value.status === 'empty_ready') {
      await checkCapability();
    } else if (preview.value.status === 'already_restored') {
      try {
        await completeJournalRestoreIntentForBackup(localStorage, owner(), backup);
      } catch (error) {
        console.warn('Unable to retire matching restore recovery intent:', error);
      }
    }
  } catch (error) {
    console.error('Journal restore preview failed:', error);
    previewError.value = error?.message || '無法確認備份內容';
  } finally {
    checking.value = false;
    resetInput();
  }
};

const beginConfirmation = () => {
  if (!canStartConfirmation.value) return;
  executionState.value = 'confirming';
  restoreMessage.value = '';
};

const cancelConfirmation = () => {
  if (executionState.value === 'confirming') executionState.value = 'idle';
};

const describeRestoreError = (error) => {
  switch (error?.apiCode) {
    case 'RESTORE_DESTINATION_NOT_EMPTY':
      return '伺服器確認目前帳戶已不是空白狀態，因此拒絕還原；請重新檢查目前資料。';
    case 'IDEMPOTENCY_CONFLICT':
      return '安全識別碼與伺服器既有還原意圖衝突；本次已停止，請重新選取備份並再次預覽。';
    case 'RESTORE_SCHEMA_UNAVAILABLE':
      return '正式環境的還原儲存結構尚未就緒；本次沒有寫入資料。';
    case 'INVALID_RESTORE_REQUEST':
    case 'RESTORE_TOO_LARGE':
      return error?.message || '備份未通過伺服器還原驗證，本次沒有寫入資料。';
    case 'UNAUTHORIZED':
      return '登入狀態無法通過伺服器驗證；重新登入後可使用同一份備份再次確認。';
    default:
      return error?.message || '還原要求未完成。';
  }
};

const retireIntent = (intent) => {
  if (!intent) return;
  try {
    completeJournalRestoreIntent(localStorage, owner(), intent.idempotencyKey);
  } catch (error) {
    console.warn('Unable to clear terminal restore intent:', error);
  }
};

const refreshPreviewFromAuthority = async () => {
  if (!selectedBackup.value) return null;
  const next = await createJournalRestorePreview({
    backup: selectedBackup.value,
    ...apiAuthOptions(),
  });
  preview.value = next;
  return next;
};

const finishVerifiedRestore = async (intent, verification) => {
  preview.value = verification.preview;
  retireIntent(intent);
  executionState.value = 'success';
  restoreMessage.value = `已從伺服器逐筆確認 ${verification.preview.backup_counts.records} 筆交易與 ${verification.preview.backup_counts.cash_events} 筆現金事件。`;
  recalculationMessage.value = '';

  try {
    await portfolioStore.fetchRecords();
  } catch (error) {
    console.error('Restore verified but visible records refresh failed:', error);
    recalculationMessage.value = '資料已還原並通過權威讀回，但目前畫面重新載入失敗；重新整理頁面即可再次讀取。';
  }
  portfolioStore.markSnapshotStale();

  try {
    await portfolioStore.triggerUpdate();
    recalculationMessage.value = '已使用正常計算流程重新建立持倉與績效快照。';
  } catch (error) {
    console.error('Restore verified but normal recalculation trigger failed:', error);
    recalculationMessage.value = '資料已還原並通過權威讀回；自動重算暫時未啟動，可使用上方「立即更新」安全重試。';
  }
  addToast('交易資料已安全還原並完成伺服器讀回確認', 'success');
};

const verifyCommittedRestore = async (intent) => {
  executionState.value = 'verifying';
  try {
    const verification = await verifyJournalRestoreReadback({
      backup: selectedBackup.value,
      ...apiAuthOptions(),
    });
    if (!verification.verified) {
      preview.value = verification.preview;
      executionState.value = 'verification_pending';
      restoreMessage.value = verification.preview.status === 'empty_ready'
        ? '伺服器回應已接受還原，但重新讀回仍是空白；保留原安全識別碼，請再次確認。'
        : '重新讀回的資料與備份不完全一致；系統不會猜測或繼續寫入，請先確認目前資料。';
      return false;
    }
    await finishVerifiedRestore(intent, verification);
    return true;
  } catch (error) {
    console.error('Journal restore authoritative verification failed:', error);
    executionState.value = 'verification_pending';
    restoreMessage.value = '伺服器已接受還原，但目前無法完成權威讀回。原安全識別碼已保留，可稍後重新確認。';
    return false;
  }
};

const performRestore = async ({ reconcileFirst = false } = {}) => {
  if (!selectedBackup.value || preview.value?.status !== 'empty_ready' || busy.value) return;

  if (!await checkCapability()) {
    executionState.value = 'idle';
    return;
  }

  let intent;
  try {
    intent = await beginJournalRestoreIntent(localStorage, owner(), selectedBackup.value);
  } catch (error) {
    console.error('Unable to establish durable restore intent:', error);
    executionState.value = 'error';
    restoreMessage.value = '無法建立安全重試識別碼，因此沒有送出還原要求。';
    return;
  }

  if (reconcileFirst) {
    try {
      const current = await refreshPreviewFromAuthority();
      if (current?.status === 'already_restored') {
        const verification = await verifyJournalRestoreReadback({
          backup: selectedBackup.value,
          ...apiAuthOptions(),
        });
        if (verification.verified) await finishVerifiedRestore(intent, verification);
        return;
      }
      if (current?.status !== 'empty_ready') {
        retireIntent(intent);
        executionState.value = 'error';
        restoreMessage.value = '目前帳戶已有與備份不同的資料，已停止重試且不會再送出寫入要求。';
        return;
      }
    } catch (error) {
      console.error('Restore reconciliation read failed:', error);
      executionState.value = 'ambiguous';
      restoreMessage.value = '目前無法先確認伺服器資料，因此未送出新的還原要求；可稍後使用原識別碼再次確認。';
      return;
    }
  }

  executionState.value = 'restoring';
  restoreMessage.value = '';
  try {
    await executeJournalRestore({
      backup: selectedBackup.value,
      idempotencyKey: intent.idempotencyKey,
      ...apiAuthOptions(),
    });
    await verifyCommittedRestore(intent);
  } catch (error) {
    console.error('Journal restore execution failed:', error);
    restoreMessage.value = describeRestoreError(error);

    if (error?.outcomeAmbiguous === true) {
      executionState.value = 'ambiguous';
      return;
    }

    if (['IDEMPOTENCY_CONFLICT', 'INVALID_RESTORE_REQUEST', 'RESTORE_TOO_LARGE'].includes(error?.apiCode)) {
      retireIntent(intent);
    }

    if (error?.apiCode === 'RESTORE_DESTINATION_NOT_EMPTY') {
      try {
        const current = await refreshPreviewFromAuthority();
        if (current?.status === 'already_restored') {
          const verification = await verifyJournalRestoreReadback({
            backup: selectedBackup.value,
            ...apiAuthOptions(),
          });
          if (verification.verified) {
            await finishVerifiedRestore(intent, verification);
            return;
          }
        }
      } catch (refreshError) {
        console.warn('Unable to refresh restore preview after destination conflict:', refreshError);
      }
      retireIntent(intent);
    }

    if (['RESTORE_SCHEMA_UNAVAILABLE', 'METHOD_NOT_ALLOWED'].includes(error?.apiCode) || error?.status === 404) {
      capability.value = {
        status: 'unavailable',
        detail: { reason: 'route_unavailable', status: error?.status || null, api_code: error?.apiCode || null },
      };
    }
    executionState.value = 'error';
  }
};

const confirmRestore = async () => {
  if (executionState.value !== 'confirming') return;
  await performRestore();
};

const retryAmbiguousRestore = async () => {
  if (!['ambiguous', 'verification_pending'].includes(executionState.value)) return;
  await performRestore({ reconcileFirst: true });
};

const closePreview = () => {
  if (busy.value) return;
  preview.value = null;
  previewError.value = '';
  selectedBackup.value = null;
  resetExecutionState();
};
</script>

<style scoped>
.journal-restore-action {
  display: inline-flex;
  flex: 0 0 auto;
}

.restore-file-input {
  display: none;
}

.restore-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 36px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card, #fff);
  color: var(--text-main, inherit);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
}

.restore-button:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.restore-button:disabled,
.restore-close:disabled,
.restore-done:disabled {
  cursor: wait;
  opacity: 0.6;
}

.restore-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.55);
}

.restore-dialog {
  width: min(680px, 100%);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-card);
  color: var(--text-main);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
}

.restore-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.restore-dialog-header h3 {
  margin: 0 0 6px;
}

.restore-dialog-header p,
.restore-confirmation p {
  margin: 0;
  color: var(--text-sub);
  font-size: var(--type-label);
  line-height: 1.5;
}

.restore-close {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-sub);
  cursor: pointer;
}

.restore-count-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 20px 20px 0;
}

.restore-count-card {
  display: grid;
  gap: 5px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
}

.restore-count-card span {
  color: var(--text-sub);
  font-size: var(--type-caption);
}

.restore-count-card strong {
  font-size: var(--type-emphasis);
}

.restore-result {
  display: grid;
  gap: 7px;
  margin: 20px;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  line-height: 1.55;
}

.restore-result + .restore-result {
  margin-top: -10px;
}

.restore-result span {
  color: var(--text-sub);
  font-size: var(--type-label);
}

.restore-result.success,
.restore-result.ready {
  border-color: rgba(16, 185, 129, 0.45);
  background: rgba(16, 185, 129, 0.07);
}

.restore-result.blocked,
.restore-result.warning {
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.08);
}

.restore-result.error {
  border-color: rgba(239, 68, 68, 0.45);
  background: rgba(239, 68, 68, 0.07);
}

.restore-result.neutral {
  background: var(--bg-secondary);
}

.restore-capability {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -8px 20px 20px;
  color: var(--text-sub);
  font-size: var(--type-label);
}

.restore-capability-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
}

.restore-inline-action {
  justify-self: start;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-main);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.restore-inline-action.primary {
  border-color: var(--primary);
  color: var(--primary);
}

.restore-execution-actions,
.restore-confirmation {
  margin: 20px;
}

.restore-execution-actions {
  display: flex;
  justify-content: flex-end;
}

.restore-confirmation {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(239, 68, 68, 0.45);
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.06);
}

.restore-confirmation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.restore-execute,
.restore-cancel {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.restore-execute {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: white;
}

.restore-execute.danger {
  border-color: var(--danger);
  background: var(--danger);
}

.restore-cancel {
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-main);
}

.restore-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.restore-safety-boundary {
  color: var(--text-sub);
  font-size: var(--type-label);
  font-weight: 700;
}

.restore-done {
  min-height: 38px;
  padding: 0 16px;
  border: 1px solid var(--primary);
  border-radius: 8px;
  background: var(--primary);
  color: white;
  cursor: pointer;
  font-weight: 700;
}

@media (max-width: 640px) {
  .restore-dialog-backdrop {
    align-items: flex-end;
    padding: 10px;
  }

  .restore-dialog {
    max-height: calc(100vh - 20px);
  }

  .restore-count-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .restore-confirmation-actions {
    flex-direction: column-reverse;
  }
}
</style>
