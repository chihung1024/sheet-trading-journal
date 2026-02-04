# 📋 SaaS Trading Journal PRO

<div align="center">

![Version](https://img.shields.io/badge/version-2.55.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-green.svg)
![Vue](https://img.shields.io/badge/vue-3.4+-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)
![Cloudflare](https://img.shields.io/badge/cloudflare-workers-f38020.svg)

**現代化的投資組合追蹤與交易日誌系統**

專為美股 / 台股 / 韓股投資者設計，採用全 Serverless 架構  
高效能 | 低成本 | 即時數據 | PWA 支援 | 策略群組 | 多使用者隔離（Multi-user）

[🌐 Live Demo](https://sheet-trading-journal.pages.dev/) | [📖 部署文件](https://github.com/chihung1024/sheet-trading-journal/blob/main/DEPLOYMENT_FINAL.md) | [🐛 Issues](https://github.com/chihung1024/sheet-trading-journal/issues)

</div>

---

## 📑 目錄

- [專案簡介](#-專案簡介)
- [核心功能](#-核心功能)
- [系統架構](#-系統架構)
- [資料模型（D1 Schema）](#-資料模型d1-schema)
- [API 速查表（Worker.js）](#-api-速查表workerjs)
- [績效計算重點](#-績效計算重點)
- [Repo 結構](#-repo-結構)
- [部署與開發](#-部署與開發)
- [安全性與權限](#-安全性與權限)
- [限制與假設](#-限制與假設)

---

## 🧭 專案簡介

SaaS Trading Journal PRO 是一套以 **Cloudflare Pages + Cloudflare Workers + D1 + GitHub Actions** 為核心的投資組合管理平台，提供交易紀錄、績效追蹤、配息管理與多策略群組管理。

核心特點：
- **多使用者隔離**：每位使用者資料獨立存放。
- **Serverless 架構**：低成本、高可用、易擴充。
- **日切分 TWR / XIRR**：偏向專業級的績效衡量。
- **自訂 Benchmark**：支援用戶自訂基準指數。

---

## ✨ 核心功能

### 🏠 總覽儀表板
- 總資產、已實現/未實現損益、ROI、TWR、XIRR、勝率。
- 績效曲線圖：Portfolio vs Benchmark，支援多時間軸。

### 📈 圖表頁
- 放大版績效圖表
- 多群組切換
- Tooltip、縮放、標註

### 💼 持倉明細
- 持倉數量、平均成本、市值、未實現損益、權重
- 即時市價更新（盤中/收盤價）

### 🧾 交易紀錄
- CRUD 管理交易
- 日期、標的、BUY/SELL/DIV、費用/稅費、策略標籤
- 搜尋與篩選

### 💰 配息管理
- Pending / Confirmed 股息
- 一鍵新增 DIV 交易確認
- 預扣稅率與配息總額

### 🏷️ 群組管理
- 群組績效隔離
- 群組成立日與累積表現

### 🌓 深色模式 & PWA
- 深/淺色模式切換
- 支援離線快取與安裝

---

## 🏭 系統架構

- **前端（SPA）**
  - Vue 3 + Vite
  - Cloudflare Pages 部署

- **後端（API / Trigger）**
  - Cloudflare Worker（`worker.js`）
  - 負責：登入驗證、交易 CRUD、快照管理、觸發 GitHub Actions

- **批次運算（Portfolio Engine）**
  - GitHub Actions 定期執行
  - 入口：`main.py`
  - 計算引擎：`journal_engine/`

- **資料儲存（D1 / SQLite）**
  - 交易、快照、使用者設定

---

## 🗂️ 資料模型（D1 Schema）

> 以下為目前 D1 資料表結構（以 Cloudflare D1 Studio 為準）。

### `records`
| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| id | INTEGER | 主鍵 |
| user_id | TEXT | 使用者 Email |
| txn_date | TEXT | 交易日期（YYYY-MM-DD） |
| symbol | TEXT | 股票代碼 |
| txn_type | TEXT | BUY / SELL / DIV |
| qty | REAL | 數量 |
| price | REAL | 成交價 |
| fee | REAL | 手續費 |
| tax | REAL | 稅費 |
| tag | TEXT | 策略標籤 |
| note | TEXT | 備註 |
| created_at | TEXT | 建立時間 |

### `portfolio_snapshots`
| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| id | INTEGER | 主鍵 |
| user_id | TEXT | 使用者 Email |
| json_data | TEXT | Portfolio Snapshot（JSON） |
| updated_at | TEXT | 更新時間 |

### `user_settings`
| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| user_id | TEXT | 使用者 Email |
| benchmark | TEXT | 自訂 Benchmark（預設 SPY） |
| created_at | TEXT | 建立時間 |
| updated_at | TEXT | 更新時間 |

### `sqlite_sequence`
| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| name | TEXT | 表名 |
| seq | INTEGER | 自增序號 |

---

## 🔌 API 速查表（Worker.js）

### Auth
- `POST /auth/google`  
  Google OAuth Token 驗證

### Portfolio
- `GET /api/portfolio`  
  取得最新 Portfolio Snapshot（需登入）
- `POST /api/portfolio`  
  上傳 Snapshot（僅 admin / system）

### Records（交易紀錄）
- `GET /api/records`  
  取得使用者交易列表（admin 可讀全部）
- `POST /api/records`  
  新增交易
- `PUT /api/records`  
  更新交易
- `DELETE /api/records`  
  刪除交易

### User Settings
- `GET /api/user-settings`  
  取得用戶 Benchmark（支援 `X-Target-User` 查詢）
- `POST /api/user-settings`  
  更新用戶 Benchmark

### Trigger Update
- `POST /api/trigger-update`  
  觸發 GitHub Actions 重新計算（支援傳入 Benchmark）

---

## 📊 績效計算重點

- **FIFO 成本計算**：BUY/SELL 以 FIFO lot 方式計算已實現損益。
- **TWR（時間加權）**：日切分 linked returns。
- **XIRR**：現金流序列 + 期末市值。
- **股息處理**：DIV 為 confirmed、market data 推導 pending。
- **匯率處理**：台股 FX=1、其他使用即時/歷史 FX。

---

## 📁 Repo 結構

- `src/`：Vue 前端
  - `components/`：UI 元件
  - `stores/`：Pinia 狀態管理
  - `composables/`：共用邏輯
- `public/`：PWA / 靜態資源
- `worker.js`：Cloudflare Worker 主版本
- `cloudflare worker/`：歷史/特定版本 Worker
- `main.py`：批次計算入口
- `journal_engine/`：核心計算引擎（Python）
- `tests/`：單元測試
- `.env.example`：環境變數範例
- `DEPLOYMENT_FINAL.md`：部署指南

---

## 🚀 部署與開發

### 前端開發
```bash
npm install
npm run dev
```

### Python 引擎（本機測試）
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

### 部署（Cloudflare + GitHub Actions）
請參考文件：`DEPLOYMENT_FINAL.md`

---

## 🔐 安全性與權限

- **Google OAuth 2.0**：登入與 Token 驗證
- **API_SECRET**：系統/管理用途 API Key
- **多使用者隔離**：D1 依 user_id 存放資料
- **CSP**：在 `public/_headers` 中設定

---

## ⚠️ 限制與假設

- 引擎以「日粒度」運算為主，不建模盤中 cashflow。
- 尚未支援「現金部位」資產（TWR 由持倉估值與現金流推算）。
- 股息稅率仍偏硬編碼，若需精確對帳建議擴充規則層。
- 若需「任意區間績效」，建議新增 Modified Dietz 報表。

---

<div align="center">

[⭐ Star this project](https://github.com/chihung1024/sheet-trading-journal)
|
[🐛 Report bug](https://github.com/chihung1024/sheet-trading-journal/issues)
|
[💡 Request feature](https://github.com/chihung1024/sheet-trading-journal/issues)

</div>
