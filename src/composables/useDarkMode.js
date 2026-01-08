import { ref, watch } from 'vue';

const isDark = ref(false);

export function useDarkMode() {
  // 初始化
  const initTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    isDark.value = savedTheme === 'dark' || (!savedTheme && prefersDark);
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

  // 監聽系統主題變化
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
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
