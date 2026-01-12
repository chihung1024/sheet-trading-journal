# 📊 SaaS Trading Journal (Client)

這是一個現代化的投資組合追蹤與交易日誌系統，專為美股投資者設計。採用全 **Cloudflare Serverless** 架構構建，結合 **GitHub Actions** 進行複雜的資產運算，實現高效能、低成本且即時的資產管理體驗。

***

## 🏭 系統架構 (System Architecture)

本專案完全運行於 Cloudflare 生態系，並採用 **前後端分離** 與 **運算分離** 的設計模式：

| 層級 | 技術堆疊 | 說明 |
|------|----------|------|
| **前端 (Frontend)** | **Vue 3 + Vite** | SPA 單頁應用，部署於 **Cloudflare Pages** |
| **後端 (Backend)** | **Cloudflare Workers** | 提供 RESTful API，處理驗證與資料庫操作 |
| **資料庫 (Database)** | **Cloudflare D1** (SQLite) | 邊緣資料庫，儲存交易紀錄與資產快照 |
| **運算核心 (Compute)** | **GitHub Actions + Python** | 定期抓取股價、計算淨值與損益 (Offload heavy tasks) |
| **身份驗證 (Auth)** | **Google OAuth 2.0** | 使用 JWT 進行無狀態身份驗證 |

***

## ✨ 功能特色

### 📱 使用者體驗
- **PWA 支援**：可安裝至桌面或手機，支援離線訪問與原生 App 般的體驗。
- **深色模式**：自動跟隨系統設定，或手動切換深色/淺色主題。
- **響應式設計**：完美適配 Desktop、Tablet 與 Mobile 裝置。

### 📈 資產管理
- **即時儀表板**：顯示總資產 (NAV)、未實現損益 (Unrealized P&L)、ROI 與 TWR (時間加權報酬率)。
- **圖表分析**：
  - **趋勢圖**：追蹤資產歷史走勢 (vs. SPY 基準)，自動排除週末數據。
  - **配置圖**：圓餅圖顯示各持倉佔比與產業分佈。
- **持倉監控**：即時計算每檔持倉的均價、現價、損益與權重。
- **✅ 今日損益智能計算**：
  - **美股開盤前**：顯示昨日美股變化 + 匯率影響
  - **美股盤中**：即時顯示當日盤中變化
  - **精準分離股價與匯率因素**

### 📋 交易日記
- **CRUD 管理**：新增、編輯、刪除交易紀錄。
- **多種交易類型**：支援 `BUY` (買入)、`SELL` (賣出)、`DIV` (股息)。
- **稅費紀錄**：精確記錄手續費 (Fee) 與預扣稅 (Tax)，計算淨回報。
- **✅ 台幣總額正確顯示**：使用交易當天匯率轉換，反映真實交易價值。

***

## 📊 核心金融算法 (Financial Engine)

### 1️⃣ FIFO 成本計算
採用 **先進先出 (First-In-First-Out)** 原則，精確追蹤每筆交易的成本基礎。

**特色：**
- 自動處理拆股調整（如 NVDA 10:1 拆股）
- 配息再投資效果自動納入 Adj Close 價格體系
- 支援多批次買入/賣出，自動計算均價

### 2️⃣ 時間加權報酬率 (TWR)
使用 **Modified Dietz 方法**，消除資金流入/流出對報酬率的影響。

**公式：**
```
Daily Return = (當日損益變動) / (昨日權益 + 當日資金流入)
Cumulative TWR = ∏ (1 + Daily Return) - 1
```

**優點：**
- 不受入金/出金時點影響
- 可與 SPY 基準直接比較
- 適合評估投資策略效能

### 3️⃣ 匯率影響分離 ✅ **NEW**

精準區分「股價變化」與「匯率變化」對投資組合的影響。

**計算邏輯：**

#### **美股開盤前 (05:00-21:30 台灣時間)**
```python
今日損益 = 
  # 1. 昨日股價變化（用昨日匯率）
  Σ [(P_昨日 - P_前日) × qty × FX_昨日]
  
  # 2. 今日匯率影響（用昨日收盤價）
  + Σ [P_昨日 × qty × (FX_今日 - FX_昨日)]
```

#### **美股盤中 (21:30-05:00 台灣時間)**
```python
今日損益 = 當前市值 - 開盤前市值
# 自動包含：
# - 當日股價變化（盤中價 vs 收盤價）
# - 當日匯率影響（已體現在當前市值中）
```

**實際範例：**
- GS: (-6.19 USD) × 15股 × 32.4567 = -3,014 TWD (昨日股價)
- GS: 934.83 USD × 15股 × 0.0667 = +935 TWD (今日匯率)
- **總計 = -2,079 TWD**

### 4️⃣ 市場數據管理 ✅ **OPTIMIZED**

**下載範圍：【最早交易日 - 100 天】至今**

```python
# main.py
start_date = df['Date'].min()  # 最早交易日
fetch_start_date = start_date - timedelta(days=100)  # 往前推 100 天

market_client.download_data(unique_tickers, fetch_start_date)
```

**100 天緩衝的作用：**
- ✅ 捕捉買入日之前的拆股/配息事件
- ✅ 應對長假期與市場休市
- ✅ 確保有足夠的歷史數據計算調整因子
- ✅ 涵蓋季度配息週期

**終端輸出範例：**
```bash
[數據下載] 最早交易日: 2024-09-20
[數據下載] 抓取起始日: 2024-06-12 (往前推 100 天)
[數據下載] 抓取標的: ['NVDA', 'QQQI', 'GS', '0050.TW']

[匯率比對] 顯示最新兩個交易日匯率
[USD/TWD] 最新匯率: 32.5234 (2026-01-09) | 前匯率: 32.4567 (2026-01-08)
[USD/TWD] 匯率變化: +0.0667 (+0.21%)
[匯率影響] 美元資產 $29,123 × +0.0667 = 台幣 +1,943
```

***

## 📢 數據流與運算邏輯 (Data Flow)

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
   - **Step 2**: 透過 Yahoo Finance API 抓取最新股價與匯率（**持股週期 + 100 天**）。
   - **Step 3**: 執行核心金融計算：
     - FIFO 成本基礎追蹤
     - 拆股/配息自動調整
     - 市值與未實現損益計算
     - TWR (時間加權報酬率) 計算
     - **匯率影響分離** ✅
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

#### 表結構 (Schema)
```sql
CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,              -- 使用者 Email
  txn_date TEXT NOT NULL,              -- 交易日期 (YYYY-MM-DD)
  symbol TEXT NOT NULL,                -- 股票代號
  txn_type TEXT NOT NULL,              -- BUY / SELL / DIV
  qty REAL NOT NULL,                   -- 股數
  price REAL NOT NULL,                 -- 成交單價 (USD)
  fee REAL DEFAULT 0,                  -- 手續費 (USD)
  tax REAL DEFAULT 0,                  -- 稅金 / 預扣稅 (USD)
  tag TEXT DEFAULT 'Stock',            -- 策略標籤
  note TEXT DEFAULT '',                -- 筆記
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_records_user_date ON records(user_id, txn_date DESC);
CREATE INDEX idx_records_symbol ON records(symbol);
```

#### 欄位說明

| 欄位 | 類型 | 說明 | 範例 |
|------|------|------|------|
| `id` | INTEGER | 主鍵 (Auto Increment) | 1, 2, 3... |
| `user_id` | TEXT | 使用者 Email (User ID) | `user@example.com` |
| `txn_date` | TEXT | 交易日期 | `2026-01-05` |
| `symbol` | TEXT | 股票代號 | `NVDA`, `GS`, `0050.TW` |
| `txn_type` | TEXT | 交易類型 | `BUY`, `SELL`, `DIV` |
| `qty` | REAL | 股數 | 2.16, 100.5 |
| `price` | REAL | 成交單價 (USD) | 914.9753 |
| `fee` | REAL | 手續費 (USD) | 1.00 |
| `tax` | REAL | 稅金 / 預扣稅 (USD) | 3.50 |
| `tag` | TEXT | 策略標籤 | `AI Datacenter`, `Stock` |
| `note` | TEXT | 筆記 | 任意文字 |
| `created_at` | DATETIME | 建立時間 | 自動生成 |
| `updated_at` | DATETIME | 更新時間 | 自動更新 |

### B. 資產快照表 (`portfolio_snapshots`)
系統的 "Read Model"，儲存預先計算好的儀表板資料。

#### 表結構 (Schema)
```sql
CREATE TABLE portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,              -- 擁有者 Email
  json_data TEXT NOT NULL,            -- 完整資產 JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_snapshots_user ON portfolio_snapshots(user_id, id DESC);
```

#### 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | INTEGER | 主鍵 |
| `user_id` | TEXT | 擁有者 Email |
| `json_data` | TEXT | **完整資產 JSON** (含 Summary, Holdings, History) |
| `created_at` | DATETIME | 計算完成時間 |

#### JSON 資料結構 ✅ **UPDATED**

```json
{
  "updated_at": "2026-01-09 15:00",
  "base_currency": "TWD",
  "exchange_rate": 32.52,
  "summary": {
    "total_value": 950264,
    "invested_capital": 862500,
    "total_pnl": 87764,
    "twr": 10.18,
    "realized_pnl": 12500,
    "benchmark_twr": 8.45
  },
  "holdings": [
    {
      "symbol": "NVDA",
      "tag": "AI Datacenter",
      "currency": "USD",
      "qty": 1000,
      "market_value_twd": 456789,
      "pnl_twd": 56789,
      "pnl_percent": 14.2,
      "current_price_origin": 140.5,
      "avg_cost_usd": 123.4,
      "prev_close_price": 139.8,        // ✅ NEW: 前一交易日收盤價
      "daily_change_usd": 0.7,          // ✅ NEW: 今日價格變化
      "daily_change_percent": 0.5        // ✅ NEW: 今日變化百分比
    }
  ],
  "history": [
    {
      "date": "2026-01-09",
      "total_value": 950264,
      "invested": 862500,
      "net_profit": 87764,
      "twr": 10.18,
      "benchmark_twr": 8.45,
      "fx_rate": 32.5234              // ✅ NEW: 當日匯率
    }
  ]
}
```

***

## 🛠️ Worker API 介面

Worker (`worker.js`) 作為 API Gateway，負責路由與安全性。

### API 路由表

| 方法 | 路徑 | 說明 | 權限 | Request Body |
|------|------|------|------|-------------|
| `POST` | `/auth/google` | 驗證 Google ID Token | Public | `{ "id_token": "..." }` |
| `POST` | `/api/trigger-update` | 觸發 GitHub Actions 更新 | User / Admin | - |
| `GET` | `/api/portfolio` | 讀取最新資產快照 | User | - |
| `POST` | `/api/portfolio` | 上傳計算好的快照 | Admin (API Key) | `{ ...portfolio_json }` |
| `GET` | `/api/records` | 獲取交易紀錄列表 | User | - |
| `POST` | `/api/records` | 新增交易紀錄 | User | `{ txn_date, symbol, txn_type, qty, price, fee, tax, tag, note }` |
| `PUT` | `/api/records` | 更新交易紀錄 | User | `{ id, txn_date, symbol, ... }` |
| `DELETE` | `/api/records` | 刪除交易紀錄 | User | `{ "id": 123 }` |

### 身份驗證機制

Worker 支援兩種驗證方式：

#### 1️⃣ Google OAuth (Web 前端)
```javascript
// 前端發送 JWT Token
fetch('/api/records', {
  headers: {
    'Authorization': 'Bearer <GOOGLE_ID_TOKEN>'
  }
})
```

**驗證流程：**
1. Worker 解析 `Authorization` header
2. 使用 Web Crypto API 驗證 Google JWT signature
3. 檢查 `aud` (客戶端 ID) 與 `exp` (過期時間)
4. 返回 user object: `{ email, name, role: 'user' }`

#### 2️⃣ API Key (Python Admin)
```python
# Python 腳本使用 API Key
headers = {
    'X-API-KEY': env.API_SECRET
}
requests.post('/api/portfolio', headers=headers, json=data)
```

**驗證流程：**
1. Worker 檢查 `X-API-KEY` header
2. 與環境變數 `API_SECRET` 比對
3. 匹配成功返回: `{ email: 'system', role: 'admin' }`

### CORS 處理

Worker 自動處理 CORS 預檢請求：

```javascript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-KEY",
};

// OPTIONS 請求直接返回 200
if (request.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}
```

### 錯誤處理

所有 API 統一返回 JSON 格式：

**成功回應：**
```json
{
  "success": true,
  "data": { ... }
}
```

**錯誤回應：**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**HTTP 狀態碼：**
- `200` - 成功
- `401` - 未授權
- `404` - 路徑不存在
- `405` - 方法不允許
- `500` - 伺服器錯誤

***

## 🚀 部署與開發流程 (GitOps)

本專案無需本地開發環境，全程透過 GitHub 線上編輯與 Cloudflare 自動部署。

### 前端部署 (Frontend)

1. **線上編輯**
   - 在 GitHub Web Editor 修改 `src/` 下的程式碼。
2. **自動部署**
   - Commit 並 Push 到 `main` 分支。
   - Cloudflare Pages 自動偵測變更並觸發 Build。
3. **環境變數設定**
   - 於 Cloudflare Pages 後台設定以下變數：

| 變數名稱 | 說明 |
|---------|----- |
| `VITE_API_URL` | Cloudflare Worker 的 API 地址 |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `NODE_VERSION` | 建議設定為 `18.x` |

### 後端部署 (Worker)

1. **Worker 部署**
   - 直接在 Cloudflare Dashboard 中編輯 `worker.js`
   - 或使用 Wrangler CLI：`wrangler deploy`

2. **D1 資料庫繫定**
   ```bash
   # 創建 D1 資料庫
   wrangler d1 create journal-db
   
   # 繫定至 Worker
   # 在 wrangler.toml 中增加：
   [[d1_databases]]
   binding = "DB"
   database_name = "journal-db"
   database_id = "<YOUR_DATABASE_ID>"
   ```

3. **環境變數設定**
   - 於 Cloudflare Worker 設定：

| 變數名稱 | 說明 |
|---------|----- |
| `API_SECRET` | Python Admin 使用的 API Key |
| `GITHUB_TOKEN` | GitHub Personal Access Token (觸發 Actions) |
| `GITHUB_OWNER` | GitHub 帳號名 |
| `GITHUB_REPO` | Repository 名稱 |

### GitHub Actions 設定

1. **Secrets 設定**
   - 在 GitHub Repository Settings > Secrets and variables > Actions 中增加：

| Secret 名稱 | 說明 |
|------------|------|
| `API_URL` | Worker API 地址 |
| `API_SECRET` | 與 Worker 中的 `API_SECRET` 相同 |

2. **Workflow 檔案**
   - `.github/workflows/update.yml` 已預先設定好
   - 支援手動觸發 (`workflow_dispatch`) 與 API 觸發 (`repository_dispatch`)

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
│   │   ├── StatsGrid.vue   # 儀表板卡片 (✅ 今日損益智能計算)
│   │   ├── RecordList.vue  # 交易紀錄列表 (✅ 台幣總額正確顯示)
│   │   ├── PortfolioHistory.vue  # 歷史走勢圖 (✅ 排除週末)
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
├── journal_engine/       # ✅ Python 核心運算模組
│   ├── clients/
│   │   ├── api_client.py   # Cloudflare D1 API 操作
│   │   └── market_data.py  # 市場數據抓取 (✅ 100天緩衝)
│   ├── core/
│   │   └── calculator.py   # FIFO + TWR + 匯率分離 ✅
│   ├── models.py           # 數據模型 (✅ 新增欄位)
│   └── config.py           # 設定檔
├── main.py                 # ✅ GitHub Actions 執行入口
├── worker.js               # ✅ Cloudflare Worker API Gateway
├── index.html              # HTML 模板
├── package.json            # 依賴管理
├── requirements.txt        # Python 依賴
└── vite.config.js          # Vite 建置設定
```

***

## 🆕 更新記錄

### v1.1.0 (2026-01-12) ✅ **LATEST**

**前端優化：**
- ✅ **圖表優化**：投資組合歷史圖表自動排除週末數據，走勢更清晰
- ✅ **交易總額修正**：前端自動計算 `total_amount`，使用交易當天匯率轉換為台幣
- ✅ **匯率容錯機制**：自動處理週末/假日無匯率數據的情況

**技術改進：**
- 減少約 28.5% 的圖表渲染數據量
- 前端計算公式：`total_amount_twd = |qty × price| × fx_rate + fee + tax`

### v2.0.0 (2026-01-09)

**重大功能更新：**
- ✅ **匯率影響分離**：精確區分股價變化與匯率變化對投資組合的影響
- ✅ **今日損益智能計算**：美股開盤前/盤中自動切換計算邏輯
- ✅ **持倉數據增強**：新增 `prev_close_price`, `daily_change_usd`, `daily_change_percent`
- ✅ **History 數據增強**：每日快照中新增 `fx_rate` 欄位
- ✅ **市場數據優化**：改為抓取【最早交易日 - 100 天】至今
- ✅ **匯率日誌輸出**：終端顯示最新兩筆匯率比對與影響

**技術改進：**
- 模組化程式碼結構 (`journal_engine/`)
- 提升計算穩定性與可維護性
- 詳細的程式碼註釋與日誌輸出

***

## 📝 授權
```bash
MIT License
```

---

**Built with ❤️ by a quantitative trader for traders.**