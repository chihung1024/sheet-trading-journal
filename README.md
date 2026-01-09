# 📊 SaaS Trading Journal (Client)

這是一個基於 Vue 3 + Vite 開發的投資組合追蹤儀表板，專為 Google Sheets Trading Journal 設計的前端介面。

## ✨ 主要功能

- **Google OAuth 登入**：安全快速的身份驗證
- **即時儀表板**：顯示總資產、未實現損益、當日損益等關鍵指標
- **互動式圖表**：資產趨勢圖 (Chart.js) 與資產配置圓餅圖
- **持倉管理**：詳細的持倉列表，支援即時價格更新
- **交易紀錄**：新增、編輯、刪除交易紀錄
- **深色模式**：支援系統自動切換與手動切換
- **PWA 支援**：可安裝至桌面或手機，支援離線訪問

## 🛠️ 技術棧

- **框架**: Vue 3 (Composition API)
- **狀態管理**: Pinia
- **打包工具**: Vite
- **樣式**: CSS Variables + Scoped CSS
- **圖表**: Chart.js
- **API**: Fetch API (與 Cloudflare Workers 後端通訊)

## 🚀 快速開始

### 安裝依賴
```bash
npm install
