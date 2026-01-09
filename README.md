# 📊 SaaS Trading Journal (Client)

這是一個現代化的投資組合追蹤與交易日誌系統，採用全 Cloudflare Serverless 架構構建，提供高效能、低延遲的資產管理體驗。

## 🏗️ 架構概覽

本專案採用 **Cloudflare 全家桶** 技術堆疊：
- **前端 (Frontend)**: Vue 3 + Vite，部署於 **Cloudflare Pages**
- **後端 (Backend)**: **Cloudflare Workers** (提供 RESTful API)
- **資料庫 (Database)**: **Cloudflare D1** (SQLite at the Edge)
- **身份驗證**: Google OAuth 2.0 (JWT)

## ✨ 主要功能

- **Google OAuth 登入**：安全快速的身份驗證
- **即時儀表板**：顯示總資產、未實現損益、當日損益等關鍵指標
- **互動式圖表**：資產趨勢圖 (Chart.js) 與資產配置圓餅圖
- **持倉管理**：詳細的持倉列表，支援即時價格更新
- **交易紀錄**：新增、編輯、刪除交易紀錄（直接寫入 D1 資料庫）
- **深色模式**：支援系統自動切換與手動切換
- **PWA 支援**：可安裝至桌面或手機，支援離線訪問

## 🛠️ 技術棧詳情

- **框架**: Vue 3 (Composition API)
- **狀態管理**: Pinia
- **打包工具**: Vite
- **樣式**: CSS Variables + Scoped CSS
- **圖表**: Chart.js
- **部署平台**: Cloudflare Pages

## 🚀 快速開始

### 1. 安裝依賴
```bash
npm install
