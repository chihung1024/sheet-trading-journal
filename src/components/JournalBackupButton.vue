<template>
  <div class="journal-data-actions" aria-label="交易資料匯入、範本、備份與還原">
    <BrokerNeutralImportPreview />
    <BrokerNeutralCsvTemplateButton />
    <button
      type="button"
      class="backup-button"
      :disabled="exporting"
      :aria-busy="exporting"
      aria-label="下載交易紀錄與現金事件備份"
      title="下載伺服器已確認的交易紀錄與現金事件備份"
      @click="handleBackup"
    >
      <span aria-hidden="true">{{ exporting ? '⏳' : '⤓' }}</span>
      <span>{{ exporting ? '備份中…' : '下載備份' }}</span>
    </button>
    <JournalRestoreButton />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';
import { createJournalBackup, downloadJournalBackup } from '../services/journalBackupExport.js';
import BrokerNeutralImportPreview from './BrokerNeutralImportPreview.vue';
import BrokerNeutralCsvTemplateButton from './BrokerNeutralCsvTemplateButton.vue';
import JournalRestoreButton from './JournalRestoreButton.vue';

const authStore = useAuthStore();
const { addToast } = useToast();
const exporting = ref(false);

const handleBackup = async () => {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const backup = await createJournalBackup({
      apiBaseUrl: CONFIG.API_BASE_URL,
      getToken: () => authStore.token,
      refreshToken: () => authStore.refreshToken(),
    });
    const filename = downloadJournalBackup(backup);
    addToast(
      `備份完成：${backup.counts.records} 筆交易、${backup.counts.cash_events} 筆現金事件（${filename}）`,
      'success',
    );
  } catch (error) {
    console.error('Journal backup failed:', error);
    addToast(`備份失敗：${error?.message || '無法確認完整資料'}`, 'error');
  } finally {
    exporting.value = false;
  }
};
</script>

<style scoped>
.journal-data-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.backup-button {
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

.backup-button:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.backup-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

@media (max-width: 480px) {
  .journal-data-actions {
    flex-wrap: wrap;
  }
}
</style>
