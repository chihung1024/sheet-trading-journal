<template>
  <div class="csv-tools-action">
    <button
      type="button"
      class="tools-button"
      title="Canonical CSV 範本與其他券商欄位對應工具"
      aria-label="開啟通用交易 CSV 工具"
      @click="toolsOpen = true"
    >
      <span aria-hidden="true">⚙</span>
      <span>CSV 工具</span>
    </button>

    <Teleport to="body">
      <div v-if="toolsOpen" class="tools-overlay" @click.self="toolsOpen = false">
        <section
          class="tools-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="csv-tools-title"
        >
          <header class="tools-header">
            <div>
              <p>Broker-Neutral Tools</p>
              <h3 id="csv-tools-title">通用交易 CSV 工具</h3>
            </div>
            <button type="button" class="close-button" aria-label="關閉 CSV 工具" @click="toolsOpen = false">×</button>
          </header>

          <div class="tools-body">
            <button type="button" class="tool-card" @click="downloadTemplate">
              <strong>下載 Canonical CSV 空白範本</strong>
              <span>取得與目前 Canonical Trade CSV v1 parser 完全相同的欄位標題。</span>
            </button>

            <div class="tool-card mapping-card">
              <div>
                <strong>其他券商 CSV 欄位對應</strong>
                <span>明確指定來源欄位後建立零寫入 Canonical 預覽；不猜財務語意。</span>
              </div>
              <BrokerNeutralColumnMapping />
            </div>
          </div>

          <footer class="tools-footer">
            <span>工具本身不建立交易；實際 Canonical 匯入仍由「通用 CSV」的 reviewed execution flow 負責。</span>
            <button type="button" class="done-button" @click="toolsOpen = false">完成</button>
          </footer>
        </section>
      </div>
    </Teleport>
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
.csv-tools-action { display: inline-flex; }
.tools-button,
.done-button,
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
.tools-button:hover { border-color: var(--primary); color: var(--primary); }
.tools-overlay {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(15 23 42 / 55%);
}
.tools-dialog {
  width: min(620px, 94vw);
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-card, #fff);
  color: var(--text-main, inherit);
  box-shadow: 0 22px 60px rgb(15 23 42 / 22%);
}
.tools-header,
.tools-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
}
.tools-header { border-bottom: 1px solid var(--border-color); }
.tools-footer { border-top: 1px solid var(--border-color); color: var(--text-muted); }
.tools-header h3,
.tools-header p { margin: 0; }
.tools-header p { color: var(--text-muted); font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.close-button {
  min-width: 36px;
  min-height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.close-button:hover { background: var(--bg-secondary); }
.tools-body { display: grid; gap: 10px; padding: 14px 16px; }
.tool-card {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 12px 13px;
  background: var(--bg-card, #fff);
  color: inherit;
  text-align: left;
}
.tool-card:hover { border-color: var(--primary); }
.tool-card span { color: var(--text-muted); line-height: 1.45; }
.mapping-card { cursor: default; }
.mapping-card:hover { border-color: var(--border-color); }
.mapping-card > div { display: grid; gap: 4px; }
.done-button {
  min-height: 36px;
  padding: 0.5rem 0.85rem;
  border-color: var(--primary);
  background: var(--primary);
  color: #fff;
  font-weight: 600;
}

@media (max-width: 640px) {
  .tools-overlay { padding: 0; align-items: end; }
  .tools-dialog { width: 100%; border-radius: 14px 14px 0 0; }
  .tools-footer { align-items: stretch; flex-direction: column; }
  .done-button { width: 100%; }
}
</style>
