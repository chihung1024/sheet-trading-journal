<template>
  <div class="csv-tools-action">
    <button
      type="button"
      class="tools-button"
      title="Canonical CSV 範本與其他券商欄位對應工具"
      aria-label="開啟通用交易 CSV 工具"
      aria-controls="csv-tools-popover"
      :aria-expanded="toolsOpen"
      @click="toolsOpen = !toolsOpen"
    >
      <span aria-hidden="true">⚙</span>
      <span>CSV 工具</span>
    </button>

    <div
      v-show="toolsOpen"
      id="csv-tools-popover"
      class="tools-popover"
      role="group"
      aria-label="通用交易 CSV 工具"
    >
      <button type="button" class="tool-card" @click="downloadTemplate">
        <strong>下載 Canonical CSV 空白範本</strong>
        <span>取得與目前 Canonical Trade CSV v1 parser 完全相同的欄位標題。</span>
      </button>

      <div class="tool-card mapping-card">
        <div>
          <strong>其他券商 CSV 欄位對應</strong>
          <span>明確指定來源欄位，先建立 Canonical 預覽；全部通過後才可明確確認匯入。</span>
        </div>
        <BrokerNeutralColumnMapping />
      </div>

      <p class="tools-note">
        欄位對應不猜財務語意；實際寫入與「通用 CSV」共用同一 durable record-create / readback / recalculation authority。
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { getCanonicalTradeCsvTemplateDescriptor } from '../services/brokerNeutralCsvTemplate.js';
import BrokerNeutralColumnMapping from './BrokerNeutralColumnMapping.vue';

const toolsOpen = ref(false);

const downloadTemplate = () => {
  const descriptor = getCanonicalTradeCsvTemplateDescriptor();
  const blob = new Blob([`\uFEFF${descriptor.text}`], { type: descriptor.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = descriptor.filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.csv-tools-action {
  position: relative;
  display: inline-flex;
}
.tools-button,
.tool-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font: inherit;
  cursor: pointer;
}
.tools-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 36px;
  padding: 0.5rem 0.75rem;
  background: var(--bg-card, #fff);
  color: var(--text-main, inherit);
  font-weight: 600;
  white-space: nowrap;
}
.tools-button:hover,
.tools-button[aria-expanded='true'] {
  border-color: var(--primary);
  color: var(--primary);
}
.tools-popover {
  position: absolute;
  z-index: 1150;
  top: calc(100% + 8px);
  right: 0;
  display: grid;
  gap: 9px;
  width: min(420px, calc(100vw - 28px));
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card, #fff);
  color: var(--text-main, inherit);
  box-shadow: 0 14px 36px rgb(15 23 42 / 18%);
}
.tool-card {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 11px 12px;
  background: var(--bg-card, #fff);
  color: inherit;
  text-align: left;
}
.tool-card:hover { border-color: var(--primary); }
.tool-card span,
.tools-note { color: var(--text-muted); line-height: 1.45; }
.mapping-card { cursor: default; }
.mapping-card:hover { border-color: var(--border-color); }
.mapping-card > div { display: grid; gap: 4px; }
.tools-note { margin: 0; padding: 2px 3px; }

@media (max-width: 640px) {
  .tools-popover {
    position: fixed;
    top: auto;
    right: 14px;
    bottom: 14px;
    left: 14px;
    width: auto;
  }
}
</style>
