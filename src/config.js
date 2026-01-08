// 警告：使用 tag 1.10 中的實數 Google Client ID
// 這個 ID 在產業環境中已驗證可用

export const CONFIG = {
  // API 基础 URL - Cloudflare Workers 後端
  API_BASE_URL: 'https://journal-backend.chired.workers.dev',
  
  // Google OAuth Client ID
  // tag 1.10 版本的實數值
  GOOGLE_CLIENT_ID: '951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com'
};

// 調試信息
if (typeof window !== 'undefined') {
  console.log('📋 應用配置已載入');
  console.log('  ✅ API URL:', CONFIG.API_BASE_URL);
  console.log('  ✅ Google Client ID:', CONFIG.GOOGLE_CLIENT_ID.substring(0, 20) + '...');
}
