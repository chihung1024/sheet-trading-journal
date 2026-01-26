<template>
  <div class="chart-skeleton">
    <div class="skeleton-header">
      <div class="header-left">
        <div class="skeleton-shimmer skeleton-title"></div>
        <div class="skeleton-shimmer skeleton-badge"></div>
      </div>
      
      <div class="skeleton-shimmer skeleton-selector"></div>
    </div>

    <div class="skeleton-canvas">
      <div class="skeleton-bars">
        <div 
            v-for="i in 12" 
            :key="i" 
            class="skeleton-bar" 
            :style="{ height: getRandomHeight(i) }"
        ></div>
      </div>
      
      <div class="skeleton-axis-x">
        <div class="skeleton-shimmer skeleton-tick" v-for="n in 6" :key="n"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 產生隨機高度，讓骨架屏看起來不那麼死板
const getRandomHeight = (index) => {
  // 使用偽隨機讓視覺上比較有起伏，像真實股價
  const base = 40;
  const variance = (Math.sin(index) + 1) * 25; 
  return `${base + variance}%`;
};
</script>

<style scoped>
.chart-skeleton {
    padding: 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    min-height: 400px;
    overflow: hidden;
}

/* Header */
.skeleton-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.skeleton-title {
    width: 140px;
    height: 24px;
}

.skeleton-badge {
    width: 80px;
    height: 24px;
    border-radius: 6px;
}

.skeleton-selector {
    width: 240px;
    height: 32px;
    border-radius: 8px;
}

/* Canvas Area */
.skeleton-canvas {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    position: relative;
    padding: 0 10px;
}

.skeleton-bars {
    width: 100%;
    height: 80%;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 16px;
    opacity: 0.6;
}

.skeleton-bar {
    flex: 1;
    background: linear-gradient(to top, var(--border-color), var(--bg-secondary));
    border-radius: 4px 4px 0 0;
    animation: bar-pulse 2s infinite ease-in-out;
}

@keyframes bar-pulse {
    0%, 100% { opacity: 0.5; transform: scaleY(0.95); }
    50% { opacity: 1; transform: scaleY(1); }
}

.skeleton-axis-x {
    display: flex;
    justify-content: space-between;
    border-top: 1px dashed var(--border-color);
    padding-top: 12px;
}

.skeleton-tick {
    width: 30px;
    height: 10px;
}

/* Shimmer 動畫基底 */
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

/* 響應式 */
@media (max-width: 768px) {
    .chart-skeleton {
        padding: 16px;
        min-height: 300px;
    }
    
    .skeleton-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
    }
    
    .header-left {
        width: 100%;
        justify-content: space-between;
    }
    
    .skeleton-selector {
        width: 100%;
        height: 36px; /* 手機版按鈕較大 */
    }
    
    .skeleton-badge {
        display: none; /* 手機版空間不足時隱藏次要元素 */
    }
    
    .skeleton-bars {
        gap: 4px;
    }
}
</style>
