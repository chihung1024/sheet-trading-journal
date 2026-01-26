/**
 * src/main.js (v2.41 Hotfix)
 * 修正: 補回 Vue Router 註冊，解決 router-view 崩潰問題
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router'; // <--- [關鍵修正] 引入 Router

// 引入全域動畫與基礎樣式
import './styles/animations.css';

// 引入設定與工具
import { CONFIG, isProduction } from './config';
import { useToast } from './composables/useToast';

// 建立 Vue 實例
const app = createApp(App);
const pinia = createPinia();

// 1. 安裝 Pinia 狀態管理
app.use(pinia);

// 2. 安裝 Vue Router <--- [關鍵修正] 必須在 mount 之前安裝
app.use(router);

// 3. 配置全域錯誤處理器 (Global Error Handler)
const { addToast } = useToast();

app.config.errorHandler = (err, instance, info) => {
  console.error('❌ [Global Vue Error]:', err);
  
  if (err.message && err.message.includes('ResizeObserver')) return;

  addToast(
    `系統發生異常: ${err.message || '未知錯誤'}`, 
    'error', 
    5000
  );
};

// 4. 捕捉非同步錯誤
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason || {};
  if (reason.name === 'AbortError') return;

  console.error('❌ [Async Error]:', reason);
});

// 5. 效能追蹤
if (!isProduction()) {
  app.config.performance = true;
}

// 6. 掛載應用程式
app.mount('#app');

console.log(
  `%c 🚀 Trading Journal PRO Launched %c v${CONFIG.APP_VERSION} (${CONFIG.BUILD_DATE}) `,
  'background:#3b82f6; color:white; padding: 4px 8px; border-radius: 4px 0 0 4px; font-weight:bold;',
  'background:#1e293b; color:white; padding: 4px 8px; border-radius: 0 4px 4px 0;'
);
