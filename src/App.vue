<template>
  <div class="app-container" :data-theme="themeStore.isDark ? 'dark' : 'light'">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="app-layout">
      <!-- Sidebar Navigation -->
      <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
        <div class="sidebar-header">
          <h1 class="sidebar-brand">📊 Trading Journal</h1>
          <button class="sidebar-close" @click="sidebarOpen = false" aria-label="Close sidebar">
            ✕
          </button>
        </div>
        
        <nav class="sidebar-nav">
          <ul class="nav-menu">
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: currentPage === 'dashboard' }"
                @click="navigateTo('dashboard')"
              >
                📈 Dashboard
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: currentPage === 'trades' }"
                @click="navigateTo('trades')"
              >
                💹 Trades
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: currentPage === 'analysis' }"
                @click="navigateTo('analysis')"
              >
                📊 Analysis
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: currentPage === 'settings' }"
                @click="navigateTo('settings')"
              >
                ⚙️ Settings
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <!-- Main Content -->
      <div class="main-wrapper">
        <!-- Header -->
        <HeaderBar
          ref="headerRef"
          class="app-header"
          @toggle-theme="toggleTheme"
          @toggle-sidebar="sidebarOpen = !sidebarOpen"
        />

        <!-- Page Content -->
        <main class="main-content">
          <!-- Dashboard Page -->
          <div v-if="currentPage === 'dashboard'" class="page-container">
            <!-- Loading state -->
            <div v-if="portfolioStore.loading" class="loading-section">
              <div class="skeleton-grid">
                <div v-for="i in 4" :key="i" class="skeleton-card" />
              </div>
            </div>

            <!-- Dashboard Content -->
            <div v-else>
              <!-- Stats Grid -->
              <section class="stats-section">
                <div class="section-header">
                  <h2>Portfolio Overview</h2>
                </div>
                <StatsGrid />
              </section>

              <!-- Charts Section -->
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

              <!-- Holdings Section -->
              <section class="holdings-section">
                <div class="section-header">
                  <h2>Holdings</h2>
                </div>
                <HoldingsTable />
              </section>
            </div>
          </div>

          <!-- Trades Page -->
          <div v-else-if="currentPage === 'trades'" class="page-container">
            <section class="trade-form-section">
              <div class="section-header">
                <h2>Record New Trade</h2>
              </div>
              <TradeForm
                ref="tradeFormRef"
                id="trade-form-anchor"
                @success="handleTradeSuccess"
              />
            </section>

            <section class="records-section">
              <div class="section-header">
                <h2>Trade History</h2>
              </div>
              <RecordList @edit="handleEditRecord" />
            </section>
          </div>

          <!-- Analysis Page -->
          <div v-else-if="currentPage === 'analysis'" class="page-container">
            <section class="analysis-section">
              <div class="section-header">
                <h2>Performance Analysis</h2>
              </div>
              <div class="analysis-grid">
                <div class="analysis-card">
                  <h3>Return Statistics</h3>
                  <p>Total Return: {{ formatValue(portfolioStore.totalReturn) }}</p>
                  <p>YTD Return: {{ formatValue(portfolioStore.ytdReturn) }}</p>
                </div>
                <div class="analysis-card">
                  <h3>Risk Metrics</h3>
                  <p>Max Drawdown: {{ formatValue(portfolioStore.maxDrawdown) }}</p>
                  <p>Volatility: {{ formatValue(portfolioStore.volatility) }}</p>
                </div>
                <div class="analysis-card">
                  <h3>Trade Statistics</h3>
                  <p>Win Rate: {{ formatValue(portfolioStore.winRate) }}%</p>
                  <p>Profit Factor: {{ formatValue(portfolioStore.profitFactor) }}</p>
                </div>
                <div class="analysis-card">
                  <h3>Time Analysis</h3>
                  <p>Average Trade Duration: {{ portfolioStore.avgTradeDuration }}</p>
                  <p>Total Trades: {{ portfolioStore.totalTrades }}</p>
                </div>
              </div>
            </section>
          </div>

          <!-- Settings Page -->
          <div v-else-if="currentPage === 'settings'" class="page-container">
            <section class="settings-section">
              <div class="section-header">
                <h2>Settings</h2>
              </div>
              <div class="settings-grid">
                <div class="settings-card">
                  <h3>Display Settings</h3>
                  <div class="setting-item">
                    <label>Theme:</label>
                    <button class="theme-toggle" @click="toggleTheme">
                      {{ themeStore.isDark ? '☀️ Light' : '🌙 Dark' }}
                    </button>
                  </div>
                </div>
                <div class="settings-card">
                  <h3>Account Settings</h3>
                  <div class="setting-item">
                    <button class="logout-btn" @click="handleLogout">
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>

    <!-- Global Components -->
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
    
    const currentPage = ref('dashboard');
    const sidebarOpen = ref(false);
    const headerRef = ref(null);
    const tradeFormRef = ref(null);
    const drawerRef = ref(null);

    const navigateTo = (page) => {
      currentPage.value = page;
      sidebarOpen.value = false; // Close sidebar on navigation
    };

    const toggleTheme = () => {
      themeStore.toggleDarkMode();
    };

    const handleTradeSuccess = () => {
      if (headerRef.value) {
        headerRef.value.showSuccess?.('Trade recorded successfully');
      }
      navigateTo('dashboard');
    };

    const handleEditRecord = (record) => {
      if (tradeFormRef.value) {
        tradeFormRef.value.editRecord(record);
        const tradeFormAnchor = document.getElementById('trade-form-anchor');
        if (tradeFormAnchor) {
          tradeFormAnchor.scrollIntoView({ behavior: 'smooth' });
        }
      }
      navigateTo('trades');
    };

    const handleLogout = async () => {
      await authStore.logout();
    };

    const formatValue = (value) => {
      if (typeof value === 'number') {
        if (value >= 1000000) {
          return (value / 1000000).toFixed(2) + 'M';
        } else if (value >= 1000) {
          return (value / 1000).toFixed(2) + 'K';
        } else if (value < 1 && value > 0) {
          return value.toFixed(4);
        }
        return value.toFixed(2);
      }
      return value;
    };

    return {
      authStore,
      themeStore,
      portfolioStore,
      currentPage,
      sidebarOpen,
      headerRef,
      tradeFormRef,
      drawerRef,
      navigateTo,
      toggleTheme,
      handleTradeSuccess,
      handleEditRecord,
      handleLogout,
      formatValue,
    };
  },
};
</script>

<style scoped>
/* CSS Variables */
:root {
  --sidebar-width: 280px;
  --sidebar-bg: #2d2d2d;
  --sidebar-text: #ffffff;
  --sidebar-border: #404040;
  --content-bg: #ffffff;
  --content-text: #1a1a1a;
  --border-color: #e0e0e0;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  --radius-md: 8px;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}

[data-theme='dark'] {
  --content-bg: #1a1a1a;
  --content-text: #ffffff;
  --border-color: #2d2d2d;
}

.app-container {
  min-height: 100vh;
  background-color: var(--content-bg);
  color: var(--content-text);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background-color: var(--sidebar-bg);
  color: var(--sidebar-text);
  border-right: 1px solid var(--sidebar-border);
  overflow-y: auto;
  transition: transform 0.3s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--sidebar-border);
}

.sidebar-brand {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  white-space: nowrap;
}

.sidebar-close {
  display: none;
  background: transparent;
  border: none;
  color: var(--sidebar-text);
  font-size: 1.5rem;
  cursor: pointer;
}

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-md) 0;
}

.nav-menu {
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-item {
  margin: 0;
}

.nav-link {
  display: flex;
  align-items: center;
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  background: transparent;
  border: none;
  color: var(--sidebar-text);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
  text-align: left;
  gap: var(--spacing-sm);
}

.nav-link:hover,
.nav-link.active {
  background-color: rgba(255, 255, 255, 0.1);
  border-left: 3px solid #2196f3;
  padding-left: calc(var(--spacing-lg) - 3px);
}

.main-wrapper {
  flex: 1;
  margin-left: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  background-color: var(--content-bg);
}

.page-container {
  padding: var(--spacing-xl);
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

section {
  margin-bottom: var(--spacing-2xl);
  background-color: var(--content-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-xl);
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
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--content-text);
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
  background: linear-gradient(90deg, var(--border-color) 0%, #f0f0f0 50%, var(--border-color) 100%);
  background-size: 200% 100%;
  border-radius: var(--radius-md);
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-lg);
}

.chart-wrapper {
  background-color: var(--content-bg);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  min-height: 350px;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}

.analysis-card {
  background-color: var(--content-bg);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.analysis-card h3 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.analysis-card p {
  margin: var(--spacing-sm) 0;
  color: var(--content-text);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

.settings-card {
  background-color: var(--content-bg);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.settings-card h3 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin: var(--spacing-md) 0;
}

.setting-item label {
  font-weight: 500;
}

.theme-toggle,
.logout-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.theme-toggle:hover,
.logout-btn:hover {
  background-color: #1976d2;
}

.logout-btn {
  background-color: #f44336;
}

.logout-btn:hover {
  background-color: #d32f2f;
}

@media (max-width: 1024px) {
  :root {
    --sidebar-width: 240px;
  }
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  :root {
    --sidebar-width: 100%;
  }
  .sidebar {
    transform: translateX(-100%);
  }
  .sidebar.sidebar-open {
    transform: translateX(0);
  }
  .sidebar-close {
    display: block;
  }
  .main-wrapper {
    margin-left: 0;
  }
  .page-container {
    padding: var(--spacing-lg);
  }
  section {
    padding: var(--spacing-lg);
  }
  .charts-grid,
  .analysis-grid,
  .settings-grid {
    grid-template-columns: 1fr;
  }
  .section-header h2 {
    font-size: 1.25rem;
  }
}

@media (max-width: 480px) {
  .page-container {
    padding: var(--spacing-md);
  }
  section {
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }
  .section-header h2 {
    font-size: 1.1rem;
  }
  .skeleton-grid {
    grid-template-columns: 1fr;
  }
}
</style>
