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
      :disabled="checking"
      :aria-busy="checking"
      aria-label="檢查交易紀錄與現金事件備份是否可安全還原"
      title="上傳備份並先做安全還原預覽；目前不會寫入資料"
      @click="chooseFile"
    >
      <span aria-hidden="true">{{ checking ? '⏳' : '↥' }}</span>
      <span>{{ checking ? '檢查中…' : '還原備份' }}</span>
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
            <h3 id="restore-preview-title">安全還原預覽</h3>
            <p>此階段只驗證備份與目前帳戶狀態，不會新增、修改或刪除任何資料。</p>
          </div>
          <button type="button" class="restore-close" aria-label="關閉還原預覽" @click="closePreview">✕</button>
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
            <span>交易與現金事件以可還原欄位逐筆計數比對後完全相同，不需要寫入。</span>
          </div>

          <div v-else-if="preview.status === 'empty_ready'" class="restore-result ready">
            <strong>空白帳戶，可進入安全還原</strong>
            <span>
              預計可建立 {{ preview.planned_creates.records }} 筆交易與
              {{ preview.planned_creates.cash_events }} 筆現金事件。這個版本仍然是零寫入預覽。
            </span>
          </div>

          <div v-else class="restore-result blocked">
            <strong>已阻擋自動還原</strong>
            <span>
              目前帳戶已有資料且與備份不完全一致。系統不會用欄位相似度猜測哪些是重複資料，
              也不會覆寫或刪除既有紀錄。
            </span>
          </div>
        </template>

        <div class="restore-dialog-footer">
          <span class="restore-zero-write">零寫入預覽</span>
          <button type="button" class="restore-done" @click="closePreview">完成</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';
import {
  createJournalRestorePreview,
  parseJournalRestoreBackupText,
} from '../services/journalRestorePreview.js';

const authStore = useAuthStore();
const fileInput = ref(null);
const checking = ref(false);
const preview = ref(null);
const previewError = ref('');

const chooseFile = () => {
  if (checking.value) return;
  preview.value = null;
  previewError.value = '';
  fileInput.value?.click();
};

const resetInput = () => {
  if (fileInput.value) fileInput.value.value = '';
};

const handleFileChange = async (event) => {
  const file = event?.target?.files?.[0];
  if (!file || checking.value) {
    resetInput();
    return;
  }

  checking.value = true;
  preview.value = null;
  previewError.value = '';
  try {
    const backup = parseJournalRestoreBackupText(await file.text());
    preview.value = await createJournalRestorePreview({
      backup,
      apiBaseUrl: CONFIG.API_BASE_URL,
      getToken: () => authStore.token,
      refreshToken: () => authStore.refreshToken(),
    });
  } catch (error) {
    console.error('Journal restore preview failed:', error);
    previewError.value = error?.message || '無法確認備份內容';
  } finally {
    checking.value = false;
    resetInput();
  }
};

const closePreview = () => {
  preview.value = null;
  previewError.value = '';
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

.restore-button:disabled {
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
  width: min(640px, 100%);
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

.restore-dialog-header p {
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
.restore-result.error {
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.08);
}

.restore-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.restore-zero-write {
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
}
</style>
