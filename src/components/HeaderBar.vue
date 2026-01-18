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
        <div class="benchmark-container" v-if="auth.isLoggedIn">
          <span class="benchmark-label">基準:</span>
          <div class="selector-wrapper">
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
              <option value="0050.TW">元大台灣 50 (0050)</option>
              <option value="CUSTOM">自定義代碼...</option>
            </select>
            
            <input 
              v-if="isCustomBenchmark"
              v-model="customTicker"
              @blur="applyCustomBenchmark"
              @keyup.enter="applyCustomBenchmark"
              placeholder="代碼(如:NVDA)"
              class="custom-ticker-input"
              ref="customInput"
            />
          </div>
        </div>

        <div class="nav-actions">
          <button 
            v-if="auth.isLoggedIn"
            class="btn-sync" 
            @click="manualTrigger" 
            :disabled="store.isPolling || store.loading"
          >
            <span class="sync-icon" :class="{ 'spinning': store.isPolling }">🔄</span>
            <span class="btn-text">{{ store.isPolling ? '計算中' : '同步' }}</span>
          </button>

          <button class="btn-icon theme-toggle" @click="toggleDarkMode">
            <span v-if="isDark">☀️</span>
            <span v-else>🌙</span>
          </button>

          <button v-if="canInstall" class="btn-icon install-btn" @click="installPWA">
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
import { ref, watch, nextTick, onMounted } from 'vue';
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
const customInput = ref(null);

// --- Benchmark 核心處理邏輯 ---
const currentBenchmark = ref(store.selectedBenchmark || 'SPY');
const isCustomBenchmark = ref(false);
const customTicker = ref('');

// 監聽 Store 狀態以同步 UI
watch(() => store.selectedBenchmark, (newVal) => {
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
    currentBenchmark.value = store.selectedBenchmark;
    return;
  }
  // ✅ 修正：使用 JavaScript 標準 .trim()
  const ticker = customTicker.value.toUpperCase().trim();
  await confirmAndTrigger(ticker);
};

const confirmAndTrigger = async (ticker) => {
  const confirmed = window.confirm(`確定要將數據基準修改為 ${ticker} 並重新計算嗎？`);
  
  if (confirmed) {
    try {
      await store.triggerUpdate(ticker);
      addToast(`已成功切換至 ${ticker}，計算引擎啟動中...`, "success");
    } catch (err) {
      addToast(err.message || "更新失敗", "error");
      currentBenchmark.value = store.selectedBenchmark;
    }
  } else {
    currentBenchmark.value = store.selectedBenchmark;
  }
};

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
    if (store.resetData) store.resetData();
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

.logo-icon { -webkit-text-fill-color: initial; }

.nav-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

/* ✅ 基準選擇器強化樣式 */
.benchmark-container {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  padding: 6px 14px;
  border-radius: 12px;
  border: 2px solid var(--primary); /* 強化邊框 */
}

.benchmark-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--primary);
  white-space: nowrap;
}

.selector-wrapper { display: flex; gap: 6px; align-items: center; }

.benchmark-select {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.9rem;
  cursor: pointer;
  outline: none;
}

.custom-ticker-input {
  width: 100px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--primary);
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 0.9rem;
  text-transform: uppercase;
}

.nav-actions { display: flex; align-items: center; gap: 10px; }

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
}

.btn-sync:disabled { opacity: 0.6; cursor: not-allowed; }
.sync-icon.spinning { animation: spin 2s linear infinite; }

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
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--border-color);
}

.user-info { display: flex; flex-direction: column; text-align: right; }
.user-name { font-weight: 700; font-size: 0.9rem; color: var(--text-main); }
.user-email { font-size: 0.7rem; color: var(--text-sub); }

.btn-logout {
  background: transparent;
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
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
  width: 40%;
  animation: progress-move 2s infinite linear;
}

@keyframes progress-move {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

@media (max-width: 1024px) { .benchmark-label { display: none; } }
@media (max-width: 768px) {
  .logo-text, .user-info, .btn-text { display: none; }
  .header-content { padding: 0 10px; }
  .benchmark-container { padding: 4px 6px; }
}
</style>
