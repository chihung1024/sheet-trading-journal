# 交易架構計算邏輯深度審查（台股/美股）

> 審查範圍：`journal_engine/core/calculator.py`、`journal_engine/core/transaction_analyzer.py`、`journal_engine/core/currency_detector.py`、`journal_engine/clients/market_data.py`、`tests/`
>
> 審查目標：新倉、加碼、持有、減碼、清倉、當沖，以及當日損益、累計損益、TWR、XIRR 的計算一致性與正確性。

---

## 一、整體結論（Executive Summary）

1. **核心 FIFO 成本與累計損益（realized/unrealized）主幹邏輯大致正確**，能覆蓋一般 BUY/SELL 流程與部分當沖情境。
2. **當日損益拆解邏輯（特別是今日交易+持倉混合）已比傳統做法更精細**，透過 `TransactionAnalyzer` 以「舊倉/新倉加權基準」降低新買入造成的虛增。
3. **仍存在數個高風險正確性缺口**，包含：
   - 超賣（oversell）未強制中止、只部分忽略。
   - 股息稅率硬編碼 30%（不分市場/商品），在台股情境明顯失真。
   - 多幣別（非 USD/TWD）實際未完成匯率轉換，與 README 宣稱能力不一致。
   - `tests/test_daily_pnl.py` 測試檔已失效（呼叫不存在 API），導致當日損益主張缺少自動化保護網。
4. **TWR 的日切分 linked return 公式本身合理**，但受「現金流分類」與「交易資料品質（如 oversell）」高度影響。
5. **XIRR 架構方向正確**（外部現金流 + 期末市值），但使用彙整後的四捨五入持倉值，會引入精度偏差。

---

## 二、計算架構拆解與正確性檢視

## 1) 交易事件處理（BUY / SELL / DIV）

### BUY（新倉 / 加碼）
- 交易成本 = `Qty * Price + Commission + Tax`，並將 `Commission/Tax` 正規化為絕對值（可避免資料源傳負值造成符號顛倒）。
- 成本同時入 FIFO lot（`cost_total_usd/twd`）並增加持倉成本。
- 對 TWR 現金流 `daily_net_cashflow_twd` 視為**正值投入**。

✅ 結論：BUY 主流程合理。

### SELL（減碼 / 清倉 / 當沖賣出）
- 依 FIFO 扣 lot，計算 `cost_sold_twd`。
- 賣出收入淨額 `proceeds_twd = (Qty * Price - Commission - Tax) * FX`。
- 已實現損益增加 `proceeds_twd - cost_sold_twd`。
- 對 TWR 現金流視為**負值回收**（`daily_net_cashflow_twd -= proceeds_twd`）。

⚠️ 高風險缺口：
- 若無 lot 可賣，直接 `continue`（交易被靜默略過）。
- 若部分超賣，`remaining > 0` 時不拋錯，僅實際賣出可對應部位，剩餘賣單被吞掉。

這會讓使用者以為成功賣出，但報表不反映完整成交，且 TWR / realized / XIRR 皆可能偏誤。

### DIV（現金股利）
- 交易檔中的 `DIV` 直接入 realized + XIRR 現金流，視為現金流出組合（對組合而言回收）。
- 另外會根據市場資料 `get_dividend()` 自動偵測 pending dividend，若未被確認記錄（`Type=DIV`）則也先入帳。

⚠️ 高風險缺口：
- `total_net_usd = total_gross * 0.7` 硬編碼，等於所有市場都採 30% 扣繳；台股、部分 ETF/ADR 實務不成立。

---

## 2) 當日損益（Daily P&L）

目前是「持倉層級」聚合：
1. `TransactionAnalyzer.analyze_today_position()` 先重建昨日部位，再按當日交易順序更新，產生：
   - `realized_pnl_vs_prev_close`
   - 舊倉/新倉剩餘數量與成本
2. 未實現部分用 `get_base_price_for_pnl()`：
   - 舊倉基準採昨收
   - 新倉基準採成本
   - 混合倉採加權
3. `total_daily_pnl = realized_today + unrealized_today`，再拆台股/美股/匯率分量。

✅ 優點：
- 新倉不會因「當日買入 vs 昨收差異」被虛增當日未實現損益。
- 加碼後可用加權基準，較符合交易日報表直覺。

⚠️ 風險：
- 若實際多筆同日交易的時間順序在資料中未保證（只有日期無時間），結果受原始列順序影響。
- 「當日損益候選標的」主要由當前持倉 + as-of 交易日挑選，極端邊界下可能漏算剛清倉且非 as-of 日交易的標的日損益展示。

---

## 3) 累計損益（Total P&L）

- `unrealized = 當前市值 - 在手成本`
- `total_pnl = unrealized + total_realized_pnl_twd`

✅ 這是標準寫法，且與 FIFO 成本法一致。

⚠️ 需搭配 oversell 嚴格檢核，否則成本庫存有機率失真。

---

## 4) TWR（時間加權報酬）

- 子期間因子：`(MV_end - NetCashFlow) / MV_begin`
- 首次投入特例：`MV_end / NetCashFlow`
- 累乘後減 1 得 TWR%。

✅ 公式層面正確，且現金流正負號一致（買入為投入、賣出/股息為回收）。

⚠️ 注意：
- 若交易資料有超賣、缺漏、重複，TWR 會被放大誤導。
- 實作是「每日 linked」不是 Dietz；與外部券商算法比較時需先統一口徑。

---

## 5) XIRR（年化內部報酬）

- 現金流：BUY 為負、SELL/DIV 為正，最後加期末市值為正。
- 交由 `pyxirr.xirr()` 計算。

✅ 架構正確。

⚠️ 可改善點：
- 期末市值取自 `final_holdings`（已 round）而非高精度原值，會引入小幅誤差。

---

## 6) 市場別適配（台股 / 美股 / 其他）

### 台股 / 美股
- 判定規則：`.TW/.TWO` 視為台股（TWD），其餘預設 USD。
- 美股有即時匯率優先邏輯；台股 FX 固定 1。

✅ 台/美雙市場主流程可運作。

### 非 USD/TWD 市場（如 README 提到韓股）
- `CurrencyDetector` 雖可辨識 HKD/CNY/JPY/GBP/EUR 等，但 `get_fx_multiplier()` 除 USD 以外全部回傳 1.0 並警告。

❌ 結論：若交易韓股/港股/歐股，TWD 市值與損益將錯誤。

---

## 三、情境覆蓋評估（你關心的交易情況）

- **新倉**：可正確處理，且當日 P&L 不會用昨收虛增。✅
- **加碼**：可正確處理，加權基準合理。✅
- **持有（無交易）**：可正確反映市價變動。✅
- **減碼**：FIFO 正常，但超賣容錯不足。⚠️
- **清倉**：可處理，但若數量對不上可能被靜默部分忽略。⚠️
- **當沖（買賣同日）**：`TransactionAnalyzer` 已支援新倉池與舊倉優先賣出，方向正確。✅
- **台股/美股混合**：主流程可計算，並拆 TW/US/FX 分量。✅
- **台股股息稅務**：目前會被套 30% 模式，失真。❌

---

## 四、測試與品質保護網現況

1. `tests/test_pnl_logic.py`（8 tests）可通過，主要覆蓋 `TransactionAnalyzer` 的基準價與部分情境。
2. `tests/test_daily_pnl.py` 與當前 `PortfolioCalculator` API 已脫節（呼叫不存在 `calculate()` / 建構參數不符），目前無法收集執行。

影響：
- 「當日損益引擎整合層」缺乏有效自動化回歸測試。

---

## 五、優先修正建議（按風險排序）

### P0（立即）
1. **SELL 超賣改為硬錯誤（raise）**，至少提供可選嚴格模式，避免靜默錯誤污染績效。
2. **股息稅率改為市場/標的可配置**，台股預設不使用 30% 模型。
3. **修復/重寫 `tests/test_daily_pnl.py` 以符合 `PortfolioCalculator.run()` 現況**，建立整合層防線。

### P1（短期）
4. **多幣別 FX 管線補齊**（至少 KRW/HKD），避免 README 能力與實作落差。
5. **XIRR 期末市值改用未四捨五入精度值**，降低年化誤差。

### P2（中期）
6. 當日交易若存在多筆同日且需順序，加入時間欄位（或 stable sequence id）。
7. 建立「對帳模式」輸出：每筆交易 impact、lot 變化、日損益 attribution 明細，便於稽核。

---

## 六、審查總評

- 就「台股/美股常見交易行為」而言，現行架構在**成本法、累計損益、TWR、XIRR 的主幹**已具備可用性。
- 但若要達到你要求的「深入且可信任」等級，**必須先補齊 P0 項目**（超賣防呆、股息稅率模型、失效測試修復）。
- 在修復前，建議將系統定位為「可用於策略追蹤與相對比較」，而非最終會計級對帳依據。

