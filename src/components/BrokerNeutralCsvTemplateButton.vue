<template>
  <button
    type="button"
    class="template-button"
    title="下載空白 Canonical Trade CSV v1 範本"
    aria-label="下載通用交易 CSV 空白範本"
    @click="downloadTemplate"
  >
    <span aria-hidden="true">⇩</span>
    <span>CSV 範本</span>
  </button>
</template>

<script setup>
import { getCanonicalTradeCsvTemplateDescriptor } from '../services/brokerNeutralCsvTemplate.js';

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
.template-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 36px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card, #fff);
  color: var(--text-main, inherit);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
}

.template-button:hover {
  border-color: var(--primary);
  color: var(--primary);
}
</style>
