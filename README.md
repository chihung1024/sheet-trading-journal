# 📋 SaaS Trading Journal PRO

<div align="center">

![Version](https://img.shields.io/badge/version-2.52.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-green.svg)
![Vue](https://img.shields.io/badge/vue-3.4+-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)
![Cloudflare](https://img.shields.io/badge/cloudflare-workers-f38020.svg)

**現代化的投資組合追蹤與交易日誌系統**

專為美股 / 台股 / 韓股投資者設計，採用全 Serverless 架構  
高效能 | 低成本 | 即時數據 | PWA 支援 | 策略群組 | 多人隔離（Multi-user）

[🌐 Live Demo](https://sheet-trading-journal.pages.dev/) | [📖 部署文件](https://github.com/chihung1024/sheet-trading-journal/blob/main/DEPLOYMENT_FINAL.md) | [🐛 Issues](https://github.com/chihung1024/sheet-trading-journal/issues)

</div>

---

## 📑 目錄

- [功能總覽](#-功能總覽)
- [系統架構](#-系統架構)
- [Repo 結構](#-repo-結構)
- [資料與交易模型](#-資料與交易模型)
- [績效計算說明（以程式碼為準）](#-績效計算說明以程式碼為準)
- [部署與開發](#-部署與開發)
- [安全性](#-安全性)
- [限制與假設](#-限制與假設)

---

## ✨ 功能總覽

### 🎯 核心功能

- **投資組合總覽**
  - 總資產（Market Value / NAV-like）
  - 已實現損益（Realized P&L）
  - 未實現損益（Unrealized P&L）
  - ROI（以成本/市值推導）
  - TWR（時間加權報酬率；日切分 linked returns）
  - XIRR（個人年化報酬率 / IRR）

- **交易日記（CRUD）**
  - 支援交易類型：`BUY` / `SELL` / `DIV`
  - 手續費 / 稅費欄位（會正規化為正值並納入計算）
  - 策略標籤 `Tag`（支援 `,` 或 `;` 分隔）

- **策略群組**
  - `all` 群組 + 每個 Tag 群組
  - 各群組獨立績效與歷史曲線（從該群組第一筆交易起算）

- **Benchmark（可自訂）**
  - 支援自訂 Benchmark ticker（例如：SPY / QQQ / 0050.TW / 005930.KS）
  - Benchmark 曲線以 total-return（價格 + 配息，含預扣稅率設定）方式計算

- **PWA + 深色模式 + 響應式 UI**
  - Vue 3 + Vite 前端，支援桌機/手機使用

---

## 🏭 系統架構

### 高層架構

- **前端（SPA）**
  - Vue 3 / Vite
  - Cloudflare Pages 部署

- **後端（API / Trigger）**
  - Cloudflare Worker（JS）
  - 主要負責：API 轉發/驗證、觸發 GitHub Actions、讀寫快照（依你的部署方式）

- **批次運算（Portfolio Engine）**
  - GitHub Actions 定期或被觸發執行
  - `main.py` 為入口，呼叫 `journal_engine/` 計算投資組合快照
  - 市價/匯率主要來源：Yahoo Finance（或你封裝的 market client）

- **資料儲存**
  - Cloudflare D1（SQLite）存放各使用者快照、交易資料（依 worker/api 實作）

> 部署細節與「正確 Worker 位置」請以文件為準：DEPLOYMENT_FINAL.md

---

## 📁 Repo 結構

（以 repo root 為準）

- `src/`：Vue 前端
- `public/`：PWA / CSP headers 等靜態資源
- `worker.js`：Cloudflare Worker 主版本（實際部署到哪個 Worker 以你的 Cloudflare 設定為準）
- `cloudflare worker/`：歷史/特定版本 Worker（例如文件提到的 v2.38）
- `main.py`：GitHub Actions 批次計算入口
- `journal_engine/`：投資組合計算引擎（Python）
- `tests/`：測試
- `.env.example`：環境變數範例
- `DEPLOYMENT_FINAL.md`：部署指南

---

## 🧾 資料與交易模型

### 交易資料欄位（概念）

- `Date`：交易日期（以日粒度為主）
- `Symbol`：標的代碼（美股無後綴、台股 `.TW/.TWO`、韓股 `.KS/.KQ`）
- `Type`：`BUY` / `SELL` / `DIV`
- `Qty`：數量
- `Price`：成交價（DIV 時欄位語意取決於你的匯入格式）
- `Commission` / `Tax`：費用與稅（會被正規化成正值再納入計算）
- `Tag`：策略標籤（用於群組）

---

## 📢 績效計算說明（以程式碼為準）

> 這一節的目標是「把程式的實際行為講清楚」，方便你日後對帳與擴充。

### 1) 成本與已實現損益：FIFO

- 每個 `Symbol` 維護 FIFO lots。
- `BUY`：增加持倉 qty、增加成本（含 commission/tax）。
- `SELL`：用 FIFO 扣減 lots，計算賣出成本；賣出收入會扣除 commission/tax。
- 已實現損益：`proceeds_twd - cost_sold_twd`（並累加股息等現金流）。

### 2) 匯率處理（有效匯率 multiplier）

- 台股（`.TW/.TWO`）：effective FX = 1.0。
- 非台股：effective FX = 匯率（或你 market client 的幣別轉換倍數）。

### 3) 估值價格與 as-of 日期

- 若 market client 支援 `get_price_asof()`：
  - 會回傳「實際使用的估值日期 used_ts」與對應價格（例如遇到非交易日會向前取最近交易日）。
- 匯率通常會用 `fx_rates.asof(used_ts)`（若 used_ts = 今日且美股盤中，可能使用即時匯率 current_fx）。

### 4) TWR（時間加權報酬率）：日切分 linked returns

本專案的 TWR 是「每天一個子期間」的 linked return：

- 定義：
  - `last_market_value_twd`：前一日估值（期初）
  - `current_market_value_twd`：當日估值（期末）
  - `daily_net_cashflow_twd`：當日淨現金流（正值代表投入、負值代表流出/回收）

- 當 `last_market_value_twd > 0`：
  - `period_hpr_factor = (current_market_value_twd - daily_net_cashflow_twd) / last_market_value_twd`

- 首次投入（期初 0、期末 >0 且有現金流）：
  - `period_hpr_factor = current_market_value_twd / daily_net_cashflow_twd`

- 累積：
  - `cumulative_twr_factor *= period_hpr_factor`
  - `twr_percent = (cumulative_twr_factor - 1) * 100`

> 註：這是「日切分 linked TWR」。它不是傳統單一期間的 Modified Dietz（沒有對期間內 cashflow 做時間權重），但在你有每日估值點的情境下通常更貼近真正 TWR。

### 5) 股息（DIV / pending / confirmed）

- `DIV` 交易會被視為「已確認股息」（避免重複計入）。
- 系統也會從 market data 推導「應計股息」並記錄為 dividend history：
  - 若該日該標的沒有 `DIV` 交易，會視為 pending（並可能先行計入 realized / cashflow，依目前 engine 行為）。
  - 若你新增 `DIV` 交易（confirmed），則該筆會轉為 confirmed，避免 double-count。
- 股息淨額目前含預扣稅率假設（例如 0.7 = 30% withholding）；若你要支援不同市場稅率，建議未來把稅率規則化（per symbol / per market / per account）。

### 6) XIRR（Money-weighted）

- XIRR 由現金流序列計算：
  - `BUY`：負現金流
  - `SELL` / `DIV`：正現金流
  - 最後加上一筆「當前市值」作為期末正現金流

---

## 🚀 部署與開發

### 快速開始（前端）

```bash
npm install
npm run dev
```

### Python engine（本機測試）

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

### 部署（Cloudflare + GitHub Actions）

請參考文件：DEPLOYMENT_FINAL.md

---

## 🔐 安全性

- Google OAuth 2.0 / JWT（實際流程依 Worker 實作）
- CSP（見 `public/_headers` 與 `index.html`）
- CORS / API key / token 驗證（依 Worker 設定）

---

## ⚠️ 限制與假設

- 目前引擎以「日粒度」運算為主（交易時間、盤中 cashflow 時點不建模）。
- 目前沒有顯式「現金部位」資產（TWR/資產曲線主要反映持倉估值 + 現金流處理邏輯）。
- 股息稅率/市場規則目前偏 hard-coded（若要嚴格對帳，建議擴充規則層）。
- 若你要做「任意區間」單一數字績效，建議新增一個獨立的 Modified Dietz 報表指標，而不是取代現有日切分 TWR。

---

<div align="center">

[⭐ Star this project](https://github.com/chihung1024/sheet-trading-journal)
|
[🐛 Report bug](https://github.com/chihung1024/sheet-trading-journal/issues)
|
[💡 Request feature](https://github.com/chihung1024/sheet-trading-journal/issues)

</div>
