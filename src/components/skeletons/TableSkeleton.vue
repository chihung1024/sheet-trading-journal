<template>
  <div class="skeleton-wrapper">
    <div class="card table-view desktop-only">
      <div class="s-header">
        <div class="skeleton-shimmer s-title"></div>
        <div class="s-controls">
            <div class="skeleton-shimmer s-search"></div>
            <div class="skeleton-shimmer s-filter"></div>
        </div>
      </div>
      
      <div class="s-table">
        <div class="s-thead">
          <div v-for="i in 6" :key="`th-${i}`" class="skeleton-shimmer s-th"></div>
        </div>
        <div class="s-tbody">
          <div v-for="r in 5" :key="`row-${r}`" class="s-tr">
            <div class="s-td">
                <div class="skeleton-shimmer s-badge"></div>
            </div>
            <div v-for="c in 5" :key="`col-${c}`" class="s-td">
                <div class="skeleton-shimmer s-text"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mobile-view mobile-only">
      <div class="s-header-mobile">
         <div class="skeleton-shimmer s-m-title"></div>
         <div class="skeleton-shimmer s-m-btn"></div>
      </div>

      <div class="s-cards">
        <div v-for="i in 4" :key="`card-${i}`" class="s-card">
           <div class="s-card-top">
             <div class="left-group">
                <div class="skeleton-shimmer s-symbol"></div>
                <div class="skeleton-shimmer s-tag"></div>
             </div>
             <div class="skeleton-shimmer s-date"></div>
           </div>
           
           <div class="s-card-divider"></div>
           
           <div class="s-card-body">
             <div class="s-data-row">
                <div class="skeleton-shimmer s-label"></div>
                <div class="skeleton-shimmer s-value"></div>
             </div>
             <div class="s-data-row">
                <div class="skeleton-shimmer s-label"></div>
                <div class="skeleton-shimmer s-value-long"></div>
             </div>
           </div>
           
           <div class="s-card-footer">
              <div class="skeleton-shimmer s-btn"></div>
              <div class="skeleton-shimmer s-btn"></div>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-wrapper {
    width: 100%;
}

/* 共用卡片樣式 */
.card, .s-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    overflow: hidden;
}

/* Shimmer Animation */
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

/* --- Desktop Styles --- */
.table-view {
    padding: 24px;
    min-height: 400px;
}

.s-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.s-title { width: 150px; height: 24px; }
.s-controls { display: flex; gap: 12px; }
.s-search { width: 200px; height: 36px; border-radius: 8px; }
.s-filter { width: 120px; height: 36px; border-radius: 8px; }

.s-thead {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
    padding: 0 16px;
}

.s-th { height: 16px; border-radius: 4px; opacity: 0.7; }

.s-tr {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr 1fr;
    gap: 16px;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
    align-items: center;
}

.s-badge { width: 60px; height: 24px; border-radius: 6px; }
.s-text { width: 80%; height: 16px; }

/* --- Mobile Styles --- */
.mobile-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.s-header-mobile {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.s-m-title { width: 120px; height: 20px; }
.s-m-btn { width: 80px; height: 32px; border-radius: 6px; }

.s-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.s-card {
    padding: 16px;
}

.s-card-top {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
}

.left-group { display: flex; gap: 8px; align-items: center; }
.s-symbol { width: 50px; height: 20px; }
.s-tag { width: 40px; height: 18px; }
.s-date { width: 80px; height: 16px; }

.s-card-divider {
    height: 1px;
    background: var(--border-color);
    margin: 8px 0 12px 0;
    opacity: 0.5;
}

.s-card-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
}

.s-data-row {
    display: flex;
    justify-content: space-between;
}

.s-label { width: 60px; height: 14px; opacity: 0.6; }
.s-value { width: 80px; height: 16px; }
.s-value-long { width: 120px; height: 18px; }

.s-card-footer {
    display: flex;
    gap: 12px;
}

.s-btn {
    flex: 1;
    height: 36px;
    border-radius: 8px;
}

/* Utilities */
.desktop-only { display: block; }
.mobile-only { display: none; }

@media (max-width: 768px) {
    .desktop-only { display: none; }
    .mobile-only { display: flex; }
}
</style>
