<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <div class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
            <span class="logo-icon">📊</span>
            <h1>Trading Journal <span class="badge">PRO</span></h1>
        </div>
        <div class="nav-status">
            <div class="status-indicator ready">
                <span class="dot"></span> 測試模式
            </div>
            
            <button class="theme-toggle" @click="toggleTheme">
                <span v-if="isDark">☀️</span>
                <span v-else>🌙</span>
            </button>
        </div>
      </header>

      <div class="content-container">
        <main class="main-column">
            <section class="section-stats">
                <div class="card">
                    <h3>應用運行測試</h3>
                    <p>如果您看到這個頁面，表示 Vue 應用已成功啟動。</p>
                    <p>當前時間: {{ currentTime }}</p>
                    <p>點擊次數: <strong>{{ clickCount }}</strong></p>
                    <button @click="handleTestClick" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; margin-right: 10px;">
                      測試互動
                    </button>
                    <button @click="resetCount" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer;">
                      重置計數
                    </button>
                </div>
            </section>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useDarkMode } from './composables/useDarkMode';

const { isDark, toggleTheme } = useDarkMode();
const currentTime = ref('');
const clickCount = ref(0);

const updateTime = () => {
  currentTime.value = new Date().toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const handleTestClick = () => {
  clickCount.value++;
  console.log('✅ 測試成功！點擊次數:', clickCount.value);
};

const resetCount = () => {
  clickCount.value = 0;
  console.log('🔄 計數已重置');
};

let timer;

onMounted(() => {
  console.log('🚀 App 已掛載');
  updateTime();
  timer = setInterval(updateTime, 1000);
  
  // 移除載入畫面
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) {
    loadingEl.style.opacity = '0';
    setTimeout(() => loadingEl.remove(), 300);
  }
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
    --bg-app: #f1f5f9;
    --bg-card: #ffffff;
    --bg-secondary: #f8fafc;
    --primary: #3b82f6;
    --text-main: #0f172a;
    --text-sub: #64748b;
    --border-color: #e2e8f0;
    --success: #10b981;
    --radius: 16px;
}

html.dark {
    --bg-app: #0f172a;
    --bg-card: #1e293b;
    --bg-secondary: #334155;
    --primary: #60a5fa;
    --text-main: #f1f5f9;
    --text-sub: #94a3b8;
    --border-color: #334155;
}

* {
    box-sizing: border-box;
}

body {
    background-color: var(--bg-app);
    color: var(--text-main);
    font-family: 'Inter', system-ui, sans-serif;
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    transition: background-color 0.3s ease, color 0.3s ease;
}

.main-wrapper { 
    min-height: 100vh; 
    display: flex; 
    flex-direction: column; 
}

.top-nav {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-color);
    padding: 0 32px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.nav-brand { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
}

.nav-brand h1 { 
    font-size: 1.25rem; 
    font-weight: 700; 
    margin: 0; 
    color: var(--text-main); 
}

.badge { 
    background: var(--text-main);
    color: var(--bg-card);
    font-size: 0.7rem; 
    padding: 2px 8px; 
    border-radius: 99px; 
    font-weight: 600; 
}

.logo-icon { 
    font-size: 1.5rem; 
}

.nav-status { 
    display: flex; 
    align-items: center; 
    gap: 20px; 
}

.status-indicator { 
    display: flex; 
    align-items: center; 
    gap: 8px; 
    color: var(--success);
    font-size: 0.9rem;
}

.dot { 
    width: 8px; 
    height: 8px; 
    border-radius: 50%; 
    background: currentColor; 
}

.theme-toggle {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 1.2rem;
}

.theme-toggle:hover {
    background: var(--primary);
    border-color: var(--primary);
    transform: scale(1.1);
}

.content-container { 
    max-width: 1200px; 
    margin: 0 auto; 
    padding: 32px; 
    width: 100%; 
}

.main-column { 
    display: flex; 
    flex-direction: column; 
    gap: 24px; 
}

.card { 
    background: var(--bg-card); 
    border: 1px solid var(--border-color); 
    border-radius: var(--radius); 
    padding: 32px; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.card h3 { 
    font-size: 1.25rem; 
    font-weight: 700; 
    color: var(--text-main); 
    margin: 0 0 16px 0; 
}

.card p {
    color: var(--text-sub);
    margin: 8px 0;
    line-height: 1.6;
}

.card p strong {
    color: var(--primary);
    font-size: 1.5rem;
}

@media (max-width: 768px) {
    .top-nav {
        padding: 0 16px;
        height: 56px;
    }
    
    .nav-brand h1 {
        font-size: 1.1rem;
    }
    
    .content-container {
        padding: 16px;
    }
}
</style>
