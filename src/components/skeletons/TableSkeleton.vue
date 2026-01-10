<template>
  <div class="card table-skeleton">
    <div class="skeleton-header">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-info"></div>
    </div>
    
    <div class="skeleton-table">
      <div class="skeleton-thead">
        <div v-for="i in 7" :key="i" class="skeleton skeleton-th"></div>
      </div>
      <div class="skeleton-tbody">
        <div v-for="row in 5" :key="row" class="skeleton-row">
          <div v-for="col in 7" :key="col" class="skeleton skeleton-td"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 24px;
    box-shadow: var(--shadow-card);
}

.skeleton-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
}

.skeleton-title {
    width: 120px;
    height: 20px;
    border-radius: 8px;
}

.skeleton-info {
    width: 150px;
    height: 16px;
    border-radius: 8px;
}

.skeleton-table {
    width: 100%;
}

.skeleton-thead {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 16px;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    margin-bottom: 8px;
}

.skeleton-th {
    height: 12px;
    border-radius: 6px;
}

.skeleton-tbody {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.skeleton-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 16px;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
}

.skeleton-td {
    height: 16px;
    border-radius: 6px;
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

@media (max-width: 768px) {
    .skeleton-thead,
    .skeleton-row {
        grid-template-columns: repeat(4, 1fr);
    }
    
    .skeleton-th:nth-child(n+5),
    .skeleton-td:nth-child(n+5) {
        display: none;
    }
}
</style>
