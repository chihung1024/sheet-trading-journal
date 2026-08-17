<template>
  <button
    type="button"
    class="journal-backup-btn"
    :disabled="exporting"
    :title="exporting ? '正在建立備份' : '下載交易與現金資料備份'"
    :aria-label="exporting ? '正在建立備份' : '下載資料備份'"
    @click="handleBackup"
  >
    <span aria-hidden="true">{{ exporting ? '⏳' : '⬇️' }}</span>
    <span class="desktop-only">{{ exporting ? '備份中' : '下載備份' }}</span>
  </button>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';
import { createJournalBackup, downloadJournalBackup } from '../services/journalBackupExport.js';

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
.journal-backup-btn {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-main);
  font-size: var(--type-label);
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.journal-backup-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.journal-backup-btn:disabled {
  cursor: wait;
  opacity: 0.65;
}

@media (max-width: 768px) {
  .journal-backup-btn {
    width: 38px;
    padding: 0;
  }
}
</style>
