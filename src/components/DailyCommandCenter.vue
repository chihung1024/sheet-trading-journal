<template>
  <section class="daily-command" aria-labelledby="daily-command-title">
    <div class="command-header">
      <div>
        <span class="command-eyebrow">Daily Command Center</span>
        <h2 id="daily-command-title">每日決策快照</h2>
        <p>先看今天最需要掌握的事，再進入各功能頁查看完整明細。</p>
      </div>
      <span class="scope-chip">{{ groupLabel }}</span>
    </div>

    <div class="command-grid">
      <article class="command-card">
        <div class="card-heading">
          <span class="card-label">當日損益驅動</span>
          <strong v-if="snapshot.daily.status === 'ready'" :class="pnlClass(snapshot.daily.publishedTotalTwd)">
            {{ signedTwd(snapshot.daily.publishedTotalTwd) }}
          </strong>
          <strong v-else>暫不可用</strong>
        </div>
        <template v-if="snapshot.daily.status === 'ready'">
          <div class="driver-row">
            <span>主要貢獻</span>
            <strong v-if="snapshot.daily.contributor" class="text-green">
              {{ snapshot.daily.contributor.symbol }} · {{ signedTwd(snapshot.daily.contributor.totalPnlTwd) }}
            </strong>
            <span v-else class="muted">無正貢獻標的</span>
          </div>
          <div class="driver-row">
            <span>主要拖累</span>
            <strong v-if="snapshot.daily.detractor" class="text-red">
              {{ snapshot.daily.detractor.symbol }} · {{ signedTwd(snapshot.daily.detractor.totalPnlTwd) }}
            </strong>
            <span v-else class="muted">無負貢獻標的</span>
          </div>
          <p class="card-note">來源為既有已對帳 day ledger；完整拆解可由下方「當日損益」展開。</p>
        </template>
        <p v-else class="empty-copy">當日來源目前未通過既有對帳條件，因此不推測貢獻標的。</p>
      </article>

      <article class="command-card">
        <div class="card-heading">
          <span class="card-label">持倉集中</span>
          <strong v-if="snapshot.concentration.status === 'ready'">
            Top 3 {{ formatPercent(snapshot.concentration.top3Weight) }}
          </strong>
          <strong v-else>暫不可用</strong>
        </div>
        <template v-if="snapshot.concentration.status === 'ready'">
          <div class="primary-fact">
            <span>最大持倉</span>
            <strong>{{ snapshot.concentration.largest.symbol }} · {{ formatPercent(snapshot.concentration.largest.weight) }}</strong>
          </div>
          <p class="card-note">{{ snapshot.concentration.positionCount }} 檔正市值持倉；比例不含現金。</p>
        </template>
        <p v-else class="empty-copy">持倉市值與摘要總值未通過既有對帳時，不顯示集中度。</p>
        <button type="button" class="detail-link" @click="emit('navigate', 'holdings')">查看持倉明細</button>
      </article>

      <article class="command-card">
        <div class="card-heading">
          <span class="card-label">待核對配息</span>
          <strong>{{ snapshot.dividends.count }} 筆</strong>
        </div>
        <template v-if="snapshot.dividends.next">
          <div class="primary-fact">
            <span>最近候選</span>
            <strong>{{ snapshot.dividends.next.symbol }} · {{ snapshot.dividends.next.ex_date }}</strong>
          </div>
          <p class="card-note">目前群組的 pending 候選中，尚未由實際 DIV record 確認入帳。</p>
        </template>
        <p v-else class="empty-copy">目前群組沒有尚未反映為 DIV record 的配息候選。</p>
        <button type="button" class="detail-link" @click="emit('navigate', 'dividends')">前往配息紀錄</button>
      </article>

      <article class="command-card">
        <div class="card-heading">
          <span class="card-label">最近交易</span>
          <strong v-if="snapshot.recentRecord">{{ typeLabel(snapshot.recentRecord.txnType) }}</strong>
          <strong v-else>無紀錄</strong>
        </div>
        <template v-if="snapshot.recentRecord">
          <div class="primary-fact">
            <span>{{ snapshot.recentRecord.txnDate }}</span>
            <strong>{{ snapshot.recentRecord.symbol }}</strong>
          </div>
          <p class="card-note">依既有 recent-first 交易紀錄與目前策略群組範圍選取。</p>
        </template>
        <p v-else class="empty-copy">目前群組沒有交易紀錄。</p>
        <button type="button" class="detail-link" @click="emit('navigate', 'records')">查看交易紀錄</button>
      </article>
    </div>

    <p class="authority-note">
      此快照只整合既有已發布／已對帳事實；不在瀏覽器重算投資組合損益、不建立風險分數，也不產生買賣建議。
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import {
  buildDailyPnlExplanation,
  selectCurrentGroupDayLedger,
} from '../services/dailyPnlExplainability.js';
import { buildPortfolioConcentrationSnapshot } from '../services/portfolioConcentration.js';
import { buildDailyCommandSnapshot } from '../services/dailyCommandCenter.js';

const emit = defineEmits(['navigate']);
const store = usePortfolioStore();

const groupLabel = computed(() => (
  store.currentGroup === 'all' ? '全部投資組合' : `策略：${store.currentGroup}`
));

const dailyExplanation = computed(() => buildDailyPnlExplanation({
  dayLedger: selectCurrentGroupDayLedger({
    rawData: store.rawData,
    currentGroup: store.currentGroup,
  }),
  summary: store.stats,
}));

const concentration = computed(() => buildPortfolioConcentrationSnapshot(
  store.holdings,
  store.stats.total_value,
));

const snapshot = computed(() => buildDailyCommandSnapshot({
  dailyExplanation: dailyExplanation.value,
  concentration: concentration.value,
  pendingDividends: store.pending_dividends,
  records: store.records,
  currentGroup: store.currentGroup,
}));

const signedTwd = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number >= 0 ? '+' : ''}${Math.round(number).toLocaleString('zh-TW')} TWD`;
};

const formatPercent = value => {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}%` : '—';
};

const pnlClass = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '';
  return number > 0 ? 'text-green' : 'text-red';
};

const typeLabel = type => ({
  BUY: '買入',
  SELL: '賣出',
  DIV: '配息',
}[String(type || '').toUpperCase()] || String(type || '交易'));
</script>

<style scoped>
.daily-command {
  padding: 18px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}
.command-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
.command-eyebrow { display: block; margin-bottom: 3px; color: var(--text-sub); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.command-header h2 { margin: 0; font-size: 1.08rem; }
.command-header p { margin: 4px 0 0; color: var(--text-sub); font-size: 0.8rem; }
.scope-chip { flex: none; padding: 4px 9px; border: 1px solid var(--border-color); border-radius: 999px; background: var(--bg-secondary); color: var(--text-sub); font-size: 0.72rem; font-weight: 650; }
.command-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.command-card { min-width: 0; padding: 13px 14px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-secondary); }
.card-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.card-heading strong { font-family: 'JetBrains Mono', monospace; font-size: 0.88rem; text-align: right; }
.card-label { color: var(--text-sub); font-size: 0.76rem; font-weight: 700; }
.driver-row, .primary-fact { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-top: 6px; font-size: 0.8rem; }
.driver-row > span:first-child, .primary-fact > span { color: var(--text-sub); }
.driver-row strong, .primary-fact strong { text-align: right; overflow-wrap: anywhere; }
.card-note, .empty-copy { margin: 9px 0 0; color: var(--text-sub); font-size: 0.72rem; line-height: 1.45; }
.detail-link { margin-top: 10px; padding: 0; border: 0; background: transparent; color: var(--primary); cursor: pointer; font: inherit; font-size: 0.76rem; font-weight: 700; }
.detail-link:hover { text-decoration: underline; }
.detail-link:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 3px; }
.authority-note { margin: 12px 0 0; padding-top: 10px; border-top: 1px solid var(--border-color); color: var(--text-sub); font-size: 0.72rem; line-height: 1.45; }
.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.muted { color: var(--text-sub); }
@media (max-width: 768px) {
  .daily-command { padding: 14px; }
  .command-header { flex-direction: column; gap: 8px; }
  .command-grid { grid-template-columns: 1fr; }
}
</style>
