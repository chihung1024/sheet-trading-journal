<template>
  <div
    class="app-container"
    :data-theme="themeStore.isDark ? 'dark' : 'light'"
  >
    <LoginOverlay v-if="!authStore.token" />
    <div v-else class="app-wrapper">
      <!-- Header with improved spacing -->
      <HeaderBar ref="headerRef" class="app-header" />

      <main class="main-content">
        <!-- Loading state -->
        <div v-if="portfolioStore.loading" class="loading-section">
          <div class="skeleton-grid">
            <div
              v-for="i in 4"
              :key="i"
              class="skeleton-card"
            />
          </div>
        </div>

        <!-- Main content wrapper with improved layout -->
        <div v-else class="content-wrapper">
          <!-- Stats section with better spacing -->
          <section class="stats-section">
            <div class="section-header">
              <h2>Portfolio Overview</h2>
            </div>
            <div class="stats-container">
              <StatsGrid />
            </div>
          </section>

          <!-- Charts section with responsive grid -->
          <section class="charts-section">
            <div class="section-header">
              <h2>Performance Analysis</h2>
            </div>
            <div class="charts-grid">
              <div class="chart-wrapper">
                <PerformanceChart />
              </div>
              <div class="chart-wrapper">
                <PieChart />
              </div>
            </div>
          </section>

          <!-- Holdings section -->
          <section class="holdings-section">
            <div class="section-header">
              <h2>Holdings</h2>
            </div>
            <HoldingsTable />
          </section>

          <!-- Trade form section -->
          <section class="trade-form-section">
            <div class="section-header">
              <h2>Record Trade</h2>
            </div>
            <TradeForm
              ref="tradeFormRef"
              id="trade-form-anchor"
              @success="handleTradeSuccess"
            />
          </section>

          <!-- Records section -->
          <section class="records-section">
            <div class="section-header">
              <h2>Trade History</h2>
            </div>
            <RecordList @edit="handleEditRecord" />
          </section>
        </div>
      </main>
    </div>

    <!-- Global components -->
    <ToastContainer />
    <ConfirmDialog />
    <NavigationDrawer ref="drawerRef" />
  </div>
</template>

<script>
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { usePortfolioStore } from '@/stores/portfolio';
import HeaderBar from '@/components/HeaderBar.vue';
import LoginOverlay from '@/components/LoginOverlay.vue';
import StatsGrid from '@/components/StatsGrid.vue';
import PerformanceChart from '@/components/PerformanceChart.vue';
import PieChart from '@/components/PieChart.vue';
import HoldingsTable from '@/components/HoldingsTable.vue';
import TradeForm from '@/components/TradeForm.vue';
import RecordList from '@/components/RecordList.vue';
import ToastContainer from '@/components/ToastContainer.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import NavigationDrawer from '@/components/NavigationDrawer.vue';

export default {
  name: 'App',
  components: {
    HeaderBar,
    LoginOverlay,
    StatsGrid,
    PerformanceChart,
    PieChart,
    HoldingsTable,
    TradeForm,
    RecordList,
    ToastContainer,
    ConfirmDialog,
    NavigationDrawer,
  },
  setup() {
    const authStore = useAuthStore();
    const themeStore = useThemeStore();
    const portfolioStore = usePortfolioStore();
    const headerRef = ref(null);
    const tradeFormRef = ref(null);
    const drawerRef = ref(null);

    const handleTradeSuccess = () => {
      if (headerRef.value) {
        headerRef.value.showSuccess?.('Trade recorded successfully');
      }
    };

    const handleEditRecord = (record) => {
      if (tradeFormRef.value) {
        tradeFormRef.value.editRecord(record);
        const tradeFormAnchor = document.getElementById('trade-form-anchor');
        if (tradeFormAnchor) {
          tradeFormAnchor.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    return {
      authStore,
      themeStore,
      portfolioStore,
      headerRef,
      tradeFormRef,
      drawerRef,
      handleTradeSuccess,
      handleEditRecord,
    };
  },
};
</script>

<style scoped>
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;

  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-border: #e0e0e0;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

[data-theme='dark'] {
  --color-bg-primary: #1a1a1a;
  --color-bg-secondary: #2d2d2d;
  --color-border: #404040;
  --color-text-primary: #ffffff;
  --color-text-secondary: #b0b0b0;
}

.app-container {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  background-color: var(--color-bg-primary);
}

.loading-section {
  padding: var(--spacing-xl);
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-lg);
}

.skeleton-card {
  aspect-ratio: 1;
  background: linear-gradient(
    90deg,
    var(--color-bg-secondary) 0%,
    var(--color-border) 50%,
    var(--color-bg-secondary) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-md);
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.content-wrapper {
  padding: var(--spacing-xl);
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

/* Section styling with consistent spacing */
section {
  margin-bottom: var(--spacing-2xl);
  animation: fadeInUp 0.4s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.section-header {
  margin-bottom: var(--spacing-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary);
  letter-spacing: -0.5px;
}

/* Stats section */
.stats-section {
  background-color: var(--color-bg-secondary);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.stats-container {
  display: grid;
  gap: var(--spacing-lg);
}

/* Charts section */
.charts-section {
  background-color: var(--color-bg-secondary);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-lg);
}

.chart-wrapper {
  background-color: var(--color-bg-primary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  min-height: 350px;
}

/* Holdings section */
.holdings-section {
  background-color: var(--color-bg-secondary);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

/* Trade form section */
.trade-form-section {
  background-color: var(--color-bg-secondary);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

/* Records section */
.records-section {
  background-color: var(--color-bg-secondary);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .content-wrapper {
    padding: var(--spacing-lg);
  }

  section {
    margin-bottom: var(--spacing-xl);
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .section-header h2 {
    font-size: 1.25rem;
  }
}

@media (max-width: 768px) {
  .content-wrapper {
    padding: var(--spacing-md);
  }

  section {
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: var(--spacing-md);
  }

  .section-header h2 {
    font-size: 1.125rem;
  }

  .skeleton-grid {
    grid-template-columns: 1fr;
  }
}
</style>
