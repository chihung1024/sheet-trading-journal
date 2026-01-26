<template>
  <div class="stats-grid-skeleton">
    <div v-for="i in 6" :key="i" class="stat-card-skeleton">
      <div class="skeleton-top">
        <div class="skeleton-shimmer skeleton-label"></div>
        <div class="skeleton-shimmer skeleton-icon"></div>
      </div>
      
      <div class="skeleton-main">
        <div class="skeleton-shimmer skeleton-value"></div>
        <div v-if="i % 2 === 0" class="skeleton-shimmer skeleton-sub-value"></div>
      </div>
      
      <div class="skeleton-footer">
        <div class="skeleton-shimmer skeleton-footer-text"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 網格佈局 - 必須與 StatsGrid.vue 完全一致 */
.stats-grid-skeleton {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    width: 100%;
}

.stat-card-skeleton {
    background: var(--bg-card);
    padding: 20px;
    border-radius: var(--radius); /* 16px */
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 140px; /* 與真實卡片高度一致 */
    position: relative;
    overflow: hidden;
}

.skeleton-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.skeleton-main {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    margin-bottom: 16px;
}

.skeleton-footer {
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
}

/* 骨架屏動畫與樣式 */
.skeleton-shimmer {
    background: linear-gradient(
        90deg,
        var(--bg-secondary) 0%,
        var(--border-color) 50%,
        var(--bg-secondary) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite linear;
    border-radius: 6px;
}

@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

/* 各部位尺寸模擬 */
.skeleton-label {
    width: 30%;
    height: 14px;
}

.skeleton-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
}

.skeleton-value {
    width: 70%;
    height: 32px; /* 模擬大字體 */
}

.skeleton-sub-value {
    width: 40%;
    height: 16px;
}

.skeleton-footer-text {
    width: 50%;
    height: 12px;
}

/* 響應式設定 - 與 StatsGrid.vue 同步 */
@media (max-width: 1200px) { 
    .stats-grid-skeleton { 
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
    } 
}

@media (max-width: 640px) { 
    .stats-grid-skeleton { 
        grid-template-columns: 1fr;
        gap: 16px;
    }
    
    .stat-card-skeleton {
        min-height: 120px;
        padding: 16px;
    }
    
    .skeleton-value {
        height: 28px;
    }
}
</style>
