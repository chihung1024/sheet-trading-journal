# 交易計算架構改善優化方案（Action Plan）

> 目標：把現有「可用」提升到「可對帳、可稽核、可擴充」。
> 
> 範圍：台股 / 美股優先，並預留多市場擴充能力。

---

## 1) 方案總覽（先做什麼）

### P0（立即修）
1. **超賣防呆改為可配置嚴格模式（預設嚴格）**
2. **配息稅率模型改為可配置，依市場/標的套用**
3. **修復失效整合測試（`tests/test_daily_pnl.py`）並建立真實介面測試基線**

### P1（短期）
4. **補齊多幣別匯率管線（至少 KRW/HKD）**
5. **XIRR 改採高精度期末市值（避免 round 後再算）**
6. **當日損益引擎建立「可稽核 attribution 明細」輸出**

### P2（中期）
7. **交易時間序（timestamp/sequence）納入計算，以穩定同日多筆排序**
8. **建立回歸測試矩陣 + 黃金資料集（golden dataset）**
9. **建立對帳工具（匯出 lot ledger / day ledger）**

---

## 2) 核心優化設計

## A. 超賣（Oversell）處理升級

### 問題
目前 `SELL` 在 lot 不足時會被「部分吞單或略過」，造成：
- realized P&L 偏差
- TWR / XIRR 偏差
- 使用者難以察覺資料異常

### 改善設計
新增 `oversell_policy`：
- `ERROR`（預設）：直接 raise exception，中止該 user 計算
- `CLAMP`：僅計算可賣數量，但產生高優先級告警並寫入 audit log
- `IGNORE`：保留舊行為（僅供遷移期）

### 驗收標準
- oversell 發生時，`ERROR` 模式必定中止，且日誌包含 symbol/date/qty。
- `CLAMP` 模式下，回傳結果需帶 `anomalies[]` 可被前端顯示。

---

## B. 配息稅率模型（Dividend Tax Model）

### 問題
目前 pending dividend 以 `0.7` 固定淨額（30% 稅）計算，台股不適用。

### 改善設計
新增 `DividendTaxPolicy`：
- 來源優先序：
  1. 使用者自訂（symbol 級）
  2. 市場預設（US=30%、TW=0%、其他可配置）
  3. fallback 常數
- 計算統一：`net_div = gross_div * (1 - tax_rate)`

### 驗收標準
- 台股/美股同時持有時，配息淨額明細能反映不同稅率。
- summary / dividend_history 中需可追溯採用的 `tax_rate`。

---

## C. 多幣別 FX 管線

### 問題
`CurrencyDetector` 可辨識多幣別，但非 USD/TWD 幾乎都回傳 1.0。

### 改善設計
- `MarketDataClient` 新增 `fx_map`（如 `USD/TWD`, `HKD/TWD`, `KRW/TWD`）
- `get_fx_multiplier(symbol, asof_date)` 改為依幣別取對應匯率
- 無可用匯率時：
  - `strict_fx=true` -> raise
  - 否則 fallback + anomaly

### 驗收標準
- HK/KR 交易可正確換算 TWD 市值與損益。
- 匯率缺口不再靜默吞掉，必有 anomaly 紀錄。

---

## D. 當日損益可稽核化（Attribution Ledger）

### 改善目標
讓「為何今天 +X/-Y」可逐標的、逐來源追溯。

### 設計
新增日損益 ledger 欄位：
- `realized_vs_prev_close`
- `unrealized_from_old_position`
- `unrealized_from_new_position`
- `fx_impact`
- `income_pnl`
- `residual_check`

### 驗收標準
- 每標的 `sum(components) == total_daily_pnl`（容差 <= 1 TWD）。
- 提供 debug 匯出（json/csv）供對帳。

---

## E. XIRR 精度優化

### 改善設計
- XIRR 終值改用未四捨五入的 `current_market_value_twd_raw`
- UI 仍顯示 round 值，不影響展示

### 驗收標準
- 與高精度外部試算比較誤差下降（回測 50 組案例）。

---

## 3) 測試重構方案

## A. 測試分層
1. **單元測試**：`transaction_analyzer`, `currency_detector`, `validator`
2. **整合測試**：`PortfolioCalculator.run()` + fake market client
3. **情境測試（golden）**：
   - 新倉、加碼、減碼、清倉、當沖
   - 台美混倉
   - 配息、拆股
   - oversell / 缺匯率 / 缺價格

## B. 測試資料標準化
- 建立 `tests/fixtures/`：
  - `transactions_*.csv`
  - `prices_*.csv`
  - `fx_*.csv`
  - `expected_snapshot_*.json`

## C. CI Gate 建議
- `pytest -q` 必須全綠
- 新增 coverage 門檻（例如 80%）
- golden snapshot 比對失敗即阻擋合併

---

## 4) 上線策略（避免一次改壞）

### 階段 1（相容期）
- 新邏輯 behind feature flags：
  - `STRICT_OVERSELL=true`
  - `STRICT_FX=false`
  - `DIVIDEND_TAX_MODEL=v2`
- 同時計算 old/new，僅展示 old，記錄差異報表。

### 階段 2（灰度）
- 小比例使用者開啟新邏輯，觀察：
  - daily pnl 差異
  - twr 差異
  - anomaly rate

### 階段 3（切換）
- 新邏輯成為預設
- 舊邏輯保留 1~2 版可回退

---

## 5) 建議交付順序（兩週版）

### Week 1
- Day 1-2：oversell policy + 單元測試
- Day 3-4：dividend tax policy + 台美整合測試
- Day 5：修復 `test_daily_pnl`（改接 `run()`）

### Week 2
- Day 1-2：多幣別 FX 管線（HKD/KRW）
- Day 3：XIRR raw value 修正
- Day 4：attribution ledger 輸出
- Day 5：CI gate + golden dataset

---

## 6) 預期收益

- **正確性**：避免超賣吞單與錯誤稅率造成績效污染。
- **可維運**：異常可觀測（anomaly + ledger）。
- **可擴充**：能擴展至非美股/台股市場。
- **可對帳**：輸出可審計明細，降低人工查錯成本。

