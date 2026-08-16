<template>
  <section class="headline-skeleton" aria-hidden="true">
    <div class="heading-row">
      <div class="s-block s-title"></div>
      <div class="s-block s-copy"></div>
    </div>
    <div class="primary-grid">
      <div v-for="i in 3" :key="i" class="primary-item">
        <div class="s-block s-label"></div>
        <div class="s-block s-value"></div>
        <div class="s-block s-helper"></div>
      </div>
    </div>
    <div class="secondary-grid">
      <div v-for="i in 3" :key="i" class="secondary-item">
        <div class="s-block s-label"></div>
        <div class="s-block s-secondary"></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.headline-skeleton {
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.primary-grid,
.secondary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.primary-item,
.secondary-item {
  padding: 14px;
  border-radius: 10px;
  background: var(--bg-secondary);
}

.secondary-grid { margin-top: 12px; }

.s-block {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--skeleton-bg) 25%,
    var(--skeleton-highlight) 37%,
    var(--skeleton-bg) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.5s ease infinite;
}

.s-title { width: 150px; height: 20px; }
.s-copy { width: min(38%, 320px); height: 14px; }
.s-label { width: 72px; height: 12px; margin-bottom: 9px; }
.s-value { width: 70%; height: 30px; margin-bottom: 8px; }
.s-helper { width: 78%; height: 11px; }
.s-secondary { width: 62%; height: 18px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (max-width: 768px) {
  .headline-skeleton { padding: 14px; }
  .heading-row { align-items: flex-start; flex-direction: column; gap: 8px; }
  .s-copy { width: 70%; }
  .primary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .primary-item:first-child { grid-column: 1 / -1; }
  .secondary-grid { grid-template-columns: 1fr; gap: 8px; }
}
</style>
