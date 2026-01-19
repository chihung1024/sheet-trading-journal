# 🎉 最終部署指南 - 自訂 Benchmark 功能

## ✅ 問題已解決！

**根本原因**: Worker 名稱不一致，部署到錯誤的位置。  
**解決方案**: 將代碼部署到正確的 Worker (`portfolio-dt-proxy`)。

---

## 🚀 部署 Worker v2.38 (生產版本)

### **步驟 1: 登入 Cloudflare**
前往: https://dash.cloudflare.com/

### **步驟 2: 找到正確的 Worker**
- Workers & Pages > **`portfolio-dt-proxy`** (不是 `journal-backend`！)

### **步驟 3: 編輯 Worker**
1. 點擊 **Quick Edit**
2. 按 **Ctrl+A** 全選所有代碼
3. 按 **Delete** 刪除
4. 複製 [worker_v2.38.js](…/cloudflare%20worker/worker_v2.38.js) 的完整內容
5. 貼上
6. 點擊 **Save and Deploy**

### **步驟 4: 驗證部署**
在前端 Console 執行：

```javascript
const token = localStorage.getItem('token');

fetch('https://journal-backend.chired.workers.dev/api/trigger-update', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ benchmark: 'QQQ' })
})
.then(r => r.json())
.then(data => console.log('✅ Response:', data));
```

**預期結果**:
```json
{
  "success": true,
  "benchmark": "QQQ",
  "message": "Update triggered with benchmark: QQQ"
}
```

---

## 📊 使用方法

### **方法1: 網頁介面**

1. 切換到「報酬率」模式
2. 在「基準標的」輸入框輸入（例如：`QQQ`, `TQQQ`, `0050.TW`）
3. 按 **Enter** 或點擊 **✓** 按鈕
4. 確認對話框
5. 等待 2-3 分鐘
6. 圖表自動更新

### **方法2: API 直接調用**

```javascript
fetch('https://journal-backend.chired.workers.dev/api/trigger-update', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${your_google_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ 
    benchmark: 'NVDA'  // 任意美股/台股/韓股 ticker
  })
});
```

---

## 📋 支援的 Benchmark 格式

| 市場 | 格式 | 範例 |
|------|------|------|
| 美股 | TICKER | SPY, QQQ, NVDA, AAPL |
| 台股 | TICKER.TW | 0050.TW, 2330.TW |
| 韓股 | TICKER.KS | 005930.KS (Samsung) |
| ETF | TICKER | TQQQ, SQQQ, VOO |

---

## 🔍 查看執行結果

### **GitHub Actions 日誌**
前往: https://github.com/chihung1024/sheet-trading-journal/actions

**成功指標**:
```
[INFO] main: 觸發參數: Benchmark=QQQ, TargetUser=chired@gmail.com

[QQQ] ✅ 即時報價覆蓋: 123.45
[QQQ] 下載成功

[INFO] journal_engine.core.calculator: === 開始執行多群組投資組合計算 (基準: QQQ) ===
```

### **前端圖表確認**
- 圖表標籤變為 `QQQ (%)`
- 基準線跟著 QQQ 變動
- localStorage 中的 `user_benchmark` 為 `QQQ`

---

## 🛠️ 技術細節

### **系統架構**

```
[前端] 輸入 QQQ
    ↓
[Cloudflare Worker v2.38]
    ↓ workflow_dispatch + inputs
[GitHub Actions]
    ↓ CUSTOM_BENCHMARK=QQQ
[main.py]
    ↓ 下載 QQQ 數據
[calculator.py] 使用 QQQ 作為基準
    ↓
[Cloudflare D1] 保存快照
    ↓
[前端] 自動更新圖表
```

### **核心檔案**

| 檔案 | 說明 |
|------|------|
| `worker_v2.38.js` | 生產版 Worker，移除調試代碼 |
| `.github/workflows/update.yml` | 支援 workflow_dispatch inputs |
| `main.py` | 從環境變數讀取 CUSTOM_BENCHMARK |
| `calculator.py` | 使用 benchmark 計算報酬率 |

### **環境變數 (Cloudflare Worker)**

必須配置以下變數：

```
GITHUB_TOKEN = ghp_xxxxxxxxxxxx
GITHUB_OWNER = chihung1024
GITHUB_REPO = sheet-trading-journal
API_SECRET = (optional)
```

---

## ⚠️ 常見問題

### **Q1: Worker 部署後仍然不工作？**

A: 確認部署到正確的 Worker：
- ✅ `portfolio-dt-proxy`
- ❌ 不是 `journal-backend`

### **Q2: 如何確認 Worker 版本？**

A: 檢查代碼第 4 行：
```javascript
 * v2.38: 生產版本 - 使用 workflow_dispatch + inputs 傳遞自訂 benchmark
```

### **Q3: Benchmark 沒有更新？**

A: 檢查流程：
1. 清除緩存：`Ctrl + Shift + R`
2. 重新登入
3. 輸入新的 benchmark
4. 等待 2-3 分鐘
5. 查看 GitHub Actions 日誌

### **Q4: GitHub Actions 顯示 Benchmark=SPY？**

A: 表示 Worker 沒有傳遞參數：
1. 確認 Worker 版本為 v2.38
2. 確認環境變數 GITHUB_TOKEN 正確
3. 強制重新部署 Worker

---

## 🎉 功能清單

- ✅ 自訂 Benchmark 標的 (QQQ, NVDA, 0050.TW 等)
- ✅ 即時更新報價數據
- ✅ 自動觸發 GitHub Actions
- ✅ 前端圖表自動更新
- ✅ 多市場支援 (美/台/韓)
- ✅ 多使用者隔離
- ✅ 歷史數據保留 (10 筆快照)

---

## 📞 支援

如遇問題，請提供：
1. Worker 版本號
2. GitHub Actions 完整日誌
3. 網頁 Console 錯誤訊息 (F12)

---

**更新時間**: 2026-01-19 14:23 CST  
**版本**: v2.38 (生產版本)  
**狀態**: ✅ 已修復並測試成功