/**
 * main.js: 前端應用程式全域入口點 (v20260119 穩定版)
 * 修改：正式整合錯誤捕捉機制，確保系統發生異常時不會默默失敗
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

// 引入全域動畫與基礎樣式
import './styles/animations.css';

const app = createApp(App);
const pinia = createPinia();

/**
 * ✅ 全域 Vue 錯誤處理器
 * 捕捉組件渲染、生命週期鉤子與事件處理器中的錯誤
 */
app.config.errorHandler = (err, instance, info) => {
  console.error('❌ [Global Vue Error]:', err);
  console.error('ℹ️ [Error Info]:', info);
  
  // 在行動裝置 PWA 環境下，這能讓使用者第一時間知道系統崩潰原因
  // 避免出現「 ghost data」時無從查起
  const errorMessage = err.message || err;
  alert(`⚠️ 系統發生異常，請嘗試重新整理頁面。\n\n錯誤詳情: ${errorMessage}`);
};

/**
 * ✅ 捕捉未被處理的 Promise 拒絕 (Unhandled Promise Rejection)
 * 專門用於監控 API 請求或 Store 中的非同步邏輯失敗
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [Async Error]:', event.reason);
  
  // 如果是嚴重的認證錯誤或數據衝突，可以在此提示
  // 注意：這裡不強制彈窗 (alert)，以免在網路不穩時干擾使用者
  if (event.reason && event.reason.message && event.reason.message.includes('API Error')) {
    console.warn('📡 偵測到 API 連線異常');
  }
});

// 1. 安裝 Pinia 狀態管理
app.use(pinia);

// 2. 掛載 Vue 應用程式
// 確保所有攔截器與錯誤處理器都已就緒
app.mount('#app');

console.log('🚀 Trading Journal PRO 已完成全域掛載 [v20260119]');
