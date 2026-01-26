/**
 * src/main.js
 * 前端應用程式全域入口點 (Optimization v2.0)
 * 整合全域錯誤處理、狀態管理與樣式系統
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

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

// 2. 配置全域錯誤處理器 (Global Error Handler)
// 使用 useToast 取代原本的 alert，提供更優良的使用者體驗
const { addToast } = useToast();

app.config.errorHandler = (err, instance, info) => {
  console.error('❌ [Global Vue Error]:', err);
  console.error('ℹ️ [Component Info]:', info);
  
  // 過濾掉一些不需干擾用戶的錯誤
  if (err.message && err.message.includes('ResizeObserver')) return;

  // 顯示友善的錯誤提示
  addToast(
    `系統發生異常: ${err.message || '未知錯誤'}`, 
    'error', 
    5000 // 顯示久一點
  );
};

// 3. 捕捉未被處理的非同步錯誤 (Unhandled Promise Rejection)
// 常見於 API 請求失敗且未被 catch 時
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [Async Error]:', event.reason);
  
  const reason = event.reason || {};
  // 忽略特定的網路取消錯誤
  if (reason.name === 'AbortError') return;

  // 若是 API 相關錯誤，通常 store 內部會處理顯示，這裡僅做保底
  if (reason.message && !reason.message.includes('Fetch error')) {
      addToast('發生非預期的連線錯誤', 'warning');
  }
});

// 4. 效能追蹤 (僅在開發模式或非生產環境開啟)
if (!isProduction()) {
  app.config.performance = true;
  console.log('🔧 Performance tracing enabled');
}

// 5. 掛載應用程式
app.mount('#app');

// 6. 系統啟動 Log
console.log(
  `%c 🚀 Trading Journal PRO Launched %c v${CONFIG.APP_VERSION} (${CONFIG.BUILD_DATE}) `,
  'background:#3b82f6; color:white; padding: 4px 8px; border-radius: 4px 0 0 4px; font-weight:bold;',
  'background:#1e293b; color:white; padding: 4px 8px; border-radius: 0 4px 4px 0;'
);
