# 📋 SaaS Trading Journal (Client)

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
- **即時儀錶板**：顯示總資產 (NAV)、未實現損益 (Unrealized P&L)、✅ **已實現損益 (Realized P&L)**、ROI、TWR (時間加權報酬率) 與 XIRR (個人年化報酬)。
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

## 📋 核心金融演算法 (Financial Engine)

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

### 3️⃣ ✅ **已實現損益追蹤 (NEW v1.2.0)**

精確追蹤所有已實現的交易損益，包括：
- **賣出收益**：FIFO 成本 vs 賣出價格
- **配息收入**：自動配息 + 手動輸入
- **實時更新**：每次計算自動累計

**計算公式：**
```python
# 賣出收益
realized_pnl += (sell_proceeds - fifo_cost)

# 配息收入
realized_pnl += dividend_income_after_tax
```

**儀錶板顯示：**
- 獨立卡片顯示已實現損益
- 綠色渚層主題設計
- 包含賣出 + 配息細項說明

### 4️⃣ 匯率影響分離 ✅

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

### 5️⃣ 市場數據管理 ✅ **OPTIMIZED**

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
     - **✅ 已實現損益追蹤** (v1.2.0)
     - **匯率影響分離** ✅
   - **Step 4**: 生成包含完整儀錶板數據的 JSON 快照。

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

### B. 資產快照表 (`portfolio_snapshots`)
系統的 "Read Model"，儲存預先計算好的儀錶板資料。

#### JSON 資料結構 ✅ **UPDATED v1.2.0**

```json
{
  "updated_at": "2026-01-13 15:00",
  "base_currency": "TWD",
  "exchange_rate": 32.52,
  "summary": {
    "total_value": 950264,
    "invested_capital": 862500,
    "total_pnl": 87764,
    "twr": 10.18,
    "xirr": 12.45,
    "realized_pnl": 12500,       // ✅ NEW: 已實現損益
    "benchmark_twr": 8.45
  },
  "holdings": [
    {
      "symbol": "NVDA",
      "qty": 1000,
      "market_value_twd": 456789,
      "pnl_twd": 56789,
      "prev_close_price": 139.8,
      "daily_change_usd": 0.7,
      "daily_pl_twd": 2345         // ✅ 當日損益
    }
  ]
}
```

***

## 🚀 部署與開發流程 (GitOps)

本專案無需本地開發環境，全程透過 GitHub 線上編輯與 Cloudflare 自動部署。

### 前端部署 (Frontend)

1. **線上編輯**
   - 在 GitHub Web Editor 修改 `src/` 下的程式碼。
2. **自動部署**
   - Commit 並 Push 到 `main` 分支。
   - Cloudflare Pages 自動偵測變更並觸發 Build。

***

## 📁 專案結構

```bash
.
├── public/                 # 靜態資源
├── src/
│   ├── components/         # Vue UI 組件
│   │   ├── StatsGrid.vue   # ✅ 儀錶板卡片 (包含已實現損益)
│   │   ├── HoldingsTable.vue
│   │   └── ...
│   ├── stores/             # Pinia 狀態管理
│   └── ...
├── journal_engine/       # ✅ Python 核心運算模組
│   ├── core/
│   │   └── calculator.py   # FIFO + TWR + XIRR + 已實現損益
│   └── models.py           # ✅ 數據模型 (包含 realized_pnl)
├── main.py                 # GitHub Actions 執行入口
└── ...
```

***

## 🆕 更新記錄

### v1.2.0 (2026-01-13) ✅ **LATEST**

**已實現損益功能：**
- ✅ **新增已實現損益卡片**：在儀錶板中顯示賣出收益 + 配息收入
- ✅ **6 欄 Grid 佈局**：調整儀錶板從 5 欄擴展為 6 欄，響應式適配各螢幕
- ✅ **綠色渚層主題**：新增 success-theme 樣式，視覺區分已/未實現損益
- ✅ **實時數據同步**：整合後端已計算的 realized_pnl 資料

**技術改進：**
- 後端 FIFO 成本追蹤已完整實現
- 前端動畫數字顯示
- 模組化代碼結構

### v1.1.0 (2026-01-12)

**前端優化：**
- ✅ **圖表優化**：投資組合歷史圖表自動排除週末數據，走勢更清晰
- ✅ **交易總額修正**：前端自動計算 `total_amount`，使用交易當天匯率轉換為台幣
- ✅ **匯率容錯機制**：自動處理週末/假日無匯率數據的情況

### v2.0.0 (2026-01-09)

**重大功能更新：**
- ✅ **匯率影響分離**：精確區分股價變化與匯率變化對投資組合的影響
- ✅ **今日損益智能計算**：美股開盤前/盤中自動切換計算邏輯
- ✅ **XIRR 計算**：新增個人年化報酬率指標

***

## 📝 授權
```bash
MIT License
```

---

**Built with ❤️ by a quantitative trader for traders.**