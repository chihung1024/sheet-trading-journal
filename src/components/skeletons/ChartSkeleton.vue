<template>
  <div class="chart-skeleton">
    <div class="skeleton-header">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton-pills">
        <div class="skeleton skeleton-pill"></div>
        <div class="skeleton skeleton-pill"></div>
        <div class="skeleton skeleton-pill"></div>
      </div>
    </div>
    <div class="skeleton-canvas">
      <div class="skeleton-bars">
        <div v-for="i in 12" :key="i" class="skeleton-bar" :style="{ height: getRandomHeight() }"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
const getRandomHeight = () => {
  const heights = ['40%', '60%', '80%', '50%', '70%', '90%', '65%', '45%'];
  return heights[Math.floor(Math.random() * heights.length)];
};
</script>

<style scoped>
.chart-skeleton {
    padding: 20px;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.skeleton-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.skeleton-title {
    width: 120px;
    height: 20px;
    border-radius: 8px;
}

.skeleton-pills {
    display: flex;
    gap: 8px;
}

.skeleton-pill {
    width: 60px;
    height: 32px;
    border-radius: 8px;
}

.skeleton-canvas {
    flex-grow: 1;
    display: flex;
    align-items: flex-end;
    padding: 20px;
    background: var(--bg-secondary);
    border-radius: 12px;
}

.skeleton-bars {
    width: 100%;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    height: 100%;
}

.skeleton-bar {
    flex: 1;
    background: var(--border-color);
    border-radius: 4px 4px 0 0;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton {
    background: linear-gradient(
        90deg,
        var(--bg-secondary) 25%,
        var(--border-color) 50%,
        var(--bg-secondary) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
}

@keyframes skeleton-loading {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}

@keyframes skeleton-pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

@media (max-width: 768px) {
    .chart-skeleton {
        padding: 16px;
    }
    
    .skeleton-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
}
</style>
