/**
 * src/config.js
 * 全域設定檔
 * 集中管理環境變數與應用程式常數
 */

const isDev = import.meta.env.DEV;

export const CONFIG = {
  // --- Backend API ---
  // 優先使用環境變數 VITE_API_BASE_URL
  // 若無設定，開發環境預設 localhost，生產環境預設為您的 Cloudflare Worker
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || (
    isDev 
      ? 'https://journal-backend.chired.workers.dev' // 開發時也可直接連線上 Worker，或改為 localhost:8787
      : 'https://journal-backend.chired.workers.dev'
  ),

  // --- Authentication ---
  // Google OAuth Client ID
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com',

  // --- App Info ---
  APP_VERSION: 'v2.40',
  BUILD_DATE: new Date().toISOString().split('T')[0],

  // --- Features Flags (可選) ---
  ENABLE_PWA_DEBUG: false,
  ENABLE_MOCK_DATA: false,
};

/**
 * 檢查是否為生產環境
 */
export const isProduction = () => !isDev;

/**
 * 取得完整的 API 路徑
 * @param {string} path - API 路徑 (e.g., '/api/records')
 * @returns {string} 完整 URL
 */
export const getApiUrl = (path) => {
  const base = CONFIG.API_BASE_URL.replace(/\/$/, ''); // 移除結尾斜線
  const endpoint = path.replace(/^\//, ''); // 移除開頭斜線
  return `${base}/${endpoint}`;
};
