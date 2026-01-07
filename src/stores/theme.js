import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(true);

  const initTheme = () => {
    const saved = localStorage.getItem('trading-journal-theme');
    if (saved) {
      isDark.value = saved === 'dark';
    } else {
      // 預設深色模式
      isDark.value = true;
    }
  };

  const toggleTheme = () => {
    isDark.value = !isDark.value;
    localStorage.setItem('trading-journal-theme', isDark.value ? 'dark' : 'light');
  };

  const setTheme = (dark) => {
    isDark.value = dark;
    localStorage.setItem('trading-journal-theme', dark ? 'dark' : 'light');
  };

  return {
    isDark,
    initTheme,
    toggleTheme,
    setTheme,
  };
});
