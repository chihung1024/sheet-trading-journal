<template>
  <section class="overview-context" aria-labelledby="overview-context-title">
    <div class="section-heading">
      <div>
        <span class="eyebrow">今天</span>
        <h2 id="overview-context-title">今日脈絡</h2>
      </div>
      <p>只顯示原因與待處理事項，不重複首頁主數字。</p>
    </div>

    <div class="context-grid">
      <article class="context-card">
        <div class="card-heading">
          <span>損益驅動</span>
          <button
            v-if="dailyExplanationReady"
            type="button"
            class="detail-link"
            aria-controls="daily-pnl-explanation"
            :aria-expanded="explanationOpen"
            @click="emit('toggle-explanation')"
          >
            {{ explanationOpen ? '收起完整來源' : '查看完整來源' }}
          </button>
        </div>

        <template v-if="model.daily.status === 'ready'">
          <div class="fact-row">
            <span>主要貢獻</span>
            <strong v-if="model.daily.contributor" class="font-num text-green">
              {{ model.daily.contributor.symbol }} · {{ formatSignedTwd(model.daily.contributor.totalPnlTwd) }}
            </strong>
            <span v-else class="muted">無正貢獻標的</span>
          </div>
          <div class="fact-row">
            <span>主要拖累</span>
            <strong v-if="model.daily.detractor" class="font-num text-red">
              {{ model.daily.detractor.symbol }} · {{ formatSignedTwd(model.daily.detractor.totalPnlTwd) }}
            </strong>
            <span v-else class="muted">無負貢獻標的</span>
          </div>
        </template>
        <p v-else class="empty-copy">當日來源尚未通過既有對帳條件，因此不推測貢獻標的。</p>
      </article>

      <article class="context-card">
        <div class="card-heading">
          <span>持倉內集中度</span>
          <button type="button" class="detail-link" @click="emit('navigate', 'holdings')">查看持倉</button>
        </div>

        <template v-if="model.concentration.status === 'ready'">
          <div class="fact-row">
            <span>最大持倉</span>
            <strong>{{ model.concentration.largest.symbol }} · {{ formatPercent(model.concentration.largest.weight) }}</strong>
          </div>
          <div class="fact-row">
            <span>Top 3</span>
            <strong>{{ formatPercent(model.concentration.top3Weight) }}</strong>
          </div>
          <p class="card-note">{{ model.concentration.positionCount }} 檔正市值持倉；比例不含現金。</p>
        </template>
        <p v-else class="empty-copy">持倉市值未通過既有對帳時，不顯示集中度。</p>
      </article>
    </div>

    <div v-if="attention.dividends.count > 0" class="attention-row" role="status">
      <div>
        <span class="attention-label">待處理</span>
        <strong>{{ attention.dividends.count }} 筆配息等待核對</strong>
        <span v-if="attention.dividends.next" class="attention-detail">
          最近候選：{{ attention.dividends.next.symbol }} · {{ attention.dividends.next.ex_date }}
        </span>
      </div>
      <button type="button" class="attention-action" @click="emit('navigate', 'dividends')">前往處理</button>
    </div>
  </section>
</template>

<script setup>
defineProps({
  model: { type: Object, required: true },
  attention: { type: Object, required: true },
  explanationOpen: { type: Boolean, default: false },
  dailyExplanationReady: { type: Boolean, default: false },
});

const emit = defineEmits(['navigate', 'toggle-explanation']);

const finiteNumber = value => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const formatSignedTwd = value => {
  const number = finiteNumber(value);
  if (number === null) return '—';
  return `${number >= 0 ? '+' : ''}${Math.round(number).toLocaleString('zh-TW')} TWD`;
};

const formatPercent = value => {
  const number = finiteNumber(value);
  return number === null ? '—' : `${number.toFixed(2)}%`;
};
</script>

<style scoped>
.overview-context {
  padding: 18px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.eyebrow {
  display: block;
  margin-bottom: 3px;
  color: var(--text-sub);
  font-size: var(--type-caption);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.section-heading h2 {
  margin: 0;
  font-size: var(--type-section);
}

.section-heading p {
  max-width: 440px;
  margin: 2px 0 0;
  color: var(--text-sub);
  font-size: var(--type-label);
  text-align: right;
}

.context-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.context-card {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
}

.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: var(--text-main);
  font-size: var(--type-label);
  font-weight: 700;
}

.detail-link,
.attention-action {
  min-height: 34px;
  padding: 5px 9px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--type-control);
  font-weight: 700;
}

.detail-link:hover,
.attention-action:hover {
  border-color: var(--primary);
}

.detail-link:focus-visible,
.attention-action:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.fact-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--border-color);
  font-size: var(--type-body);
}

.fact-row:first-of-type { border-top: 0; }
.fact-row > span:first-child { color: var(--text-sub); }
.fact-row strong { min-width: 0; text-align: right; overflow-wrap: anywhere; }

.card-note,
.empty-copy {
  margin: 8px 0 0;
  color: var(--text-sub);
  font-size: var(--type-caption);
  line-height: var(--type-line-body);
}

.muted { color: var(--text-sub); }
.text-green { color: var(--success); }
.text-red { color: var(--danger); }

.attention-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--warning) 42%, var(--border-color));
  border-radius: 12px;
  background: color-mix(in srgb, var(--warning) 9%, var(--bg-card));
}

.attention-row > div {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 10px;
  min-width: 0;
}

.attention-label {
  color: var(--warning);
  font-size: var(--type-caption);
  font-weight: 800;
  letter-spacing: 0.04em;
}

.attention-row strong { font-size: var(--type-emphasis); }
.attention-detail { color: var(--text-sub); font-size: var(--type-caption); }

@media (max-width: 768px) {
  .overview-context { padding: 14px; }
  .section-heading { display: block; margin-bottom: 12px; }
  .section-heading p { margin-top: 4px; max-width: none; text-align: left; }
  .context-grid { grid-template-columns: 1fr; }
  .attention-row { align-items: stretch; flex-direction: column; gap: 10px; }
  .attention-action { width: 100%; }
}

@media (max-width: 480px) {
  .card-heading { align-items: flex-start; flex-direction: column; }
  .detail-link { width: 100%; }
}
</style>
