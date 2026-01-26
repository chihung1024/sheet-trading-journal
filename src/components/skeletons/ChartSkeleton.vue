<template>
  <div class="skeleton-chart-container">
    <div class="s-header">
      <div class="s-title-group">
        <div class="s-block s-title"></div>
      </div>
      <div class="s-block s-toggle-pills"></div>
    </div>
    
    <div class="s-controls">
        <div class="s-block s-time-pills"></div>
        <div class="s-block s-date-range desktop-only"></div>
    </div>

    <div class="s-canvas-box">
       <div class="s-block s-canvas"></div>
    </div>
    
    <div class="s-footer">
        <div class="s-block s-info"></div>
    </div>
  </div>
</template>

<style scoped>
/* 容器樣式 - 模擬 PerformanceChart 的 padding */
.skeleton-chart-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px;
    box-sizing: border-box;
    background: var(--bg-card);
    border-radius: 16px;
    border: 1px solid var(--border-color);
    min-height: 450px; /* 桌面版預設高度 */
}

/* 佈局結構 */
.s-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.s-controls {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 16px;
}

.s-canvas-box {
    flex-grow: 1;
    width: 100%;
    margin-bottom: 12px;
    display: flex;
}

.s-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--border-color);
}

/* 骨架塊元素 */
.s-block {
    background: #e2e8f0;
    background: linear-gradient(
        90deg,
        var(--skeleton-bg) 25%,
        var(--skeleton-highlight) 37%,
        var(--skeleton-bg) 63%
    );
    background-size: 400% 100%;
    animation: shimmer 1.5s ease infinite;
    border-radius: 8px;
}

.s-title { width: 120px; height: 24px; border-left: 4px solid var(--skeleton-highlight); }
.s-toggle-pills { width: 180px; height: 32px; border-radius: 6px; }
.s-time-pills { width: 240px; height: 32px; border-radius: 6px; }
.s-date-range { width: 200px; height: 32px; }
.s-canvas { width: 100%; height: 100%; border-radius: 12px; opacity: 0.8; }
.s-info { width: 150px; height: 14px; }

/* 動畫定義 */
@keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

/* 變數定義 (適配深色模式) */
.skeleton-chart-container {
    --skeleton-bg: #f1f5f9;
    --skeleton-highlight: #e2e8f0;
}

:global(.dark) .skeleton-chart-container {
    --skeleton-bg: #1e293b;
    --skeleton-highlight: #334155;
    background: var(--bg-card);
    border-color: var(--border-color);
}

/* 手機版 RWD */
@media (max-width: 768px) {
    .skeleton-chart-container {
        padding: 16px;
        min-height: 350px; /* 手機版高度縮減 */
        border: none; /* 手機版通常邊距較小，移除邊框增加空間感 */
        background: transparent;
    }
    
    .s-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
    
    .s-controls {
        flex-direction: column;
        gap: 12px;
    }
    
    .s-toggle-pills { width: 100%; max-width: 200px; }
    .s-time-pills { width: 100%; }
    
    .desktop-only { display: none; }
}
</style>
