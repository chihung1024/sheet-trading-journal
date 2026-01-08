// ⚠️ 重要：請使用 tag 1.10 中的 Google Client ID
// 或使用環境變數覆蓋

export const CONFIG = {
  // API 基礎 URL - 根據環境選擇
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://journal-backend.chihired.workers.dev',
  
  // Google OAuth Client ID
  // 可以通過環境變數 VITE_GOOGLE_CLIENT_ID 覆蓋
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '951186116587-8ehcmkvlu3ivduc7kjntjpp9ga781ei1.apps.googleusercontent.com'
};

console.log('📋 應用配置:');
console.log('  - API:', CONFIG.API_BASE_URL);
console.log('  - Google Client ID:', CONFIG.GOOGLE_CLIENT_ID ? '✅ 已設定' : '❌ 未設定');
