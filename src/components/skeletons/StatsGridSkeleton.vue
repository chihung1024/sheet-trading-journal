<template>
  <div class="stats-grid-skeleton">
    <div class="stat-block-skeleton hero-skeleton">
      <div class="skeleton-top">
        <div class="skeleton-label"></div>
        <div class="skeleton-icon"></div>
      </div>
      <div class="skeleton-main">
        <div class="skeleton-value lg"></div>
        <div class="skeleton-tag"></div>
      </div>
      <div class="skeleton-footer">
        <div class="skeleton-row">
          <div class="skeleton-text sm"></div>
          <div class="skeleton-text sm"></div>
        </div>
        <div class="skeleton-progress"></div>
      </div>
    </div>

    <div v-for="i in 5" :key="i" class="stat-block-skeleton">
      <div class="skeleton-top">
        <div class="skeleton-label"></div>
        <div class="skeleton-icon"></div>
      </div>
      <div class="skeleton-main">
        <div class="skeleton-value"></div>
      </div>
      <div class="skeleton-footer">
        <div class="skeleton-badge"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Grid Layout - Must match StatsGrid.vue */
.stats-grid-skeleton {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

/* Card Base */
.stat-block-skeleton {
  background: var(--bg-card);
  padding: 20px 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 140px;
  position: relative;
  overflow: hidden;
}

/* Shimmer Animation Effect */
.stat-block-skeleton::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0,
    rgba(255, 255, 255, 0.4) 20%,
    rgba(255, 255, 255, 0.7) 60%,
    rgba(255, 255, 255, 0)
  );
  animation: shimmer 2s infinite;
}

/* Dark Mode Shimmer */
:global(.dark-mode) .stat-block-skeleton::after {
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0,
    rgba(255, 255, 255, 0.05) 20%,
    rgba(255, 255, 255, 0.1) 60%,
    rgba(255, 255, 255, 0)
  );
}

@keyframes shimmer {
  100% { transform: translateX(100%); }
}

/* Inner Elements Placeholders */
.skeleton-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.skeleton-label {
  width: 40%;
  height: 14px;
  background-color: var(--bg-secondary);
  border-radius: 4px;
}

.skeleton-icon {
  width: 40px;
  height: 40px;
  background-color: var(--bg-secondary);
  border-radius: 10px;
}

.skeleton-main {
  margin-bottom: 16px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.skeleton-value {
  width: 60%;
  height: 32px;
  background-color: var(--bg-secondary);
  border-radius: 6px;
}

.skeleton-value.lg {
  width: 70%;
  height: 40px;
}

.skeleton-tag {
  width: 30px;
  height: 14px;
  background-color: var(--bg-secondary);
  border-radius: 4px;
}

.skeleton-footer {
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-row {
  display: flex;
  justify-content: space-between;
}

.skeleton-text.sm {
  width: 30%;
  height: 10px;
  background-color: var(--bg-secondary);
  border-radius: 4px;
}

.skeleton-badge {
  width: 40%;
  height: 20px;
  background-color: var(--bg-secondary);
  border-radius: 12px;
}

.skeleton-progress {
  width: 100%;
  height: 4px;
  background-color: var(--bg-secondary);
  border-radius: 2px;
}

/* Responsive (Must match StatsGrid.vue) */
@media (max-width: 1280px) {
  .stats-grid-skeleton { grid-template-columns: repeat(2, 1fr); }
  .hero-skeleton { grid-column: span 2; }
}

@media (max-width: 768px) {
  .stats-grid-skeleton { grid-template-columns: 1fr; gap: 16px; }
  .hero-skeleton { grid-column: auto; }
  .stat-block-skeleton { min-height: auto; padding: 16px; }
}
</style>
