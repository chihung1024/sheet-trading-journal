import { ref, onMounted, watch } from 'vue';

// [Singleton State]
// 全域共用狀態，確保 Header 開關與圖表配色同步
const isDark = ref(false);
const STORAGE_KEY = 'theme_preference';

export function useDarkMode() {
  /**
   * 套用主題到 DOM
   */
  const applyTheme = (dark) => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    isDark.value = dark;
  };

  /**
   * 切換主題
   */
  const toggleTheme = () => {
    const newVal = !isDark.value;
    applyTheme(newVal);
    localStorage.setItem(STORAGE_KEY, newVal ? 'dark' : 'light');
  };

  /**
   * 初始化主題
   * 優先順序：LocalStorage > 系統偏好 > 預設淺色
   */
  const initTheme = () => {
    // 1. 檢查 LocalStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (stored) {
      applyTheme(stored === 'dark');
    } else {
      // 2. 檢查系統偏好
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemPrefersDark);
    }
  };

  /**
   * 監聽系統主題變更
   * 僅在用戶未手動設定過主題時生效
   */
  onMounted(() => {
    initTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // 定義監聽器
    const handler = (e) => {
      // 如果用戶沒有手動覆蓋過設定 (localStorage 為空)，則隨系統變更
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches);
      }
    };

    // 現代瀏覽器使用 addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      // 舊版兼容
      mediaQuery.addListener(handler);
    }
  });

  return {
    isDark,
    toggleTheme
  };
}
