<template>
  <div class="stats-grid">
    <div v-for="i in 4" :key="i" class="stat-block skeleton-card">
      <div class="stat-top">
        <div class="skeleton skeleton-text skeleton-label"></div>
        <div class="skeleton skeleton-icon"></div>
      </div>
      <div class="stat-main">
        <div class="skeleton skeleton-text skeleton-value"></div>
      </div>
      <div class="stat-footer">
        <div class="skeleton skeleton-text skeleton-footer-text"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
}

.stat-block {
    background: var(--bg-card);
    padding: 24px;
    border-radius: var(--radius);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-card);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 150px;
}

.stat-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.stat-main {
    margin-bottom: 12px;
    flex-grow: 1;
}

.stat-footer {
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
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
    border-radius: 8px;
}

@keyframes skeleton-loading {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}

.skeleton-text {
    height: 16px;
}

.skeleton-label {
    width: 80px;
}

.skeleton-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
}

.skeleton-value {
    height: 32px;
    width: 140px;
}

.skeleton-footer-text {
    width: 100px;
    height: 14px;
}

/* 響應式 */
@media (max-width: 1400px) {
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 768px) {
    .stats-grid {
        grid-template-columns: 1fr;
        gap: 16px;
    }
    
    .stat-block {
        min-height: 130px;
        padding: 20px;
    }
}
</style>
