/**
 * config.js: 應用程式全域配置文件 (v20260119 穩定版)
 * 修改：加入版本控管與環境變數防禦邏輯
 */

export const CONFIG = {
    // 應用程式版本：需與 service-worker.js 保持同步
    APP_VERSION: "v20260119",

    // [API 設定]: 優先讀取環境變數 VITE_API_URL
    // 預設指向您的 Cloudflare Worker 網址
    API_BASE_URL: import.meta.env.VITE_API_URL || "https://journal-backend.chired.workers.dev",
    
    // [Google 認證]: 優先讀取環境變數 VITE_GOOGLE_CLIENT_ID
    // 這是您的 Google Cloud Project 憑證 ID
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com"
};

/**
 * ✅ 配置驗證與日誌輸出
 * 僅在非生產環境或手動開啟偵錯時顯示，幫助確認部署後的 API 指向
 */
if (typeof window !== 'undefined') {
    // 確保版本資訊可以被全域讀取 (用於日誌追蹤)
    window.__APP_VERSION__ = CONFIG.APP_VERSION;

    if (import.meta.env.DEV) {
        console.group('%c📋 應用程式配置摘要', 'color: #3b82f6; font-weight: bold;');
        console.log('✅ 版本號:', CONFIG.APP_VERSION);
        console.log('✅ API 網址:', CONFIG.API_BASE_URL);
        console.log('✅ Google ID:', CONFIG.GOOGLE_CLIENT_ID ? '已設定' : '❌ 未設定');
        console.groupEnd();
    }
}

/**
 * 💡 提示：
 * 部署至 Cloudflare Pages 時，請在 Pages Dashboard 的 
 * Settings -> Environment Variables 處新增：
 * VITE_API_URL = https://你的worker域名
 * VITE_GOOGLE_CLIENT_ID = 你的Google憑證ID
 */
