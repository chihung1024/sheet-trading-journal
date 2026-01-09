import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

// 引入動畫樣式
import './styles/animations.css';

const app = createApp(App)
const pinia = createPinia() // 確保這行也在

// ✅ 請插入這段代碼：Vue 錯誤處理器
app.config.errorHandler = (err, instance, info) => {
  console.error('❌ [Global Error]:', err);
  console.error('ℹ️ [Error Info]:', info);
  
  // 在開發階段或無法看 Console 的環境，直接彈出視窗最保險
  // 這樣您在手機上操作遇到問題也能立刻知道原因
  alert(`⚠️ 系統發生錯誤 (Vue Error):\n${err.message || err}`);
};

// ✅ 請插入這段代碼：捕捉未被處理的 Promise 錯誤 (如 API 請求失敗且沒寫 catch)
window.addEventListener('unhandledrejection', event => {
  console.error('❌ [Unhandled Rejection]:', event.reason);
  // 這裡選擇性彈窗，避免網路不穩時一直彈
  // alert(`⚠️ 系統發生錯誤 (Async Error):\n${event.reason}`);
});

app.use(pinia) // 原有的
app.mount('#app') // 原有的
