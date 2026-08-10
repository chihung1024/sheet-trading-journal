# 📋 SaaS Trading Journal PRO

<div align="center">

![Python](https://img.shields.io/badge/python-3.10+-green.svg)
![Vue](https://img.shields.io/badge/vue-3.4+-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)
![Cloudflare](https://img.shields.io/badge/cloudflare-workers-f38020.svg)

**現代化的投資組合追蹤與交易日誌系統**

以美股 / 台股為主要使用情境，並支援韓股與其他已建模 Yahoo 市場的原生幣別估值  
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
  - TWR（時間加權報酬率；日切分 linked returns，含可靠性狀態）
  - XIRR（個人年化報酬率 / IRR；含可用性與估值日 provenance）
  - 勝率 / 持倉數 / 交易筆數

- **績效曲線圖（Performance Chart）**
  - 投資組合 vs. Benchmark 歷史表現
  - 自訂 Benchmark ticker（SPY / QQQ / 0050.TW / 005930.KS 等）
  - 支援多時間軸切換（全部 / 1年 / 6月 / 3月 / 1月）
  - Benchmark total-return 僅在有已審查股息預扣政策時納入自動股息；未知市場不會猜稅率
  - 新快照若策略 TWR 自某一子期間起無法可靠計算，策略線自該點停止繪製；Benchmark 線維持獨立

### 📈 圖表頁面

專注於績效曲線的完整檢視：
- 放大版績效圖表
- 支援多群組切換
- 圖表互動（縮放、Tooltip、數據點標註）

### 💼 持倉明細頁面

當前持倉的詳細資訊表格：
- 標的代碼（Symbol）
- 持倉數量（Qty）
- 平均成本（Avg Cost；顯示原生報價單位）
- 當前市價（Current Price；顯示原生報價單位）
- 市值（Market Value，TWD）
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
  - 自動偵測應計股息（Pending；目前只對已審查預扣政策的市場自動入帳）
  - 已確認配息（Confirmed）
  - 除息日（Ex-Date）、發放日（Pay Date）
  - 每股配息、持有數量、配息總額
  - 預扣稅率與淨收入

- **快速操作**
  - 一鍵新增 DIV 交易確認實際配息
  - Pending 股息提醒徽章
  - 已審查市場的配息金額自動換算為台幣

> 目前自動 pending 股息政策只明確建模 TWD（0%）與 USD（30%，依本系統既有模型）。KRW/HKD/CNY/JPY/GBp/EUR 等市場若沒有已審查政策，系統不會猜稅率或自動計入收入；實際已確認的 `DIV` 交易仍按其原生幣別與當日 FX 計算。

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
  - `services/`：前端資料/狀態語意（例如 benchmark / TWR reliability）
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
- `Symbol`：標的代碼。現行 suffix→原生報價單位包括：美股無後綴→USD、`.TW/.TWO`→TWD、`.KS/.KQ`→KRW、`.HK/.HKG`→HKD、`.SS/.SZ`→CNY、`.T`→JPY、`.L`→GBp、`.PA/.DE`→EUR。
- `Type`：`BUY` / `SELL` / `DIV`
- `Qty`：數量
- `Price`：原生報價單位成交價（DIV 時代表實際確認的原生幣別淨現金流單價）
- `Commission` / `Tax`：同交易原生報價單位的費用與稅（會被正規化成正值再納入計算）
- `Tag`：策略標籤（用於群組）

---

## 📢 績效計算說明（以程式碼為準）

> 這一節的目標是「把程式的實際行為講清楚」，方便日後對帳與擴充。

### 1) 成本與已實現損益：FIFO

- 每個 `Symbol` 維護 FIFO lots。
- `BUY`：增加持倉 qty、增加成本（含 commission/tax）。
- `SELL`：用 FIFO 扣減 lots，計算賣出成本；賣出收入會扣除 commission/tax。
- 已實現損益：`proceeds_twd - cost_sold_twd`（並累加已確認股息等現金流）。

### 2) 匯率處理（TWD per native quote unit）

- TWD 標的（`.TW/.TWO`）：effective FX = 1.0。
- USD、KRW、HKD、CNY、JPY、GBp、EUR 標的：計算器使用「每 1 原生報價單位可換多少 TWD」的日期化 FX context。
- 外幣 cross-rate 由 Yahoo USD quote 建立：`TWD/native-major = (TWD/USD) ÷ (native/USD)`。
- 倫敦 `.L` 明確視為 Yahoo/LSE 常見的 **GBp（pence）** 報價，因此 GBP cross-rate 之後再乘 `0.01`；不可把 GBp 當 GBP，否則會造成 100 倍量綱錯誤。
- 對已知外幣若缺少所需 FX，系統不會以 `1.0` 或預設匯率冒充真實值；必要價格或 FX 在實際計算起點之前沒有可用 as-of 資料時，批次會在計算前 fail closed。

### 3) 估值價格與 as-of 日期

- `get_price_asof()` 會回傳實際使用的估值日期 `used_ts` 與對應原生價格（非交易日向前取最近可用交易日）。
- 歷史估值、交易現金流、股息與 Daily P&L 皆使用對應日期的 currency-aware FX context；今日若有可驗證 realtime FX，會在即時估值 context 覆蓋歷史值。
- runner 會先驗證每個交易標的在其最早交易日之前已有正且有限的價格/FX as-of 值；benchmark 另要求使用者第一筆交易前的基準資料，避免「series 非空但起始太晚」。

### 4) TWR（時間加權報酬率）：Modified Dietz 子期間連結

本專案的 TWR 以「每天一個子期間」計算 Modified Dietz 報酬後再連結：

- 定義：
  - `last_market_value_twd`：前一日估值（期初）
  - `current_market_value_twd`：當日估值（期末）
  - `daily_net_cashflow_twd`：當日淨現金流（正值代表投入、負值代表流出/回收）

- 子期間報酬（Modified Dietz）：
  - `r_md = (V1 - V0 - ΣCF) / (V0 + Σ(w_i * CF_i))`
  - `period_hpr_factor = 1 + r_md`
  - 其中 `CF_i` 正值代表外部資金流入（買入），負值代表流出/回收（賣出/股息）
  - 權重 `w_i` 目前在日粒度採同日等距近似（資料無交易時間戳）

- 累積：
  - `cumulative_twr_factor *= period_hpr_factor`
  - `twr_percent = (cumulative_twr_factor - 1) * 100`

- P4B reliability 語意：
  - 既有 `history[].twr` 與 summary `twr` 的 numeric chain 保留，避免破壞舊 snapshot/API/golden。
  - 新 history 另外標記 `twr_period_status` / `twr_period_reason` 與 sticky 的 `twr_status` / `twr_reason` / `twr_invalid_since`。
  - Modified Dietz 分母接近 0、非有限/無效輸入、從 0 市值無有效 funding 卻出現正市值、或 0 exposure 下發生無法在日粒度可靠定位的 cashflow，會標成 `undefined`，不再把 compatibility 0% 當成可信報酬。
  - 一旦某個子期間 `undefined`，累積 TWR 的可靠性維持 `undefined`；後續即使單一期間可計算，也不會把已污染的 linked chain 自動恢復成可信。
  - `not_applicable` 表示目前尚無可計算報酬期間，與真正 0% 報酬不同。
  - 新快照的 Stats Grid 對 unavailable TWR 顯示 `--`；Performance Chart 自第一個 undefined 點起停止策略 TWR 線，Benchmark 線不受此策略狀態影響。
  - 舊快照沒有 `twr_status` 時仍沿用既有 numeric 顯示與 upload 相容性。

> 註：P4B 刻意不重寫既有 Modified Dietz 數字公式或日內權重假設；它先把「能不能相信這個 linked TWR」變成顯式契約。日粒度沒有交易時間戳，因此 `w_i=0.5` 仍是既有近似。

### 5) 股息（DIV / pending / confirmed）

- `DIV` 交易代表已確認的實際股息現金流，按該 Symbol 原生報價單位與日期化 FX 換算為 TWD；同日 market dividend 不再重複計入。
- market data 的自動 pending 股息只有在「已有審查過的預扣稅政策」時才會計入 realized/cashflow。目前：
  - TWD：0%。
  - USD：30%（保留本系統既有模型）。
- KRW/HKD/CNY/JPY/GBp/EUR 等尚無已審查政策時，持倉與 FX 估值仍可正常進行，但該自動股息不會被猜稅率後入帳；engine 會留下 `DIVIDEND_POLICY_REVIEW_REQUIRED` anomaly，等待實際 `DIV` 或未來政策擴充。
- 若自訂 benchmark 在實際配息日遇到未審查的股息政策，benchmark total-return 會 fail closed，而不是忽略配息或套用美股稅率。

### 6) XIRR（Money-weighted）

- XIRR 現金流序列：
  - `BUY`：負現金流。
  - `SELL` / 已確認或已審查自動股息：正現金流。
  - 最後加上一筆「未四捨五入的 raw 最終持倉估值」作為期末正現金流。
- 期末估值現金流的日期使用**實際最後估值日**（history 最後有效日期），而不是 batch 執行當下 `datetime.now()`；因此週末、假日或非交易日不會把同一估值錯誤延後到執行日再做年化。
- `xirr` 數字欄位仍保留作舊 snapshot/API 相容；新 snapshot 另外提供：
  - `xirr_status`：`ok` / `not_applicable` / `undefined`。
  - `xirr_reason`：無法可靠計算時的 machine-readable 原因。
  - `xirr_asof_date`：期末估值所屬日期。
  - `xirr_cashflow_conventional`：現金流正負號是否只切換一次。
- 真正 0% XIRR 是 `xirr=0.0, xirr_status=ok`；solver 無解、輸入不足或計算失敗會保留 legacy numeric `0.0` sentinel，但 status 不會是 `ok`，前端顯示 `--` 而不是 `+0.00%`。
- 若現金流正負號多次切換，XIRR 仍可回傳 solver 結果，但會標示 `xirr_cashflow_conventional=false`，因非傳統現金流可能存在多個 IRR 解；畫面會顯示風險提示，不把該根視為唯一解。
- 舊 snapshot 沒有 `xirr_status` 時仍維持既有數字顯示與 upload 相容性。

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

現行部署導航：`docs/DEPLOYMENT.md`。

目前工程執行狀態與下一步請先讀：

1. `to_do_update_list.md` — current-state-first 的 Gate / Batch / recovery / next-action handoff；
2. `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md` — Gate E / E1a production activation 與零停機 privacy cutover 的現行 operational authority；
3. `docs/DEPLOYMENT.md` — canonical production/staging deployment runbook。

> **Repository merge 不等於 production Worker deployment。** Production Worker 使用獨立的 fail-closed activation control plane；在 current handoff 明確標示 deployable/authorized 前，不應因 `main` 已合併 runtime code 就直接手動部署，也不應從歷史 runbook 推定 production 已同步。

---

## 🔐 安全性

- Google OAuth 2.0 / JWT（實際流程依 Worker 實作）
- CSP（見 `public/_headers` 與 `index.html`）
- CORS / API key / token 驗證（依 Worker 設定）

---

## ⚠️ 限制與假設

- 目前引擎以「日粒度」運算為主（交易時間、盤中 cashflow 時點不建模）。
- 目前沒有顯式「現金部位」資產（TWR/資產曲線主要反映持倉估值 + 現金流處理邏輯）。
- 多幣別**估值/FX**能力與各市場**股息稅務政策**是兩件事：目前自動 pending 股息只明確支援 TWD 0% / USD 30%；其他市場需以實際 `DIV` 或後續審查政策處理，不會自動猜測。
- `us_pnl_twd` 是為舊 snapshot/API 相容而保留的欄位名稱；在 currency-aware 引擎中實際代表非 TWD（海外）價格/交易分量，前端以「海外」呈現。
- 自動盤中 refresh 的 market-stage 排程目前仍以台股 / 美股時段為主；支援外幣估值不代表已新增所有海外交易所的盤中 refresh 時段。
- XIRR 對非傳統現金流可能存在多個數學根；目前會標示 ambiguity，但不替使用者選擇「經濟上唯一正確」的根。
- TWR 的既有 numeric chain 為 backward compatibility 保留；若新 metadata 標示 `undefined`，該日之後的 numeric TWR 不能視為可信績效，前端會 fail closed。真正的 intraday Modified Dietz 權重仍需更細的交易時間資料才能建模。
- 任意區間單一數字績效可直接以同一公式整段計算，或沿用日子期間連結結果（需在報表層定義口徑）。

---

<div align="center">

[⭐ Star this project](https://github.com/chihung1024/sheet-trading-journal)
|
[🐛 Report bug](https://github.com/chihung1024/sheet-trading-journal/issues)
|
[💡 Request feature](https://github.com/chihung1024/sheet-trading-journal/issues)

</div>