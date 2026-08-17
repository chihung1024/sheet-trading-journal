<template>
  <section
    v-if="model.status !== 'hidden'"
    class="account-value-preview"
    aria-labelledby="account-value-preview-title"
  >
    <div>
      <div class="preview-title-row">
        <span id="account-value-preview-title" class="preview-label">帳戶價值預覽</span>
        <span class="preview-badge">PREVIEW</span>
      </div>

      <template v-if="model.status === 'ready'">
        <strong class="preview-value font-num">{{ formatTwd(model.accountValueTwd) }}</strong>
        <span class="preview-helper">
          持倉 {{ formatTwd(model.securitiesValueTwd) }} ＋ 已確認現金 {{ formatTwd(model.cashValueTwd) }}
        </span>
      </template>

      <template v-else>
        <strong class="preview-value unavailable">暫不可用</strong>
        <span class="preview-helper">{{ model.message }}</span>
        <span v-if="model.missingFxCurrencies?.length" class="preview-detail">
          缺少匯率：{{ model.missingFxCurrencies.join('、') }}
        </span>
      </template>
    </div>

    <p class="preview-boundary">
      <template v-if="dailyAccountPnlReady">
        帳戶現值與今日損益已納入權威現金；持倉市值、TWR、XIRR 與績效曲線仍維持既有口徑。
      </template>
      <template v-else>
        帳戶現值可納入權威現金；今日損益只有在現金歷史與匯率可完整對帳時才切換帳戶口徑，否則維持持倉口徑。TWR、XIRR 與績效曲線不變。
      </template>
    </p>
  </section>
</template>

<script setup>
defineProps({
  model: { type: Object, required: true },
  dailyAccountPnlReady: { type: Boolean, default: false },
});

const formatTwd = value => (
  typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value).toLocaleString('zh-TW')} TWD`
    : '—'
);
</script>

<style scoped>
.account-value-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 18px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
}

.preview-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.preview-label {
  color: var(--text-sub);
  font-size: var(--type-label);
  font-weight: 700;
}

.preview-badge {
  padding: 2px 6px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-sub);
  font-size: var(--type-caption);
  font-weight: 800;
  letter-spacing: 0.05em;
}

.preview-value {
  display: block;
  color: var(--text-main);
  font-size: var(--type-metric);
  line-height: var(--type-line-tight);
}

.preview-value.unavailable {
  color: var(--text-sub);
  font-size: var(--type-emphasis);
}

.preview-helper,
.preview-detail {
  display: block;
  margin-top: 5px;
  color: var(--text-sub);
  font-size: var(--type-caption);
}

.preview-boundary {
  max-width: 500px;
  margin: 0;
  color: var(--text-sub);
  font-size: var(--type-caption);
  line-height: 1.55;
  text-align: right;
}

@media (max-width: 768px) {
  .account-value-preview {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }

  .preview-boundary {
    max-width: none;
    text-align: left;
  }
}
</style>
