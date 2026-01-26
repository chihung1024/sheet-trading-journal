<template>
  <div class="skeleton-grid">
    <div 
      v-for="(i, index) in 6" 
      :key="i" 
      class="s-card" 
      :class="{ 'span-two-mobile': index === 0 }"
    >
      <div class="s-top">
        <div class="s-block s-label"></div>
        <div class="s-block s-icon"></div>
      </div>

      <div class="s-main">
        <div class="s-block s-value" :class="{ 's-value-lg': index === 0 }"></div>
        <div class="s-block s-unit" v-if="index === 0"></div>
      </div>

      <div class="s-footer">
        <div class="s-block s-sub"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Grid 佈局 - 必須與 StatsGrid.vue 完全一致 */
.skeleton-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    width: 100%;
}

/* 卡片容器樣式 */
.s-card {
    background: var(--bg-card);
    padding: 20px;
    border-radius: 16px; /* 對應 var(--radius) */
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 120px;
    box-sizing: border-box;
}

/* 內部元素佈局 */
.s-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.s-main {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 12px;
    flex-grow: 1;
}

.s-footer {
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
}

/* 骨架元素尺寸 */
.s-block {
    border-radius: 6px;
    /* 流光動畫基底 */
    background: #e2e8f0;
    background: linear-gradient(
        90deg,
        var(--skeleton-bg) 25%,
        var(--skeleton-highlight) 37%,
        var(--skeleton-bg) 63%
    );
    background-size: 400% 100%;
    animation: shimmer 1.5s ease infinite;
}

.s-label { width: 80px; height: 14px; }
.s-icon { width: 38px; height: 38px; border-radius: 10px; }

.s-value { width: 60%; height: 28px; border-radius: 4px; }
.s-value-lg { width: 70%; height: 36px; } /* 總資產數字較大 */
.s-unit { width: 30px; height: 14px; }

.s-sub { width: 40%; height: 12px; }

/* 動畫定義 */
@keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

/* 顏色變數適配 */
:root {
    --skeleton-bg: #f1f5f9;
    --skeleton-highlight: #e2e8f0;
}

:global(.dark) .s-card {
    background: var(--bg-card);
    border-color: var(--border-color);
}

:global(.dark) .s-block {
    --skeleton-bg: #1e293b;
    --skeleton-highlight: #334155;
}

/* RWD: Tablet (< 1024px) */
@media (max-width: 1024px) {
    .skeleton-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    }
}

/* RWD: Mobile (< 768px) */
@media (max-width: 768px) {
    .skeleton-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    .s-card {
        padding: 14px;
        min-height: 100px;
    }

    /* 關鍵：總資產卡片橫跨兩欄，防止 CLS */
    .span-two-mobile {
        grid-column: span 2;
    }

    /* 手機版尺寸微調 */
    .s-icon { width: 30px; height: 30px; border-radius: 8px; }
    .s-value { height: 24px; }
    .s-value-lg { height: 30px; }
    .s-label { width: 60px; }
}
</style>
