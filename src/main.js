/**
 * main.js: 前端應用程式全域入口點 (v20260119 穩定版)
 * 修改：註冊 ApexCharts 組件並強化錯誤邊界控制
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

// 引入 ApexCharts 及其 Vue 3 適配插件
import VueApexCharts from "vue3-apexcharts";

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
  
  // 避免在開發環境頻繁彈窗，生產環境下提示使用者
  if (import.meta.env.PROD) {
    const errorMessage = err.message || err;
    console.warn('⚠️ 系統發生異常，請嘗試重新整理頁面。');
  }
};

/**
 * ✅ 捕捉未被處理的 Promise 拒絕 (Unhandled Promise Rejection)
 * 專門用於監控 API 請求或 Store 中的非同步邏輯失敗
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [Async Error]:', event.reason);
});

// 1. 安裝 Pinia 狀態管理
app.use(pinia);

// 2. 註冊 ApexCharts 全域組件 (讓 PerformanceChart.vue 可以直接使用 <apexchart>)
app.use(VueApexCharts);

// 3. 掛載 Vue 應用程式
app.mount('#app');

console.log('🚀 Trading Journal PRO 已完成全域掛載 [v20260119]');
