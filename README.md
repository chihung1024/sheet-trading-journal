# 📊 SaaS Trading Journal (Client)






這是一個現代化的投資組合追蹤與交易日誌系統，專為美股投資者設計。採用全 **Cloudflare Serverless** 架構構建，結合 **GitHub Actions** 進行複雜的資產運算，實現高效能、低成本且即時的資產管理體驗。

***

## 🏗️ 系統架構 (System Architecture)

本專案完全運行於 Cloudflare 生態系，並採用 **前後端分離** 與 **運算分離** 的設計模式：

| 層級 | 技術堆疊 | 說明 |
|------|----------|------|
| **前端 (Frontend)** | **Vue 3 + Vite** | SPA 單頁應用，部署於 **Cloudflare Pages** |
| **後端 (Backend)** | **Cloudflare Workers** | 提供 RESTful API，處理驗證與資料庫操作 |
| **資料庫 (Database)** | **Cloudflare D1** (SQLite) | 邊緣資料庫，儲存交易紀錄與資產快照 |
| **運算核心 (Compute)** | **GitHub Actions** | 定期抓取股價、計算淨值與損益 (Offload heavy tasks) |
| **身份驗證 (Auth)** | **Google OAuth 2.0** | 使用 JWT 進行無狀態身份驗證 |

***

## ✨ 功能特色

### 📱 使用者體驗
- **PWA 支援**：可安裝至桌面或手機，支援離線訪問與原生 App 般的體驗。
- **深色模式**：自動跟隨系統設定，或手動切換深色/淺色主題。
- **響應式設計**：完美適配 Desktop、Tablet 與 Mobile 裝置。

### 💹 資產管理
- **即時儀表板**：顯示總資產 (NAV)、未實現損益 (Unrealized P&L)、ROI 與 TWR (時間加權報酬率)。
- **圖表分析**：
  - **趨勢圖**：追蹤資產歷史走勢 (vs. SPY/QQQ 基準)。
  - **配置圖**：圓餅圖顯示各持倉佔比與產業分佈。
- **持倉監控**：即時計算每檔持倉的均價、現價、損益與權重。

### 📝 交易日記
- **CRUD 管理**：新增、編輯、刪除交易紀錄。
- **多種交易類型**：支援 `BUY` (買入)、`SELL` (賣出)、`DIV` (股息)。
- **稅費紀錄**：精確記錄手續費 (Fee) 與預扣稅 (Tax)，計算淨回報。

***

## 📈 數據流與運算邏輯 (Data Flow)

本系統採用 **CQRS (Command Query Responsibility Segregation)** 概念的變體，將「寫入」與「讀取」邏輯分離，確保讀取效能極大化。

### 1. 寫入流程 (Transaction Recording)
前端直接呼叫 Worker API (`POST /api/records`)，將交易紀錄寫入 D1 資料庫的 `records` 表。

### 2. 運算更新流程 (Update Pipeline)
無論是手動觸發或排程自動更新，皆透過 **GitHub Actions** 執行核心運算：

1. **觸發 (Trigger)**
   - 前端點擊 **「⚙️ 更新數據」** → 呼叫 Worker (`/api/trigger-update`)。
   - Worker 驗證權限後，發送 `repository_dispatch` 事件給 GitHub。
   
2. **運算 (GitHub Actions Runner)**
   - **Step 1**: 讀取 D1 中的原始交易紀錄 (`records`)。
   - **Step 2**: 透過外部 API (如 Yahoo Finance) 抓取最新股價與匯率。
   - **Step 3**: 執行核心金融計算（FIFO 成本、市值、未實現損益、ROI）。
   - **Step 4**: 生成包含完整儀表板數據的 JSON 快照。

3. **儲存 (Save Snapshot)**
   - Python 腳本將計算好的 JSON 回傳給 Worker。
   - Worker 將其寫入 D1 的 `portfolio_snapshots` 表。

### 3. 讀取流程 (Dashboard Rendering)
前端呼叫 Worker API (`GET /api/portfolio`)，Worker 直接回傳最新的 `portfolio_snapshots` JSON。這使得前端能達到**毫秒級**的載入速度，無需等待即時運算。

***

## 🗄️ 資料庫設計 (Cloudflare D1)

資料庫名稱：`journal-db`，包含兩個核心資料表。

### A. 交易紀錄表 (`records`)
系統的 "Source of Truth"，儲存每一筆原始交易。

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | INTEGER | 主鍵 (Auto Increment) |
| `user_id` | TEXT | 使用者 Email (User ID) |
| `txn_date` | TEXT | 交易日期 (YYYY-MM-DD) |
| `symbol` | TEXT | 股票代號 (如 NVDA) |
| `txn_type` | TEXT | `BUY`, `SELL`, `DIV` |
| `qty` | REAL | 股數 |
| `price` | REAL | 成交單價 (USD) |
| `fee` | REAL | 手續費 |
| `tax` | REAL | 稅金 (預扣稅) |
| `tag` | TEXT | 策略標籤 |
| `note` | TEXT | 筆記 |

### B. 資產快照表 (`portfolio_snapshots`)
系統的 "Read Model"，儲存預先計算好的儀表板資料。

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | INTEGER | 主鍵 |
| `user_id` | TEXT | 擁有者 Email |
| `json_data` | TEXT | **完整資產 JSON** (含 Summary, Holdings, History) |
| `updated_at` | TEXT | 計算完成時間 |

***

## 🛠️ Worker API 介面

Worker (`worker.js`) 作為 API Gateway，負責路由與安全性。

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| `POST` | `/auth/google` | 驗證 Google ID Token | Public |
| `POST` | `/api/trigger-update` | 觸發 GitHub Actions 更新 | User |
| `GET` | `/api/portfolio` | 讀取最新資產快照 | User |
| `POST` | `/api/portfolio` | 上傳計算好的快照 | Admin (API Key) |
| `GET` | `/api/records` | 獲取交易紀錄列表 | User |
| `POST` | `/api/records` | 新增交易紀錄 | User |
| `PUT` | `/api/records` | 更新交易紀錄 | User |
| `DELETE` | `/api/records` | 刪除交易紀錄 | User |

***

## 🚀 部署與開發流程 (GitOps)

本專案無需本地開發環境，全程透過 GitHub 線上編輯與 Cloudflare 自動部署。

1. **線上編輯**
   - 在 GitHub Web Editor 修改 `src/` 下的程式碼。
2. **自動部署**
   - Commit 並 Push 到 `main` 分支。
   - Cloudflare Pages 自動偵測變更並觸發 Build。
3. **環境變數設定**
   - 於 Cloudflare Pages 後台設定以下變數：

| 變數名稱 | 說明 |
|---------|------|
| `VITE_API_URL` | Cloudflare Worker 的 API 地址 |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `NODE_VERSION` | 建議設定為 `18.x` |

***

## 📁 專案結構

```bash
.
├── public/                 # 靜態資源 (Manifest, Icons)
│   ├── manifest.json       # PWA 設定檔
│   └── service-worker.js   # PWA 緩存邏輯
├── src/
│   ├── components/         # Vue UI 組件
│   │   ├── TradeForm.vue   # 交易表單 (核心)
│   │   ├── StatsGrid.vue   # 儀表板卡片
│   │   └── ...
│   ├── stores/             # Pinia 狀態管理
│   │   ├── auth.js         # 身份驗證邏輯
│   │   └── portfolio.js    # 資產數據管理
│   ├── composables/        # 共用邏輯 (Hooks)
│   │   ├── useDarkMode.js  # 深色模式控制
│   │   └── ...
│   ├── styles/             # 全域樣式與動畫
│   ├── App.vue             # 根組件
│   ├── config.js           # 應用設定
│   └── main.js             # 進入點
├── index.html              # HTML 模板
├── package.json            # 依賴管理
└── vite.config.js          # Vite 建置設定
```

***

## 📄 授權

MIT License
```
