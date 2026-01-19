# 🚀 v2.36 快速修復指南

## 問題描述

前端輸入 QQQ 但後端仍然使用 SPY 計算。

## 根本原因

**Worker v2.35 使用的 `repository_dispatch` 事件可能失敗或權限不足**，導致 GitHub Actions 接收到的是 `workflow_dispatch` 而非 `repository_dispatch`。

## 解決方案

**v2.36 改用 `workflow_dispatch` + `inputs` 參數**，這是 GitHub Actions 的標準用法，更可靠。

---

## 🛠️ 部署步驟（只需 1 步！）

### **步驟 1：更新 Cloudflare Worker**

1. **登入 Cloudflare Dashboard**
   - 前往 [https://dash.cloudflare.com/](https://dash.cloudflare.com/)
   - Workers & Pages > `journal-backend`

2. **上傳新版本**
   - 點擊 **Quick Edit**
   - 複製 [`worker_v2.36.js`](https://github.com/chihung1024/sheet-trading-journal/blob/main/cloudflare%20worker/worker_v2.36.js) 的**完整內容**
   - 貼上到編輯器
   - 點擊 **Save and Deploy**

3. **驗證部署**
   - 檢查代碼第一行是否為：
     ```javascript
     * v2.36: 使用 workflow_dispatch + inputs 傳遞自訂 benchmark (更可靠)
     ```

### **完成！**

GitHub Actions workflow 和 main.py 已自動更新，無需手動操作。

---

## 🧪 測試流程

### 1. **清除緩存**
```bash
Ctrl + Shift + R  # 強制重新整理網頁
```

### 2. **輸入 QQQ**
- 切換到「報酬率」模式
- 在「基準標的」輸入框輸入 `QQQ`
- 按 Enter 或點擊 ✓ 按鈕
- 確認對話框

### 3. **監控執行**
前往 [GitHub Actions](https://github.com/chihung1024/sheet-trading-journal/actions):

**應該看到**：
```
2026-01-19 XX:XX:XX [INFO] main: 觸發參數: Benchmark=QQQ, TargetUser=...

[QQQ] ✅ 即時報價覆蓋: 123.45
[QQQ] 下載成功

[INFO] journal_engine.core.calculator: === 開始執行多群組投資組合計算 (基準: QQQ) ===
```

### 4. **驗證結果**
- 1-3 分鐘後圖表自動更新
- 標籤顯示 `QQQ (%)`
- 基準線跟著 QQQ 變動

---

## 🔍 技術說明

### **v2.35 vs v2.36 差異**

#### v2.35 (舊版，可能失敗)
```javascript
// 使用 repository_dispatch
const ghUrl = `https://api.github.com/repos/.../dispatches`;

body: JSON.stringify({ 
  event_type: 'trigger-update',
  client_payload: {  // 可能因權限問題無法傳遞
    custom_benchmark: customBenchmark
  }
})
```

#### v2.36 (新版，更可靠)
```javascript
// 使用 workflow_dispatch + inputs
const ghUrl = `https://api.github.com/repos/.../actions/workflows/update.yml/dispatches`;

body: JSON.stringify({ 
  ref: 'main',
  inputs: {  // ✅ 標準用法，直接傳遞給 workflow
    custom_benchmark: customBenchmark,
    target_user_id: user.email
  }
})
```

### **GitHub Actions workflow 變更**

```yaml
workflow_dispatch:
  inputs:
    custom_benchmark:
      description: '自訂基準標的代碼'
      required: false
      default: 'SPY'
      type: string
    target_user_id:
      description: '目標使用者 email'
      required: false
      default: ''
      type: string
```

### **main.py 變更**

```python
# 從環境變數讀取 (由 workflow inputs 傳入)
custom_benchmark = os.environ.get('CUSTOM_BENCHMARK', 'SPY').strip().upper()
target_user_id = os.environ.get('TARGET_USER_ID', '').strip()
```

---

## ❓ 常見問題

### Q1：部署後仍然用 SPY？

A：**清除緩存**：
```bash
Ctrl + Shift + R
```

### Q2：如何確認 Worker 版本？

A：查看 Cloudflare Worker 代碼第一行：
```javascript
* v2.36: 使用 workflow_dispatch + inputs 傳遞自訂 benchmark (更可靠)
```

### Q3：GitHub Actions 日誌在哪裡？

A：[https://github.com/chihung1024/sheet-trading-journal/actions](https://github.com/chihung1024/sheet-trading-journal/actions)

---

## 🎉 成功標準

✅ Cloudflare Worker 顯示 v2.36  
✅ GitHub Actions 日誌顯示 `Benchmark=QQQ`  
✅ 下載了 QQQ 的數據  
✅ 計算使用 `基準: QQQ`  
✅ 圖表標籤變為 `QQQ (%)`  

---

## 📞 需要幫助？

如果仍然遇到問題，請提供：
1. Worker 版本號 (查看代碼第一行)
2. GitHub Actions 完整日誌
3. 網頁 Console 錯誤訊息 (F12)

---

**更新時間**: 2026-01-19 13:47 CST  
**版本**: v2.36  
**狀態**: ✅ 已修復