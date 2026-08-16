<template>
  <section class="overview-headline" aria-labelledby="overview-headline-title">
    <div class="section-heading">
      <div>
        <span class="eyebrow">現在</span>
        <h2 id="overview-headline-title">投資組合概覽</h2>
      </div>
      <p>先看目前部位、今天與累計結果；細節留在下一層。</p>
    </div>

    <div class="primary-grid">
      <article class="primary-item market-value-item">
        <span class="metric-label">持倉市值</span>
        <strong class="metric-value font-num">{{ formatTwd(model.marketValue) }}</strong>
        <span class="metric-helper">目前證券持倉，不含未建模現金</span>
      </article>

      <article class="primary-item">
        <span class="metric-label">今日損益</span>
        <template v-if="model.daily.status === 'ready'">
          <strong class="metric-value font-num" :class="pnlClass(model.daily.pnlTwd)">
            {{ formatSignedTwd(model.daily.pnlTwd) }}
          </strong>
          <span class="metric-helper" :class="pnlClass(model.daily.pnlTwd)">
            {{ formatSignedPercent(model.daily.returnPercent) }}
          </span>
        </template>
        <template v-else>
          <strong class="metric-value unavailable">暫不可用</strong>
          <span class="metric-helper">等待已對帳的當日資料</span>
        </template>
      </article>

      <article class="primary-item">
        <span class="metric-label">累計損益</span>
        <strong class="metric-value font-num" :class="pnlClass(model.totalPnl)">
          {{ formatSignedTwd(model.totalPnl) }}
        </strong>
        <span class="metric-helper">目前已發布的整體損益</span>
      </article>
    </div>

    <div class="breakdown-row" aria-label="持倉與損益拆解">
      <div class="breakdown-item">
        <span>持倉成本</span>
        <strong class="font-num">{{ formatTwd(model.holdingCost) }}</strong>
      </div>
      <div class="breakdown-item">
        <span>未實現</span>
        <strong class="font-num" :class="pnlClass(model.unrealizedPnl)">{{ formatSignedTwd(model.unrealizedPnl) }}</strong>
        <small :class="pnlClass(model.unrealizedPnl)">未實現報酬率 {{ formatSignedPercent(model.unrealizedReturnPercent) }}</small>
      </div>
      <div class="breakdown-item">
        <span>已實現</span>
        <strong class="font-num" :class="pnlClass(model.realizedPnl)">{{ formatSignedTwd(model.realizedPnl) }}</strong>
      </div>
    </div>

    <div class="performance-row" aria-label="長期績效摘要">
      <div class="performance-item" :title="twrTitle">
        <span>時間加權報酬</span>
        <strong class="font-num">{{ model.twr.status === 'ready' ? formatSignedPercent(model.twr.value) : '—' }}</strong>
        <small>{{ twrHelper }}</small>
      </div>
      <div class="performance-item" :title="xirrTitle">
        <span>個人年化報酬</span>
        <strong class="font-num" :class="model.xirr.status === 'ready' ? pnlClass(model.xirr.value) : ''">
          {{ model.xirr.status === 'ready' ? formatSignedPercent(model.xirr.value) : '—' }}
        </strong>
        <small>{{ xirrHelper }}</small>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  model: { type: Object, required: true },
});

const formatTwd = value => {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number).toLocaleString('zh-TW')} TWD` : '—';
};

const formatSignedTwd = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number >= 0 ? '+' : ''}${Math.round(number).toLocaleString('zh-TW')} TWD`;
};

const formatSignedPercent = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
};

const pnlClass = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '';
  return number > 0 ? 'text-green' : 'text-red';
};

const twrHelper = computed(() => {
  if (props.model.twr.sourceStatus === 'not_applicable') return '目前尚不適用';
  if (props.model.twr.sourceStatus === 'undefined') return '目前無法可靠計算';
  return '策略表現';
});

const twrTitle = computed(() => {
  if (props.model.twr.sourceStatus == null) return '舊版快照：未提供 TWR 可靠性狀態';
  if (props.model.twr.sourceStatus === 'ok') return '所有已連結子期間皆通過 TWR 可計算性檢查';
  if (props.model.twr.sourceStatus === 'not_applicable') return '目前沒有可計算的 TWR 報酬期間';
  return `TWR 無法可靠計算${props.model.twr.invalidSince ? `；自 ${props.model.twr.invalidSince} 起` : ''}`;
});

const xirrHelper = computed(() => {
  if (props.model.xirr.sourceStatus === 'not_applicable') return '目前尚不適用';
  if (props.model.xirr.sourceStatus === 'undefined') return '目前無法計算';
  if (!props.model.xirr.conventional) return '非傳統現金流，可能多解';
  return '資金加權';
});

const xirrTitle = computed(() => {
  if (props.model.xirr.sourceStatus == null) return '舊版快照：未提供 XIRR 計算狀態';
  if (props.model.xirr.sourceStatus === 'ok') {
    const asOf = props.model.xirr.asOfDate ? `估值日 ${props.model.xirr.asOfDate}` : '';
    const ambiguity = !props.model.xirr.conventional ? '；現金流正負號多次切換，可能存在多個 IRR 解' : '';
    return `${asOf}${ambiguity}` || 'XIRR 可用';
  }
  if (props.model.xirr.sourceStatus === 'not_applicable') return '目前沒有足夠現金流可計算 XIRR';
  return 'XIRR 無法可靠計算';
});
</script>

<style scoped>
.overview-headline {
  padding: 20px;
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
  margin-bottom: 16px;
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

.primary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--border-color);
}

.primary-item {
  min-width: 0;
  padding: 16px;
  background: var(--bg-card);
}

.metric-label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-sub);
  font-size: var(--type-label);
  font-weight: 650;
}

.metric-value {
  display: block;
  overflow-wrap: anywhere;
  color: var(--text-main);
  font-size: var(--type-metric);
  line-height: var(--type-line-tight);
}

.metric-value.unavailable {
  color: var(--text-sub);
  font-size: var(--type-emphasis);
}

.metric-helper {
  display: block;
  margin-top: 6px;
  color: var(--text-sub);
  font-size: var(--type-caption);
}

.breakdown-row,
.performance-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.breakdown-item,
.performance-item {
  min-width: 0;
  padding: 11px 12px;
  border-radius: 10px;
  background: var(--bg-secondary);
}

.breakdown-item span,
.performance-item span {
  display: block;
  margin-bottom: 4px;
  color: var(--text-sub);
  font-size: var(--type-caption);
}

.breakdown-item strong,
.performance-item strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: var(--type-emphasis);
}

.breakdown-item small,
.performance-item small {
  display: block;
  margin-top: 3px;
  color: var(--text-sub);
  font-size: var(--type-caption);
}

.performance-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
}

.performance-item {
  background: transparent;
  padding: 0;
}

.text-green { color: var(--success); }
.text-red { color: var(--danger); }

@media (max-width: 768px) {
  .overview-headline { padding: 14px; }
  .section-heading { display: block; margin-bottom: 12px; }
  .section-heading p { margin-top: 4px; max-width: none; text-align: left; }
  .primary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .market-value-item { grid-column: 1 / -1; }
  .primary-item { padding: 13px; }
  .breakdown-row { gap: 8px; }
}

@media (max-width: 520px) {
  .breakdown-row { grid-template-columns: 1fr; }
  .breakdown-item { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .breakdown-item span { margin-bottom: 0; }
  .breakdown-item small { width: 100%; text-align: right; }
  .performance-row { gap: 10px; }
}
</style>
