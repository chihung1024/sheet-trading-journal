import { ref, watch } from 'vue';

const isDark = ref(false);

export function useDarkMode() {
  // 初始化 - 預設亮色，優先檢查保存的主題偏好
  const initTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
      // 用戶之前選擇了深色模式
      isDark.value = true;
    } else {
      // 無保存設置或保存的是 'light'，默認使用亮色模式
      isDark.value = false;
    }
    
    applyTheme();
  };

  // 應用主題
  const applyTheme = () => {
    if (isDark.value) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // 切換主題
  const toggleTheme = () => {
    isDark.value = !isDark.value;
    applyTheme();
  };

  // 監聽系統主題變化 (當用戶未保存偏好時)
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // 僅當用戶未保存主題設置時才跟隨系統
      if (!localStorage.getItem('theme')) {
        isDark.value = e.matches;
        applyTheme();
      }
    });
  }

  // 初始化
  if (typeof window !== 'undefined') {
    initTheme();
  }

  return {
    isDark,
    toggleTheme
  };
}
