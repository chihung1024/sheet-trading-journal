<template>
  <header class="header-bar">
    <div class="header-content">
      <div class="logo-section">
        <h1 @click="$emit('go-home')">
          <span class="logo-icon">📈</span>
          <span class="logo-text">Sheet Trading Journal</span>
        </h1>
      </div>

      <nav class="nav-section">
        <div class="benchmark-selector" v-if="auth.isLoggedIn">
          <label for="benchmark-select">基準標的:</label>
          <select 
            id="benchmark-select" 
            v-model="currentBenchmark" 
            @change="handleBenchmarkChange"
            :disabled="store.isPolling"
            class="benchmark-select"
          >
            <option value="SPY">S&P 500 (SPY)</option>
            <option value="QQQ">Nasdaq 100 (QQQ)</option>
            <option value="VT">Global Stock (VT)</option>
            <option value="0050.TW">元大台灣50 (0050)</option>
            <option value="CUSTOM">自定義代碼...</option>
          </select>
          
          <input 
            v-if="isCustomBenchmark"
            v-model="customTicker"
            @blur="applyCustomBenchmark"
            @keyup.enter="applyCustomBenchmark"
            placeholder="輸入代碼 (如 NVDA)"
            class="custom-ticker-input"
          />
        </div>

        <div class="nav-actions">
          <button 
            v-if="auth.isLoggedIn"
            class="btn-sync" 
            @click="manualTrigger" 
            :disabled="store.isPolling || store.loading"
            :title="store.isPolling ? '數據計算中...' : '手動同步數據'"
          >
            <span class="sync-icon" :class="{ 'spinning': store.isPolling }">🔄</span>
            <span class="btn-text">{{ store.isPolling ? '計算中...' : '同步' }}</span>
          </button>

          <button class="btn-icon theme-toggle" @click="toggleDarkMode" :title="isDark ? '切換淺色模式' : '切換深色模式'">
            <span v-if="isDark">☀️</span>
            <span v-else>🌙</span>
          </button>

          <button v-if="canInstall" class="btn-icon install-btn" @click="installPWA" title="安裝應用程式">
            📥
          </button>

          <div v-if="auth.isLoggedIn" class="user-menu">
            <div class="user-info">
              <span class="user-name">{{ auth.user }}</span>
              <span class="user-email">{{ auth.email }}</span>
            </div>
            <button class="btn-logout" @click="handleLogout">登出</button>
          </div>
        </div>
      </nav>
    </div>

    <div v-if="store.isPolling" class="sync-progress">
      <div class="progress-bar"></div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { useDarkMode } from '../composables/useDarkMode';
import { usePWA } from '../composables/usePWA';
import { useToast } from '../composables/useToast';

const auth = useAuthStore();
const store = usePortfolioStore();
const { isDark, toggleDarkMode } = useDarkMode();
const { canInstall, installPWA } = usePWA();
const { addToast } = useToast();

const emit = defineEmits(['go-home']);

// --- Benchmark 邏輯 ---
const currentBenchmark = ref(store.selectedBenchmark);
const isCustomBenchmark = ref(false);
const customTicker = ref('');

// 監聽 Store 的基準變動 (例如其他組件修改或載入時)
watch(() => store.selectedBenchmark, (newVal) => {
  if (['SPY', 'QQQ', 'VT', '0050.TW'].includes(newVal)) {
    currentBenchmark.value = newVal;
    isCustomBenchmark.value = false;
  } else {
    currentBenchmark.value = 'CUSTOM';
    isCustomBenchmark.value = true;
    customTicker.value = newVal;
  }
}, { immediate: true });

const handleBenchmarkChange = async () => {
  if (currentBenchmark.value === 'CUSTOM') {
    isCustomBenchmark.value = true;
    return;
  }
  
  isCustomBenchmark.value = false;
  await confirmAndTrigger(currentBenchmark.value);
};

const applyCustomBenchmark = async () => {
  if (!customTicker.value) return;
  const ticker = customTicker.value.toUpperCase().strip();
  await confirmAndTrigger(ticker);
};

const confirmAndTrigger = async (ticker) => {
  const confirmed = window.confirm(`確定要將 Benchmark 修改為 ${ticker} 並重新計算所有數據嗎？`);
  
  if (confirmed) {
    try {
      await store.triggerUpdate(ticker);
      addToast(`已成功切換基準至 ${ticker}，計算引擎啟動中...`, "success");
    } catch (err) {
      addToast(err.message || "更新失敗", "error");
      // 失敗時回退介面狀態
      currentBenchmark.value = store.selectedBenchmark;
    }
  } else {
    // 使用者取消，恢復選單狀態
    currentBenchmark.value = store.selectedBenchmark;
  }
};

// --- 其他功能 ---
const manualTrigger = async () => {
  try {
    await store.triggerUpdate();
    addToast("已觸發手動更新", "success");
  } catch (err) {
    addToast(err.message || "觸發失敗", "error");
  }
};

const handleLogout = () => {
  if (confirm("確定要登出嗎？")) {
    auth.logout();
    store.resetData();
    addToast("已安全登出", "info");
  }
};
</script>

<style scoped>
.header-bar {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  height: 70px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-section h1 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, var(--primary), #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.logo-icon {
  -webkit-text-fill-color: initial;
}

.nav-section {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Benchmark Selector Styles */
.benchmark-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.9rem;
}

.benchmark-selector label {
  color: var(--text-sub);
  font-weight: 600;
}

.benchmark-select {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-main);
  border-radius: 4px;
  padding: 2px 4px;
  cursor: pointer;
}

.custom-ticker-input {
  width: 100px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--primary);
  background: var(--bg-card);
  color: var(--text-main);
}

.btn-sync {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--primary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-sync:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
}

.btn-sync:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.sync-icon {
  display: inline-block;
}

.sync-icon.spinning {
  animation: spin 2s linear infinite;
}

.btn-icon {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  width: 38px;
  height: 38px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.btn-icon:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-left: 16px;
  border-left: 1px solid var(--border-color);
}

.user-info {
  display: flex;
  flex-direction: column;
  text-align: right;
}

.user-name {
  font-weight: 700;
  font-size: 0.95rem;
}

.user-email {
  font-size: 0.8rem;
  color: var(--text-sub);
}

.btn-logout {
  background: transparent;
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout:hover {
  background: var(--danger);
  color: white;
}

/* Progress Bar */
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
  100% { transform: translateX(400%); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .logo-text, .user-info, .btn-text {
    display: none;
  }
  .header-content {
    padding: 0 12px;
  }
  .nav-section {
    gap: 12px;
  }
  .benchmark-selector {
    padding: 4px 8px;
  }
  .benchmark-selector label {
    display: none;
  }
}
</style>
