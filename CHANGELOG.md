# 📝 Changelog

All notable changes to this project will be documented in this file.

## [2.39.0] - 2026-01-19

### 🐛 Bug Fixes

#### 修復 TWR 基準點問題 - 第一天交易現顯示損益

**問題描述**：
- 原本設計將第一筆交易當日設為 TWR 基準點 (0%)
- 導致第一天的交易損益無法在圖表上顯示
- 用戶無法看到第一筆交易的實際表現

**解決方案**：
- ✅ 將 TWR 基準點設定為**第一筆交易的前一天**
- ✅ 基準日當天：TWR = 0%, 作為計算起點
- ✅ 第一筆交易日：開始顯示真實損益
- ✅ Benchmark 也相對於基準日計算

**技術細節**：

```python
# 修復前
第一筆交易日 (1/2): TWR = 0%  ← 基準點
第二天 (1/3):       TWR = +1.2%

# 修復後
基準日 (1/1):       TWR = 0%  ← 基準點
第一筆交易日 (1/2): TWR = +0.5%  ← ✅ 顯示真實損益
第二天 (1/3):       TWR = +1.2%
```

**影響範圍**：
- `journal_engine/core/calculator.py` - 更新 TWR 計算邏輯
- 所有群組的 TWR 計算都會受益
- Benchmark 比較也更加準確

**使用建議**：
1. 部署更新後，觸發一次完整更新
2. 等待 1-3 分鐘讓系統重新計算所有數據
3. 重新檢查圖表，第一天應會顯示損益

---

## [2.38.0] - 2026-01-18

### ✨ Features

#### 自訂 Benchmark 功能

- ✅ 支持自訂基準標的（美股/台股/韓股）
- ✅ 動態切換基準，不需重新部署
- ✅ 在圖表上實時顯示比較結果

**支持格式**：
- 美股：`SPY`, `QQQ`, `VOO`, `AAPL`
- 台股：`0050.TW`, `0056.TW`, `2330.TW`
- 韓股：`005930.KS` (Samsung)

**使用方法**：

```yaml
# .github/workflows/scheduled_update.yml
env:
  BENCHMARK_TICKER: "0050.TW"  # 設定預設基準
```

或透過 API 動態設定：

```bash
curl -X POST "https://your-worker.workers.dev/api/trigger-update" \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"benchmark": "QQQ"}'
```

---

## [2.37.0] - 2026-01-15

### 🐛 Bug Fixes

- 修復配息計算邏輯
- 優化 XIRR 效能
- 修復匯率異常處理

### 🛠️ Improvements

- 優化前端圖表效能
- 改進錯誤提示訊息
- 更新文檔

---

## [2.36.0] - 2026-01-10

### ✨ Features

- 新增多群組支持
- 支持 Tag 篩選功能
- 新增群組報表導出

---

## [2.35.0] - 2026-01-05

### ✨ Features

- 初始版本發佈
- 基礎 TWR/XIRR 計算
- Google OAuth 驗證
- Cloudflare D1 資料庫整合

---

## 標記說明

- ✨ Features: 新功能
- 🐛 Bug Fixes: 錯誤修復
- 🛠️ Improvements: 改進與優化
- 📝 Documentation: 文檔更新
- ⚠️ Breaking Changes: 重大變更
- 🔒 Security: 安全修復