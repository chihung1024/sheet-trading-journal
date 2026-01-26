<template>
  <div class="chart-skeleton">
    <div class="skeleton-header">
      <div class="skeleton-title"></div>
      <div class="skeleton-controls">
        <div class="skeleton-pill"></div>
        <div class="skeleton-pill"></div>
        <div class="skeleton-pill"></div>
      </div>
    </div>

    <div class="skeleton-canvas">
      <div class="y-axis">
        <div class="tick"></div>
        <div class="tick"></div>
        <div class="tick"></div>
        <div class="tick"></div>
      </div>

      <div class="graph-area">
        <div class="grid-line" style="top: 25%"></div>
        <div class="grid-line" style="top: 50%"></div>
        <div class="grid-line" style="top: 75%"></div>

        <svg viewBox="0 0 100 40" preserveAspectRatio="none" class="mock-curve">
          <path 
            d="M0,35 C10,35 20,10 30,20 S50,30 60,15 S80,5 100,25" 
            vector-effect="non-scaling-stroke"
          />
          <defs>
            <linearGradient id="skeleton-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="currentColor" stop-opacity="0.2" />
              <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path 
            d="M0,35 C10,35 20,10 30,20 S50,30 60,15 S80,5 100,25 V40 H0 Z" 
            fill="url(#skeleton-gradient)"
            stroke="none"
          />
        </svg>
      </div>
    </div>
    
    <div class="x-axis">
      <div class="tick-label"></div>
      <div class="tick-label"></div>
      <div class="tick-label"></div>
      <div class="tick-label"></div>
      <div class="tick-label"></div>
    </div>
  </div>
</template>

<style scoped>
.chart-skeleton {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

/* Shimmer Overlay */
.chart-skeleton::after {
  content: "";
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  transform: translateX(-100%);
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0,
    rgba(255, 255, 255, 0.4) 20%,
    rgba(255, 255, 255, 0.7) 60%,
    rgba(255, 255, 255, 0)
  );
  animation: shimmer 2s infinite;
  pointer-events: none;
  z-index: 2;
}

:global(.dark-mode) .chart-skeleton::after {
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

/* Header */
.skeleton-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
}

.skeleton-title {
  width: 120px;
  height: 24px;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.skeleton-controls {
  display: flex;
  gap: 8px;
}

.skeleton-pill {
  width: 60px;
  height: 24px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

/* Canvas Area */
.skeleton-canvas {
  flex: 1;
  display: flex;
  gap: 12px;
  position: relative;
}

.y-axis {
  width: 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px 0;
}

.y-axis .tick {
  width: 100%;
  height: 10px;
  background: var(--bg-secondary);
  border-radius: 2px;
}

.graph-area {
  flex: 1;
  border-left: 2px solid var(--border-color);
  border-bottom: 2px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

.grid-line {
  position: absolute;
  left: 0; right: 0;
  height: 1px;
  background: var(--border-color);
  opacity: 0.5;
}

/* Mock Curve */
.mock-curve {
  width: 100%;
  height: 100%;
  color: var(--text-sub); /* Used for fill/stroke */
  opacity: 0.3;
}

.mock-curve path[fill="none"] {
  stroke: currentColor;
  stroke-width: 2;
}

/* X-Axis */
.x-axis {
  display: flex;
  justify-content: space-between;
  padding-left: 52px; /* Offset for y-axis */
  margin-top: 8px;
}

.tick-label {
  width: 40px;
  height: 10px;
  background: var(--bg-secondary);
  border-radius: 2px;
}
</style>
