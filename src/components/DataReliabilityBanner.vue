<template>
  <section
    v-if="issues.length > 0"
    class="reliability-banner"
    :class="bannerSeverity"
    aria-live="polite"
  >
    <div class="reliability-copy">
      <div v-for="issue in issues" :key="issue.key" class="reliability-issue">
        <strong>{{ issue.title }}</strong>
        <span>{{ issue.message }}</span>
      </div>
    </div>

    <button
      v-if="hasRetryableIssue"
      type="button"
      class="retry-button"
      :disabled="retrying"
      @click="retryLoad"
    >
      {{ retrying ? '重新載入中…' : '重新載入' }}
    </button>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import {
  buildDataReliabilityIssues,
  getPortfolioAnomalies,
} from '../services/dataReliability.js';

const store = usePortfolioStore();
const { addToast } = useToast();
const retrying = ref(false);

const currentAnomalies = computed(() => getPortfolioAnomalies(
  store.rawData,
  store.currentGroup,
));

const issues = computed(() => buildDataReliabilityIssues({
  portfolioReadStatus: store.portfolioReadStatus,
  snapshotFreshness: store.snapshotFreshness,
  anomalies: currentAnomalies.value,
}));

const hasRetryableIssue = computed(() => issues.value.some(issue => issue.retryable === true));
const bannerSeverity = computed(() => (
  issues.value.some(issue => issue.severity === 'error') ? 'severity-error' : 'severity-warning'
));

const retryLoad = async () => {
  if (retrying.value) return;
  retrying.value = true;
  try {
    await store.fetchAll();
    addToast('資料已重新載入', 'success');
  } catch (error) {
    console.error('可靠性提示重新載入失敗:', error);
    addToast('重新載入失敗；目前資料仍不可視為最新', 'error');
  } finally {
    retrying.value = false;
  }
};
</script>

<style scoped>
.reliability-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  width: calc(100% - 48px);
  max-width: var(--layout-max);
  margin: 14px auto 0;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.severity-error {
  border-color: rgba(220, 38, 38, 0.45);
  background: rgba(254, 226, 226, 0.62);
}

.severity-warning {
  border-color: rgba(217, 119, 6, 0.42);
  background: rgba(254, 243, 199, 0.62);
}

.reliability-copy {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.reliability-issue {
  display: grid;
  gap: 3px;
  color: var(--text-main);
  line-height: 1.45;
}

.reliability-issue strong {
  font-size: 0.93rem;
}

.reliability-issue span {
  color: var(--text-sub);
  font-size: 0.86rem;
}

.retry-button {
  flex: 0 0 auto;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-main);
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
}

.retry-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 1024px) {
  .reliability-banner {
    width: calc(100% - 32px);
  }
}

@media (max-width: 720px) {
  .reliability-banner {
    flex-direction: column;
  }

  .retry-button {
    width: 100%;
  }
}
</style>
