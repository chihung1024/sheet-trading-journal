/**
 * main.js: 前端應用程式全域入口點
 * 優化內容：引入全域樣式表 (style.css)，確保 Design Tokens 生效
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

// 引入全域樣式與動畫 (順序很重要：先動畫，後主樣式)
import './styles/animations.css';
import './style.css'; // ✅ 新增：引入 Phase 15 定義的全域樣式與變數

const app = createApp(App);
const pinia = createPinia();

/**
 * ✅ 全域 Vue 錯誤處理器
 * 捕捉組件渲染、生命週期鉤子與事件處理器中的錯誤
 */
app.config.errorHandler = (err, instance, info) => {
  console.error('❌ [Global Vue Error]:', err);
  console.error('ℹ️ [Error Info]:', info);
  
  // 避免在開發環境頻繁彈窗，但在生產環境提供基本反饋
  if (import.meta.env.PROD) {
    // 這裡可以考慮整合 Toast，但因為是全域崩潰，Alert 是最安全的最後手段
    const errorMessage = err.message || '未知錯誤';
    // 簡單提示，避免 ghost data 困惑
    console.warn(`系統異常: ${errorMessage}`);
  }
};

/**
 * ✅ 捕捉未被處理的 Promise 拒絕 (Unhandled Promise Rejection)
 * 監控 API 請求或 Store 中的非同步邏輯失敗
 */
window.addEventListener('unhandledrejection', (event) => {
  // 忽略一些常見但無害的取消操作
  if (event.reason && event.reason.name === 'AbortError') return;

  console.error('❌ [Async Error]:', event.reason);
  
  if (event.reason && event.reason.message && event.reason.message.includes('API Error')) {
    console.warn('📡 偵測到 API 連線異常');
  }
});

// 1. 安裝 Pinia 狀態管理
app.use(pinia);

// 2. 掛載 Vue 應用程式
app.mount('#app');

console.log('🚀 Trading Journal PRO (UI Optimized) 已啟動');
