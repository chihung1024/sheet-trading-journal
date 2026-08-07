# 📋 SaaS Trading Journal PRO

<div align="center">

![Python](https://img.shields.io/badge/python-3.10+-green.svg)
![Vue](https://img.shields.io/badge/vue-3.4+-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)
![Cloudflare](https://img.shields.io/badge/cloudflare-workers-f38020.svg)

**現代化的投資組合追蹤與交易日誌系統**

專為美股 / 台股 / 韓股投資者設計，採用全 Serverless 架構  
高效能 | 低成本 | 即時數據 | PWA 支援 | 策略群組 | 多人隔離（Multi-user）

[🌐 Live Demo](https://sheet-trading-journal.pages.dev/) | [📖 部署文件](https://github.com/chihung1024/sheet-trading-journal/blob/main/docs/DEPLOYMENT.md) | [🐛 Issues](https://github.com/chihung1024/sheet-trading-journal/issues)

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

### 🏠 總覽頁面

投資組合儀表板，一目瞭然掌握全局：

- **績效卡片（Stats Grid）**
  - 總資產（Market Value / NAV-like）
  - 已實現損益（Realized P&L）
  - 未實現損益（Unrealized P&L）
  - 總損益（Total P&L）
  - ROI（投資報酬率）
  - TWR（時間加權報酬率；日切分 linked returns）
  - XIRR（個人年化報酬率 / IRR）
  - 勝率 / 持倉數 / 交易筆數

- **績效曲線圖（Performance Chart）**
  - 投資組合 vs. Benchmark 歷史表現
  - 自訂 Benchmark ticker（SPY / QQQ / 0050.TW / 005930.KS 等）
  - 支援多時間軸切換（全部 / 1年 / 6月 / 3月 / 1月）
  - Total-return 模式（價格 + 配息，含預扣稅率）

### 📈 圖表頁面

專注於績效曲線的完整檢視：
- 放大版績效圖表
- 支援多群組切換
- 圖表互動（縮放、Tooltip、數據點標註）

### 💼 持倉明細頁面

當前持倉的詳細資訊表格：
- 標的代碼（Symbol）
- 持倉數量（Qty）
- 平均成本（Avg Cost）
- 當前市價（Current Price）
- 市值（Market Value）
- 未實現損益（Unrealized P&L）
- 未實現報酬率（Unrealized %）
- 標的權重（Weight %）
- 支援依各欄位排序
- 即時市價更新（含盤中 / 收盤價標示）

### 🧾 交易紀錄頁面

完整的交易歷史管理：
- **交易列表**
  - 日期、標的、類型（BUY / SELL / DIV）
  - 數量、價格、手續費、稅費
  - 策略標籤（Tag）
  - 快速編輯 / 刪除功能

- **篩選與搜尋**
  - 依標的搜尋
  - 依交易類型篩選
  - 依群組標籤篩選
  - 日期區間篩選

### 💰 配息紀錄頁面

股息配發與現金流追蹤：
- **配息歷史表**
  - 自動偵測應計股息（Pending）
  - 已確認配息（Confirmed）
  - 除息日（Ex-Date）、發放日（Pay Date）
  - 每股配息、持有數量、配息總額
  - 預扣稅率與淨收入

- **快速操作**
  - 一鍵新增 DIV 交易確認配息
  - Pending 股息提醒徽章
  - 配息金額自動換算為台幣

### 🏷️ 群組管理頁面

策略群組設定與績效隔離：
- **群組列表**
  - 檢視所有策略群組（Tag）
  - 各群組獨立績效指標
  - 群組成立日期與累計表現

- **群組操作**
  - 新增 / 重命名 / 刪除群組
  - 交易紀錄自動歸屬群組
  - `all` 群組自動包含所有交易

### 📝 交易表單（Side Panel）

固定式右側面板，隨時新增/編輯交易：
- **交易類型**
  - BUY（買入）
  - SELL（賣出）
  - DIV（配息）

- **欄位設計**
  - 標的代碼（自動補全建議）
  - 交易日期（日曆選擇器）
  - 數量 / 價格
  - 手續費 / 稅費（自動正規化為正值）
  - 策略標籤（支援 `,` 或 `;` 分隔多標籤）

- **智能功能**
  - 編輯模式自動填充現有資料
  - 表單驗證與錯誤提示
  - 送出後自動觸發後端計算

### 🔄 自動刷新機制

盤中自動觸發投資組合更新：
- 僅在台股 / 美股盤中排程自動刷新
- 盤中預設每 3 分鐘觸發一次，每次觸發設有 60 秒逾時保護
- 隱藏頁面、未登入、暫停或失去跨分頁 leadership 時不自動排程
- 同一登入者僅由一個可見 leader 分頁負責自動刷新與倒數
- 暫停意圖會在同租戶分頁間共享，並保留手動觸發能力
- 狀態輪詢自動追蹤後端計算進度

### 🌓 深色模式 & PWA

- **主題切換**
  - 深色 / 淺色模式
  - 一鍵切換，記憶偏好設定

- **PWA 功能**
  - 可安裝至桌面/主畫面
  - 離線快取
  - Service Worker 自動更新提示

### 🔐 使用者認證

- Google OAuth 2.0 登入
- JWT Token 驗證
- 多使用者資料隔離
- 安全登出機制

---

## 🏭 系統架構

### 高層架構

- **前端（SPA）**
  - Vue 3 / Vite
  - Cloudflare Pages 部署

- **後端（API / Trigger）**
  - Cloudflare Worker（JS）
  - 主要負責：API 轉發/驗證、觸發 GitHub Actions、讀寫快照（依目前 Worker/API 實作）

- **批次運算（Portfolio Engine）**
  - GitHub Actions 定期或被觸發執行
  - `main.py` 為入口，呼叫 `journal_engine/` 計算投資組合快照
  - 市價/匯率主要來源：Yahoo Finance（或封裝的 market client）

- **資料儲存**
  - Cloudflare D1（SQLite）存放各使用者快照、交易資料（依 Worker/API 實作）

> Current deployment navigation：`docs/DEPLOYMENT.md`。歷史 runbook 不應覆蓋目前 machine-readable contracts 與 workflows。

---

## 📁 Repo 結構

（以 repo root 為準）

- `src/`：Vue 前端
  - `components/`：現行 Vue 元件
    - `StatsGrid.vue`：績效卡片
    - `PerformanceChart.vue`：績效曲線圖
    - `HoldingsTable.vue`：持倉明細表
    - `RecordList.vue`：交易紀錄列表
    - `DividendManager.vue`：配息管理介面
    - `GroupManager.vue`：群組管理介面
    - `TradeForm.vue`：交易表單
    - `LoginOverlay.vue`：登入畫面
    - `skeletons/`：載入骨架屏
  - `stores/`：Pinia 狀態管理
  - `composables/`：可重用邏輯（例如 `useMarketHoursRefresh` / `useDarkMode` / `usePWA` / `useTokenRefresh` / `useToast`）
  - `App.vue`：主應用程式
- `public/`：PWA / CSP headers 等靜態資源
- `worker-entry.js`：Cloudflare Worker 部署入口
- `worker.js`：canonical Worker runtime source
- `cloudflare worker/`：歷史 archive，不是現行 deploy source
- `main.py`：GitHub Actions 批次計算入口
- `journal_engine/`：投資組合計算引擎（Python）
- `tests/`：測試
- `.env.example`：production frontend 環境值範例；不是 staging / preview 設定檔
- `docs/DEPLOYMENT.md`：現行部署指南

---

## 🧾 資料與交易模型

### 交易資料欄位（概念）

- `Date`：交易日期（以日粒度為主）
- `Symbol`：標的代碼（美股無後綴、台股 `.TW/.TWO`、韓股 `.KS/.KQ`）
- `Type`：`BUY` / `SELL` / `DIV`
- `Qty`：數量
- `Price`：成交價（DIV 時欄位語意取決於匯入格式）
- `Commission` / `Tax`：費用與稅（會被正規化成正值再納入計算）
- `Tag`：策略標籤（用於群組）

---

## 📢 績效計算說明（以程式碼為準）

> 這一節的目標是「把程式的實際行為講清楚」，方便日後對帳與擴充。

### 1) 成本與已實現損益：FIFO

- 每個 `Symbol` 維護 FIFO lots。
- `BUY`：增加持倉 qty、增加成本（含 commission/tax）。
- `SELL`：用 FIFO 扣減 lots，計算賣出成本；賣出收入會扣除 commission/tax。
- 已實現損益：`proceeds_twd - cost_sold_twd`（並累加股息等現金流）。

### 2) 匯率處理（有效匯率 multiplier）

- 台股（`.TW/.TWO`）：effective FX = 1.0。
- 非台股：effective FX = 匯率（或 market client 的幣別轉換倍數）。

### 3) 估值價格與 as-of 日期

- 若 market client 支援 `get_price_asof()`：
  - 會回傳「實際使用的估值日期 used_ts」與對應價格（例如遇到非交易日會向前取最近交易日）。
- 匯率通常會用 `fx_rates.asof(used_ts)`（若 used_ts = 今日且美股盤中，可能使用即時匯率 current_fx）。

### 4) TWR（時間加權報酬率）：Modified Dietz 子期間連結

本專案的 TWR 以「每天一個子期間」計算 Modified Dietz 報酬後再連結：

- 定義：
  - `last_market_value_twd`：前一日估值（期初）
  - `current_market_value_twd`：當日估值（期末）
  - `daily_net_cashflow_twd`：當日淨現金流（正值代表投入、負值代表流出/回收）

- 子期間報酬（Modified Dietz）：
  - `r_md = (V1 - V0 - ΣCF) / (V0 + Σ(w_i * CF_i))`
  - `period_hpr_factor = 1 + r_md`
  - 其中 `CF_i` 正值代表外部資金流入（買入），負值代表流出（賣出/股息）
  - 權重 `w_i` 目前在日粒度採同日等距近似（資料無交易時間戳）

- 累積：
  - `cumulative_twr_factor *= period_hpr_factor`
  - `twr_percent = (cumulative_twr_factor - 1) * 100`

> 註：目前是「日切分的 Modified Dietz 連結報酬」。若後續補齊分時交易時間戳，可再升級更精細的現金流權重模型。

### 5) 股息（DIV / pending / confirmed）

- `DIV` 交易會被視為「已確認股息」（避免重複計入）。
- 系統也會從 market data 推導「應計股息」並記錄為 dividend history：
  - 若該日該標的沒有 `DIV` 交易，會視為 pending（並可能先行計入 realized / cashflow，依目前 engine 行為）。
  - 若新增 `DIV` 交易（confirmed），則該筆會轉為 confirmed，避免 double-count。
- 股息淨額目前含預扣稅率假設（例如 0.7 = 30% withholding）；若要支援不同市場稅率，可再擴充規則層（per symbol / per market / per account）。

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

請參考現行文件：`docs/DEPLOYMENT.md`

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
- 任意區間單一數字績效可直接以同一公式整段計算，或沿用日子期間連結結果（需在報表層定義口徑）。

---

<div align="center">

[⭐ Star this project](https://github.com/chihung1024/sheet-trading-journal)
|
[🐛 Report bug](https://github.com/chihung1024/sheet-trading-journal/issues)
|
[💡 Request feature](https://github.com/chihung1024/sheet-trading-journal/issues)

</div>
