<template>
  <div class="skeleton-container">
    <div class="skeleton-toolbar">
        <div class="s-block search-bar"></div>
        <div class="s-block filter-btn"></div>
    </div>

    <div class="desktop-skeleton">
        <div class="s-header">
            <div class="s-th" style="width: 15%"></div>
            <div class="s-th" style="width: 10%"></div>
            <div class="s-th" style="width: 15%"></div>
            <div class="s-th" style="width: 20%"></div>
            <div class="s-th" style="width: 20%"></div>
            <div class="s-th" style="width: 20%"></div>
        </div>
        <div class="s-body">
            <div v-for="i in 8" :key="i" class="s-row">
                <div class="s-cell"><div class="s-line w-sm"></div></div>
                <div class="s-cell"><div class="s-line w-xs"></div></div>
                <div class="s-cell"><div class="s-line w-md"></div></div>
                <div class="s-cell"><div class="s-line w-md"></div></div>
                <div class="s-cell"><div class="s-line w-lg"></div></div>
                <div class="s-cell"><div class="s-line w-sm"></div></div>
            </div>
        </div>
    </div>

    <div class="mobile-skeleton">
        <div v-for="i in 5" :key="i" class="s-card">
            <div class="s-card-top">
                <div class="s-line w-md"></div>
                <div class="s-line w-sm"></div>
            </div>
            <div class="s-card-mid">
                <div class="s-block square"></div>
                <div class="s-col">
                    <div class="s-line w-lg"></div>
                    <div class="s-line w-md"></div>
                </div>
            </div>
            <div class="s-card-bot">
                <div class="s-line w-full"></div>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
/* 共用動畫：流光效果 (Shimmer) */
.s-block, .s-line, .s-th, .s-card {
    background: #e2e8f0;
    background: linear-gradient(
        90deg,
        var(--skeleton-bg) 25%,
        var(--skeleton-highlight) 37%,
        var(--skeleton-bg) 63%
    );
    background-size: 400% 100%;
    animation: shimmer 1.5s ease infinite;
    border-radius: 6px;
}

@keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

/* 變數定義 (適配深色模式) */
.skeleton-container {
    --skeleton-bg: #f1f5f9;
    --skeleton-highlight: #e2e8f0;
    width: 100%;
    padding: 20px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    box-sizing: border-box;
}

:global(.dark) .skeleton-container {
    --skeleton-bg: #1e293b;
    --skeleton-highlight: #334155;
}

/* Toolbar Area */
.skeleton-toolbar {
    display: flex;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 16px;
}

.search-bar { width: 220px; height: 40px; }
.filter-btn { width: 100px; height: 40px; }

/* Desktop Table Styles */
.desktop-skeleton { display: block; }
.s-header {
    display: flex;
    padding-bottom: 16px;
    border-bottom: 2px solid var(--border-color);
    margin-bottom: 16px;
    gap: 16px;
}
.s-th { height: 20px; border-radius: 4px; }

.s-row {
    display: flex;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid var(--border-color);
    gap: 16px;
}
.s-cell { flex: 1; }

.s-line { height: 16px; border-radius: 4px; }
.w-xs { width: 30%; }
.w-sm { width: 50%; }
.w-md { width: 70%; }
.w-lg { width: 90%; }
.w-full { width: 100%; }

/* Mobile Card Styles */
.mobile-skeleton { display: none; }
.s-card {
    padding: 16px;
    margin-bottom: 16px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: transparent; /* 卡片本身透明，內部元素發光 */
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.s-card-top { display: flex; justify-content: space-between; }
.s-card-mid { display: flex; gap: 12px; align-items: center; }
.square { width: 40px; height: 40px; border-radius: 8px; }
.s-col { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.s-card-bot { margin-top: 4px; }

/* RWD 切換 */
@media (max-width: 768px) {
    .skeleton-container { padding: 16px; border: none; background: transparent; }
    .skeleton-toolbar { display: none; } /* 手機版通常 Toolbar 在外部或不同結構，簡化顯示 */
    .desktop-skeleton { display: none; }
    .mobile-skeleton { display: block; }
    
    .s-card {
        background: var(--bg-card); /* 手機版骨架卡片給背景 */
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
}
</style>
