# 🚀 自訂基準標的功能部署檢查清單

## ⚠️ 重要提醒

**如果您在切換 benchmark 後發現系統仍然使用舊的 SPY，請檢查以下步驟是否都完成！**

---

## ✅ 部署檢查清單

### 1️⃣ **Cloudflare Worker 部署** (最關鍵！)

#### 步驟：

1. **登入 Cloudflare Dashboard**
   - 前往 [https://dash.cloudflare.com/](https://dash.cloudflare.com/)
   - 點擊左側選單的 **Workers & Pages**

2. **找到您的 Worker**
   - 點擊 `journal-backend` (或您的 Worker 名稱)

3. **上傳新版本代碼**
   - 點擊右上角的 **Quick Edit** 按鈕
   - 將 [`worker_v2.35.js`](./cloudflare%20worker/worker_v2.35.js) 的內容**完整複製貼上**
   - 點擊 **Save and Deploy**

4. **驗證部署**
   - 部署後，檢查 Worker 的版本號
   - 確認代碼第一行是：
     ```javascript
     /**
      * Worker: 交易管理與即時報價 API (多人隔離修正版)
      * 修復：解決交易紀錄刪除後數據殘留的問題
      * v2.35: 新增支援自訂基準標的 (custom_benchmark)
      */
     ```

#### 關鍵變更點：

```javascript
// 舊版本 (v2.34) - 不支援 benchmark 參數
async function handleGitHubTrigger(req, env) {
  // ...
  body: JSON.stringify({ ref: 'main' }) // ✘ 沒有傳遞參數
}

// 新版本 (v2.35) - 支援 benchmark 參數
async function handleGitHubTrigger(req, env, user) {
  // ✅ 讀取 request body 中的 benchmark 參數
  let customBenchmark = 'SPY';
  try {
    const body = await req.json();
    if (body && body.benchmark) {
      customBenchmark = body.benchmark.toUpperCase().trim();
    }
  } catch (e) {}
  
  // ✅ 使用 repository_dispatch
  const ghUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`;
  
  body: JSON.stringify({ 
    event_type: 'trigger-update',
    client_payload: {
      custom_benchmark: customBenchmark, // ✅ 傳遞 benchmark
      target_user_id: user.email,
      triggered_at: new Date().toISOString()
    }
  })
}
```

---

### 2️⃣ **前端代碼** (已自動部署)

✅ **已完成** - Cloudflare Pages 會自動從 GitHub 部署

但如果需要手動觸發：
1. 前往 Cloudflare Dashboard > **Workers & Pages**
2. 點擊您的 Pages 專案 (例如 `trading-journal`)
3. 點擊 **Deployments** 分頁
4. 點擊 **Retry deployment** (如果最新的 commit 還沒部署)

---

### 3️⃣ **GitHub Actions** (已自動更新)

✅ **已完成** - `.github/workflows/update.yml` 已支援 `repository_dispatch`

無需手動操作。

---

### 4️⃣ **Python 腳本** (已自動更新)

✅ **已完成** - `main.py` 已支援讀取 `client_payload`

無需手動操作。

---

## 🔍 問題排解

### 問題 1：切換 benchmark 後仍然使用 SPY

**症狀**：
- 在前端輸入 `QQQ` 並確認
- GitHub Actions 日誌顯示：`Benchmark=SPY`
- 圖表標籤仍然顯示 `SPY (%)`

**原因**：
Cloudflare Worker 未部署新版本，仍在使用 v2.34 或更舊的版本。

**解決方法**：

1. **檢查 Worker 版本**
   ```bash
   # 登入 Cloudflare Dashboard
   # Workers & Pages > journal-backend > Quick Edit
   # 檢查代碼第一行是否有 "v2.35"
   ```

2. **部署新版本**
   - 複製 [`worker_v2.35.js`](https://github.com/chihung1024/sheet-trading-journal/blob/main/cloudflare%20worker/worker_v2.35.js) 的完整內容
   - 貼上到 Cloudflare Worker 編輯器
   - 點擊 **Save and Deploy**

3. **清除緩存並重試**
   - Ctrl+Shift+R (強制重新整理網頁)
   - 再次嘗試切換 benchmark

---

### 問題 2：看不到基準標的輸入框

**症狀**：
報酬率圖上沒有顯示輸入框。

**解決方法**：

1. **確認切換到報酬率模式**
   - 點擊圖表上方的「**報酬率**」按鈕
   - 輸入框只在這個模式下顯示

2. **清除緩存**
   - Ctrl+Shift+R 強制重新整理

3. **檢查前端版本**
   - F12 開啟開發者工具
   - Console 分頁輸入：
     ```javascript
     console.log(document.querySelector('.benchmark-selector'))
     ```
   - 如果回傳 `null`，表示前端未更新

---

### 問題 3：GitHub Actions 顯示 payload 為空

**症狀**：
GitHub Actions 日誌顯示：
```
[DEBUG] client_payload: {}
[INFO] 觸發參數: Benchmark=SPY, TargetUser=ALL
```

**原因**：
1. Worker 未部署 v2.35
2. Worker 使用了舊的 `workflow_dispatch` 而非 `repository_dispatch`

**解決方法**：

1. **確認 Worker 版本**
   - 必須是 v2.35 或更新
   - 檢查 `handleGitHubTrigger` 函數中的 endpoint：
     ```javascript
     // ✅ 正確
     const ghUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`;
     
     // ✘ 錯誤 (舊版本)
     const ghUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/update.yml/dispatches`;
     ```

2. **檢查 Worker 環境變數**
   - Cloudflare Dashboard > Workers & Pages > journal-backend > **Settings** > **Variables**
   - 確認有以下變數：
     - `GITHUB_TOKEN` (必須有 `repo` 與 `workflow` 權限)
     - `GITHUB_OWNER` (例如 `chihung1024`)
     - `GITHUB_REPO` (例如 `sheet-trading-journal`)

3. **測試 Worker API**
   - 使用 Postman 或 curl 測試：
     ```bash
     curl -X POST https://journal-backend.chired.workers.dev/api/trigger-update \
       -H "Authorization: Bearer YOUR_GOOGLE_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"benchmark": "QQQ"}'
     ```
   - 檢查回應是否包含：
     ```json
     {
       "success": true,
       "benchmark": "QQQ",
       "message": "Triggered update with benchmark: QQQ"
     }
     ```

---

### 問題 4：GitHub Actions 無法觸發

**症狀**：
點擊確認後沒有任何 GitHub Actions 執行。

**解決方法**：

1. **檢查 GitHub Token 權限**
   - 前往 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
   - 確認 Token 有以下權限：
     - ☑️ `repo` (完整權限)
     - ☑️ `workflow`

2. **重新生成 Token**
   - 如果不確定，重新生成一個新的 Token
   - 將新 Token 更新到 Cloudflare Worker 環境變數

3. **檢查 GitHub Actions 設定**
   - 前往 GitHub Repository > **Settings** > **Actions** > **General**
   - **Workflow permissions** 設為：
     - ☑️ Read and write permissions
   - **Allow GitHub Actions to create and approve pull requests**：
     - ☑️ 勾選

4. **手動測試觸發**
   - 前往 GitHub Repository > **Actions** 分頁
   - 點擊 **Update Portfolio Data** workflow
   - 點擊 **Run workflow** 手動執行
   - 檢查日誌中是否有：
     ```
     [DEBUG] GITHUB_EVENT_PATH: /path/to/event.json
     [DEBUG] GitHub Event 完整內容: {...}
     ```

---

## 🧪 驗證流程

部署完成後，請依次驗證：

### 1. **Worker 測試**

```bash
# 使用 curl 測試 Worker API
curl -X POST https://journal-backend.chired.workers.dev/api/trigger-update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"benchmark": "QQQ"}'

# 預期回應：
# {"success":true,"benchmark":"QQQ","message":"Triggered update with benchmark: QQQ"}
```

### 2. **前端測試**

1. 開啟交易日誌網頁
2. Ctrl+Shift+R 強制重新整理
3. 切換到「報酬率」模式
4. 確認看到「基準標的」輸入框
5. 輸入 `QQQ` 並按 Enter
6. 確認對話框

### 3. **GitHub Actions 測試**

1. 前往 GitHub Repository > **Actions**
2. 等待新的 workflow 執行開始
3. 點擊進入查看日誌
4. 檢查是否有：
   ```
   [DEBUG] client_payload: {"custom_benchmark":"QQQ","target_user_id":"..."}
   [INFO] 觸發參數: Benchmark=QQQ, TargetUser=...
   ```
5. 檢查是否下載了 QQQ 的數據：
   ```
   [QQQ] ✅ 即時報價覆蓋: 123.45
   [QQQ] 下載成功
   ```

### 4. **結果驗證**

1. 等待 1-3 分鐘計算完成
2. 系統會自動更新圖表
3. 檢查圖表標籤是否變為 `QQQ (%)`
4. 檢查基準線是否有變化

---

## 📦 快速部署命令

如果您熟悉命令列，可以使用以下方式快速部署 Worker：

```bash
# 1. Clone 倉庫 (如果還沒有)
git clone https://github.com/chihung1024/sheet-trading-journal.git
cd sheet-trading-journal

# 2. 安裝 Wrangler CLI
npm install -g wrangler

# 3. 登入 Cloudflare
wrangler login

# 4. 部署 Worker
cd "cloudflare worker"
wrangler deploy worker_v2.35.js --name journal-backend

# 5. 驗證部署
wrangler tail journal-backend
```

---

## 📞 支援

如果仍然遇到問題：

1. **查看完整日誌**
   - GitHub Actions: Repository > Actions > 點擊最新的 workflow 執行
   - Cloudflare Worker: Dashboard > Workers & Pages > journal-backend > **Logs** (Real-time Logs)

2. **提供詳細資訊**
   - Worker 版本號
   - GitHub Actions 完整日誌
   - 前端 Console 錯誤訊息

3. **檢查文檔**
   - [BENCHMARK_FEATURE.md](./BENCHMARK_FEATURE.md) - 功能說明
   - [README.md](./README.md) - 專案概述

---

**最後更新**: 2026-01-19  
**版本**: v2.35