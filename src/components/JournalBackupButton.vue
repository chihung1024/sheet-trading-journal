<template>
  <section class="journal-backup-card" aria-labelledby="journal-backup-title">
    <div class="backup-copy">
      <strong id="journal-backup-title">資料備份</strong>
      <span>下載伺服器已確認的交易與現金事件；不包含登入憑證、本機快取或衍生投資組合快照。</span>
    </div>

    <button
      type="button"
      class="journal-backup-btn"
      :disabled="exporting"
      :aria-busy="exporting"
      @click="handleBackup"
    >
      <span aria-hidden="true">{{ exporting ? '⏳' : '⬇️' }}</span>
      <span>{{ exporting ? '建立備份中…' : '下載備份' }}</span>
    </button>
  </section>
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
.journal-backup-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.backup-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.backup-copy strong {
  color: var(--text-main);
  font-size: var(--type-emphasis);
}

.backup-copy span {
  color: var(--text-sub);
  font-size: var(--type-body);
  line-height: 1.45;
}

.journal-backup-btn {
  min-height: 40px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: white;
  font-size: var(--type-label);
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.journal-backup-btn:hover:not(:disabled) {
  background: var(--primary-dark);
}

.journal-backup-btn:disabled {
  cursor: wait;
  opacity: 0.65;
}

@media (max-width: 720px) {
  .journal-backup-card {
    align-items: stretch;
    flex-direction: column;
  }

  .journal-backup-btn {
    width: 100%;
  }
}
</style>
