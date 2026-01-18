<template>
  <header class="header-bar">
    <div class="header-content">
      <div class="logo-section">
        <h1 @click="$emit('go-home')" class="cursor-pointer">
          <span class="logo-icon">📈</span>
          <span class="logo-text">Trading Journal <span class="badge">PRO</span></span>
        </h1>
      </div>

      <nav class="nav-section">
        <div class="benchmark-container" v-if="authStore.token">
          <span class="benchmark-label">基準標的:</span>
          <div class="selector-wrapper">
            <select 
              id="benchmark-select" 
              v-model="currentBenchmark" 
              @change="handleBenchmarkChange"
              :disabled="portfolioStore.isPolling"
              class="benchmark-select"
            >
              <option value="SPY">S&P 500 (SPY)</option>
              <option value="QQQ">Nasdaq 100 (QQQ)</option>
              <option value="VT">Global Stock (VT)</option>
              <option value="0050.TW">元大台灣 50 (0050)</option>
              <option value="CUSTOM">自定義代碼...</option>
            </select>
            
            <input 
              v-if="isCustomBenchmark"
              v-model="customTicker"
              @blur="applyCustomBenchmark"
              @keyup.enter="applyCustomBenchmark"
              placeholder="輸入代碼..."
              class="custom-ticker-input"
              ref="customInput"
            />
          </div>
        </div>

        <div class="nav-actions">
          <button 
            v-if="authStore.token"
            class="btn-sync" 
            @click="manualTrigger" 
            :disabled="portfolioStore.isPolling || portfolioStore.loading"
            :title="portfolioStore.isPolling ? '數據計算中...' : '手動同步數據'"
          >
            <span class="sync-icon" :class="{ 'spinning': portfolioStore.isPolling }">🔄</span>
            <span class="btn-text">{{ portfolioStore.isPolling ? '計算中' : '同步' }}</span>
          </button>

          <button class="btn-icon theme-toggle" @click="toggleTheme" :title="isDark ? '切換淺色模式' : '切換深色模式'">
            <span v-if="isDark">☀️</span>
            <span v-else>🌙</span>
          </button>

          <button v-if="canInstall" class="btn-icon install-btn" @click="installPWA" title="安裝應用程式">
            📥
          </button>

          <div v-if="authStore.token" class="user-menu">
            <div class="user-info">
              <span class="user-name">{{ authStore.user?.name || 'User' }}</span>
              <span class="user-email">{{ authStore.user?.email || '' }}</span>
            </div>
            <button class="btn-logout" @click="handleLogout">登出</button>
          </div>
        </div>
      </nav>
    </div>

    <div v-if="portfolioStore.isPolling" class="sync-progress">
      <div class="progress-bar"></div>
    </div>
  </header>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { useDarkMode } from '../composables/useDarkMode';
import { usePWA } from '../composables/usePWA';
import { useToast } from '../composables/useToast';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { isDark, toggleTheme } = useDarkMode();
const { canInstall, installPWA } = usePWA();
const { addToast } = useToast();

const emit = defineEmits(['go-home']);
const customInput = ref(null);

// --- Benchmark 核心處理邏輯 ---
const currentBenchmark = ref(portfolioStore.selectedBenchmark || 'SPY');
const isCustomBenchmark = ref(false);
const customTicker = ref('');

// 監聽 Store 狀態以同步介面顯示
watch(() => portfolioStore.selectedBenchmark, (newVal) => {
  if (['SPY', 'QQQ', 'VT', '0050.TW'].includes(newVal)) {
    currentBenchmark.value = newVal;
    isCustomBenchmark.value = false;
  } else if (newVal) {
    currentBenchmark.value = 'CUSTOM';
    isCustomBenchmark.value = true;
    customTicker.value = newVal;
  }
}, { immediate: true });

const handleBenchmarkChange = async () => {
  if (currentBenchmark.value === 'CUSTOM') {
    isCustomBenchmark.value = true;
    await nextTick();
    if (customInput.value) customInput.value.focus();
    return;
  }
  
  isCustomBenchmark.value = false;
  await confirmAndTrigger(currentBenchmark.value);
};

const applyCustomBenchmark = async () => {
  if (!customTicker.value) {
    isCustomBenchmark.value = false;
    currentBenchmark.value = portfolioStore.selectedBenchmark;
    return;
  }
  // ✅ 修正：使用 .trim()
  const ticker = customTicker.value.toUpperCase().trim();
  await confirmAndTrigger(ticker);
};

const confirmAndTrigger = async (ticker) => {
  const confirmed = window.confirm(`確定要將數據基準 (Benchmark) 修改為 ${ticker} 並重新計算嗎？`);
  
  if (confirmed) {
    try {
      await portfolioStore.triggerUpdate(ticker);
      addToast(`已成功切換基準至 ${ticker}，正在重新計算數據...`, "success");
    } catch (err) {
      addToast(err.message || "更新基準失敗", "error");
      currentBenchmark.value = portfolioStore.selectedBenchmark;
    }
  } else {
    currentBenchmark.value = portfolioStore.selectedBenchmark;
  }
};

const manualTrigger = async () => {
  try {
    await portfolioStore.triggerUpdate();
    addToast("已觸發數據手動同步", "success");
  } catch (err) {
    addToast(err.message || "觸發同步失敗", "error");
  }
};

const handleLogout = () => {
  if (confirm("確定要登出系統嗎？")) {
    authStore.logout();
    if (portfolioStore.resetData) portfolioStore.resetData();
    addToast("已安全登出", "info");
  }
};

onMounted(() => {
  console.log("🛠️ HeaderBar: Benchmark Selector Initialized");
});
</script>

<style scoped>
.header-bar {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
}

.header-content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 32px;
  height: 70px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-section h1 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-main);
}

.badge {
  background: var(--primary);
  color: white;
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 99px;
  vertical-align: middle;
}

.nav-section {
  display: flex;
  align-items: center;
  gap: 20px;
}

/* Benchmark Selector 樣式 */
.benchmark-container {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  padding: 6px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.benchmark-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-sub);
  white-space: nowrap;
}

.selector-wrapper {
  display: flex;
  gap: 6px;
  align-items: center;
}

.benchmark-select {
  background: transparent;
  border: none;
  color: var(--text-main);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
}

.custom-ticker-input {
  width: 90px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--primary);
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 0.85rem;
  text-transform: uppercase;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-sync {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--primary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sync:hover:not(:disabled) {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

.btn-sync:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sync-icon.spinning {
  animation: spin 2s linear infinite;
}

.btn-icon {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  width: 38px;
  height: 38px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  transition: all 0.2s;
}

.btn-icon:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--border-color);
}

.user-info {
  display: flex;
  flex-direction: column;
  text-align: right;
}

.user-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-main);
}

.user-email {
  font-size: 0.7rem;
  color: var(--text-sub);
}

.btn-logout {
  background: transparent;
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-logout:hover {
  background: var(--danger);
  color: white;
}

.sync-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: rgba(59, 130, 246, 0.1);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--primary);
  width: 30%;
  animation: progress-move 2s infinite linear;
}

@keyframes progress-move {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(330%); }
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.cursor-pointer { cursor: pointer; }

@media (max-width: 1024px) {
  .benchmark-label, .user-email { display: none; }
}

@media (max-width: 768px) {
  .logo-text, .user-info, .btn-text { display: none; }
  .header-content { padding: 0 16px; }
  .nav-section { gap: 10px; }
  .benchmark-container { padding: 4px 8px; }
}
</style>
