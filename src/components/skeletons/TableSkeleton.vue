<template>
  <div class="table-skeleton">
    <div class="skeleton-header mobile-hide">
      <div class="skeleton-cell" style="width: 15%"></div>
      <div class="skeleton-cell" style="width: 10%"></div>
      <div class="skeleton-cell" style="width: 10%"></div>
      <div class="skeleton-cell" style="width: 15%"></div>
      <div class="skeleton-cell" style="width: 20%"></div>
      <div class="skeleton-cell" style="width: 15%"></div>
      <div class="skeleton-cell" style="width: 15%"></div>
    </div>

    <div class="skeleton-body">
      <div v-for="i in 8" :key="i" class="skeleton-row">
        <div class="skeleton-content">
          <div class="skeleton-line main"></div>
          <div class="skeleton-line sub mobile-only"></div>
        </div>
        
        <div class="skeleton-content mobile-hide">
          <div class="skeleton-line short"></div>
        </div>
        
        <div class="skeleton-content mobile-hide">
          <div class="skeleton-line short"></div>
        </div>
        
        <div class="skeleton-content right-align">
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line sub mobile-only"></div>
        </div>
        
        <div class="skeleton-content right-align mobile-hide">
          <div class="skeleton-line long"></div>
        </div>
        
        <div class="skeleton-content right-align">
          <div class="skeleton-badge"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-skeleton {
  width: 100%;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

/* Header */
.skeleton-header {
  display: flex;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  gap: 16px;
}

.skeleton-cell {
  height: 14px;
  background-color: rgba(0,0,0,0.05);
  border-radius: 4px;
}

/* Body */
.skeleton-body {
  display: flex;
  flex-direction: column;
}

.skeleton-row {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
  position: relative;
  overflow: hidden;
}

.skeleton-row:last-child {
  border-bottom: none;
}

/* Shimmer Effect */
.skeleton-row::after {
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
}

/* Dark Mode Shimmer */
:global(.dark-mode) .skeleton-row::after {
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

/* Content Blocks */
.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-content.right-align {
  align-items: flex-end;
}

.skeleton-line {
  background-color: var(--bg-secondary);
  border-radius: 4px;
}

.skeleton-line.main { height: 16px; width: 80%; }
.skeleton-line.sub { height: 12px; width: 50%; opacity: 0.7; }
.skeleton-line.long { height: 16px; width: 90%; }
.skeleton-line.medium { height: 16px; width: 60%; }
.skeleton-line.short { height: 16px; width: 40%; }

.skeleton-badge {
  width: 60px;
  height: 24px;
  border-radius: 12px;
  background-color: var(--bg-secondary);
}

/* Responsive Logic */
.mobile-only { display: none; }

@media (max-width: 768px) {
  .mobile-hide { display: none !important; }
  .mobile-only { display: block; }
  
  .skeleton-header { display: none; }
  
  .skeleton-row {
    padding: 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  /* Simulate Card Layout */
  .skeleton-content {
    align-items: flex-start;
  }
  
  .skeleton-content.right-align {
    align-items: flex-end;
  }
  
  /* Make rows look like separated cards on mobile if needed, 
     but here we keep list style for consistency */
}
</style>
