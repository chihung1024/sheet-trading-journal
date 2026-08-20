export const CONFIG = {
    // [修正]: 優先讀取環境變數 VITE_API_URL
    API_BASE_URL: import.meta.env.VITE_API_URL || "https://journal-backend.chired.workers.dev",
    
    // [修正]: 優先讀取環境變數 VITE_GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com"
};

// 調試信息 (開發模式下顯示)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
}
