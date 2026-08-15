<template>
  <section
    id="daily-pnl-explanation"
    class="daily-pnl-explanation"
    aria-labelledby="daily-pnl-explanation-title"
  >
    <div class="explanation-header">
      <div>
        <p class="eyebrow">當日損益來源</p>
        <h3 id="daily-pnl-explanation-title">{{ groupLabel }}</h3>
        <p class="explanation-period">{{ periodLabel }}</p>
      </div>
      <div class="published-total" :class="pnlClass(explanation.publishedTotalTwd)">
        {{ signedTwd(explanation.publishedTotalTwd) }}
      </div>
    </div>

    <div v-if="explanation.componentTotals.length" class="component-summary" aria-label="損益來源總結">
      <div
        v-for="component in explanation.componentTotals"
        :key="component.key"
        class="component-chip"
      >
        <span>{{ component.label }}</span>
        <strong :class="pnlClass(component.valueTwd)">{{ signedTwd(component.valueTwd) }}</strong>
      </div>
    </div>

    <div class="explanation-copy">
      以下數字直接來自計算引擎已對帳的逐檔 day ledger，不在瀏覽器重新計算投資組合損益。畫面四捨五入至 TWD 整數；對帳仍使用原始未四捨五入數值。
    </div>

    <div class="contributor-list">
      <article
        v-for="row in visibleRows"
        :key="row.symbol"
        class="contributor-row"
      >
        <div class="contributor-main">
          <div class="symbol-block">
            <strong>{{ row.symbol }}</strong>
            <span v-if="row.currency" class="currency-badge">{{ row.currency }}</span>
          </div>
          <strong class="contributor-total" :class="pnlClass(row.totalPnlTwd)">
            {{ signedTwd(row.totalPnlTwd) }}
          </strong>
        </div>

        <div v-if="row.components.length" class="contributor-components">
          <span
            v-for="component in row.components"
            :key="component.key"
            class="component-detail"
          >
            {{ component.label }}
            <strong :class="pnlClass(component.valueTwd)">{{ signedTwd(component.valueTwd) }}</strong>
          </span>
        </div>
        <div v-else class="no-component-change">無顯著分項變動</div>
      </article>
    </div>

    <button
      v-if="hasHiddenRows"
      type="button"
      class="show-more-btn"
      @click="showAll = !showAll"
    >
      {{ showAll ? '收起其餘標的' : `顯示全部 ${explanation.rows.length} 檔` }}
    </button>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  explanation: {
    type: Object,
    required: true,
  },
  groupName: {
    type: String,
    default: 'all',
  },
  prevDate: {
    type: String,
    default: '',
  },
  asOfDate: {
    type: String,
    default: '',
  },
});

const DEFAULT_VISIBLE_ROWS = 8;
const showAll = ref(false);

watch(
  () => props.groupName,
  () => {
    showAll.value = false;
  },
);

const groupLabel = computed(() => (
  props.groupName === 'all' ? '全部投資組合' : `群組：${props.groupName}`
));

const periodLabel = computed(() => {
  if (props.prevDate && props.asOfDate) return `${props.prevDate} → ${props.asOfDate}`;
  if (props.asOfDate) return `估值日 ${props.asOfDate}`;
  return '目前已發布快照';
});

const visibleRows = computed(() => (
  showAll.value
    ? props.explanation.rows
    : props.explanation.rows.slice(0, DEFAULT_VISIBLE_ROWS)
));

const hasHiddenRows = computed(() => props.explanation.rows.length > DEFAULT_VISIBLE_ROWS);

const signedTwd = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const rounded = Math.round(number).toLocaleString('zh-TW');
  return `${number >= 0 ? '+' : ''}${rounded} TWD`;
};

const pnlClass = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '';
  return number > 0 ? 'text-green' : 'text-red';
};
</script>

<style scoped>
.daily-pnl-explanation {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.explanation-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--text-sub);
  font-size: var(--type-caption);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.explanation-header h3 {
  margin: 0;
  color: var(--text-main);
  font-size: var(--type-section);
}

.explanation-period {
  margin: 4px 0 0;
  color: var(--text-sub);
  font-size: var(--type-label);
}

.published-total {
  flex: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: var(--type-emphasis);
  font-weight: 700;
  white-space: nowrap;
}

.component-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 10px;
}

.component-chip {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 5px 8px;
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-sub);
  font-size: var(--type-label);
}

.component-chip strong,
.component-detail strong {
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
}

.explanation-copy {
  margin-bottom: 10px;
  color: var(--text-sub);
  font-size: var(--type-label);
  line-height: 1.45;
}

.contributor-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  align-items: start;
  gap: 8px;
}

.contributor-row {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
}

.contributor-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.symbol-block {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--text-main);
}

.symbol-block strong {
  overflow-wrap: anywhere;
}

.currency-badge {
  flex: none;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  font-size: var(--type-caption);
  font-weight: 600;
}

.contributor-total {
  flex: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: var(--type-metric-sm);
  white-space: nowrap;
}

.contributor-components {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 5px 12px;
  margin-top: 7px;
  color: var(--text-sub);
  font-size: var(--type-caption);
}

.component-detail {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.no-component-change {
  margin-top: 7px;
  color: var(--text-sub);
  font-size: var(--type-caption);
}

.show-more-btn {
  width: 100%;
  margin-top: 9px;
  padding: 7px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-main);
  cursor: pointer;
  font: inherit;
  font-size: var(--type-control);
}

.show-more-btn:hover {
  background: var(--bg-secondary);
}

.text-green { color: var(--success); }
.text-red { color: var(--danger); }

@media (max-width: 768px) {
  .daily-pnl-explanation {
    margin-top: 12px;
    padding: 12px;
  }

  .explanation-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
  }

  .published-total {
    font-size: var(--type-emphasis);
  }

  .component-summary {
    gap: 6px;
  }

  .component-chip {
    padding: 5px 7px;
  }

  .contributor-list {
    grid-template-columns: 1fr;
  }

  .contributor-row {
    padding: 9px 10px;
  }

  .contributor-main {
    align-items: flex-start;
  }

  .contributor-components {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 5px 10px;
  }
}

@media (max-width: 420px) {
  .contributor-main {
    gap: 8px;
  }

  .contributor-total {
    font-size: var(--type-emphasis);
  }

  .contributor-components {
    grid-template-columns: 1fr;
  }
}
</style>
