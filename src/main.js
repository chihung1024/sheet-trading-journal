/**
 * main.js - Application Entry Point
 * Commercial Grade Configuration (v1.0.0)
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

// Global Styles
import './styles/animations.css';

// Composables for Global Services
import { useToast } from './composables/useToast';

// Initialize Core
const app = createApp(App);
const pinia = createPinia();

// ----------------------------------------------------------------
// 1. Error Handling Strategy (Non-intrusive)
// ----------------------------------------------------------------
const { addToast } = useToast();

app.config.errorHandler = (err, instance, info) => {
  console.error('🔥 [Vue Error]:', err);
  console.error('ℹ️ [Info]:', info);
  
  // 在生產環境中，可以整合 Sentry 或 LogRocket
  // 這裡我們使用 Toast 提示用戶，而不是阻斷操作
  const msg = err.message || 'Unknown error occurred';
  if (!msg.includes('ResizeObserver')) { // Ignore common benign ResizeObserver loops
    addToast(`System Error: ${msg}`, 'error');
  }
};

window.addEventListener('unhandledrejection', (event) => {
  // 忽略使用者主動取消的請求
  if (event.reason?.name === 'AbortError') return;
  
  console.warn('⚠️ [Async Error]:', event.reason);
  
  // 針對 API 連線問題給予明確提示
  if (event.reason?.message?.includes('API') || event.reason?.message?.includes('Network')) {
    addToast('Network connection unstable', 'warning');
  }
});

// ----------------------------------------------------------------
// 2. Third-Party Scripts Injection
// ----------------------------------------------------------------
const loadGoogleIdentity = () => {
  const scriptId = 'google-jssdk';
  if (document.getElementById(scriptId)) return;
  
  const script = document.createElement('script');
  script.id = scriptId;
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => console.log('✅ Google Identity Services loaded');
  script.onerror = () => console.error('❌ Failed to load Google Identity Services');
  document.head.appendChild(script);
};

// Start loading immediately
loadGoogleIdentity();

// ----------------------------------------------------------------
// 3. Mount Application
// ----------------------------------------------------------------
app.use(pinia);
app.mount('#app');

// 4. Console Signature
console.log(
  '%c TRADING JOURNAL %c PRO v1.0 ',
  'background:#0f172a; padding: 1px; border-radius: 3px 0 0 3px; color: #fff',
  'background:#3b82f6; padding: 1px; border-radius: 0 3px 3px 0; color: #fff'
);
