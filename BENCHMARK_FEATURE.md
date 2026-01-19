# 🎯 自訂基準標的功能說明

## 功能概述

現在您可以在報酬率趨勢圖中自由切換基準標的，不再限於預設的 SPY！

### 支援的基準標的範例：
- **美股 ETF**: SPY, QQQ, DIA, IWM, VTI, VOO
- **科技指數**: TQQQ, SOXL, TECL
- **台股**: 0050.TW, 0056.TW
- **個股**: AAPL, MSFT, NVDA, TSLA
- **任何 Yahoo Finance 支援的標的**

---

## 🔧 完整修改清單

### 1️⃣ **前端修改** (`src/components/PerformanceChart.vue`)

#### 新增功能：
✅ **基準標的輸入框**：
- 只在「報酬率」模式下顯示
- 支援 Enter 鍵快速確認
- 自動轉換為大寫
- 載入狀態指示

✅ **智慧驗證**：
- 空白檢查
- 重複值檢查
- 確認對話框（避免誤觸發）

✅ **動態圖表標籤**：
```javascript
const benchmarkLabel = `${portfolioStore.selectedBenchmark} (%)`;
// 原本是寫死的 'SPY (%)'
```

✅ **狀態同步**：
```javascript
watch(() => portfolioStore.selectedBenchmark, (newVal) => {
  benchmarkInput.value = newVal;
});
```

#### UI 設計：
```html
<div class="benchmark-selector" v-if="chartType === 'twr'">
  <label class="benchmark-label">基準標的</label>
  <div class="benchmark-input-group">
    <input 
      type="text" 
      v-model="benchmarkInput" 
      placeholder="例: SPY, QQQ, 0050.TW"
      @keyup.enter="handleBenchmarkChange"
      :disabled="isChangingBenchmark"
    />
    <button 
      @click="handleBenchmarkChange"
      :disabled="isChangingBenchmark || !benchmarkInput || benchmarkInput === portfolioStore.selectedBenchmark"
    >
      <span v-if="isChangingBenchmark">⏳</span>
      <span v-else>✓</span>
    </button>
  </div>
</div>
```

---

### 2️⃣ **狀態管理** (`src/stores/portfolio.js`)

#### 新增狀態：
```javascript
// ✅ 新增：自訂基準標的 (從 localStorage 讀取，預設 SPY)
const selectedBenchmark = ref(localStorage.getItem('user_benchmark') || 'SPY');
```

#### 修改 `triggerUpdate` 函數：
```javascript
const triggerUpdate = async (benchmark = null) => {
  const token = getToken();
  if (!token) throw new Error("請先登入"); 
  
  // 如果有傳入標的，則更新 Store 並持久化
  const targetBenchmark = benchmark || selectedBenchmark.value;
  if (benchmark) {
    selectedBenchmark.value = benchmark;
    localStorage.setItem('user_benchmark', benchmark);
  }
  
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/trigger-update`, {
      method: "POST",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      // ✅ 關鍵：將標的傳給 Worker
      body: JSON.stringify({ benchmark: targetBenchmark })
    });
    
    if (response.ok || response.status === 204) {
      startPolling(); 
      return true; 
    }
  } catch (e) { 
    throw e; 
  }
};
```

---

### 3️⃣ **後端 API** (`cloudflare worker/worker_v2.35.js`)

#### 修改 `handleGitHubTrigger` 函數：

```javascript
async function handleGitHubTrigger(req, env, user) {
  if (!env.GITHUB_TOKEN) return jsonResponse({ error: "No Token Configured" }, 500);
  
  // ✅ 讀取 request body 中的 benchmark 參數
  let customBenchmark = 'SPY'; // 預設值
  try {
    const body = await req.json();
    if (body && body.benchmark) {
      customBenchmark = body.benchmark.toUpperCase().trim();
    }
  } catch (e) {
    // 如果沒有 body 或解析失敗，使用預設值
  }
  
  // ✅ 使用 repository_dispatch 而非 workflow_dispatch
  const ghUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`;
  
  const resp = await fetch(ghUrl, { 
    method: 'POST', 
    headers: { 
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
      'Accept': 'application/vnd.github.v3+json', 
      'User-Agent': 'Cloudflare Worker',
      'Content-Type': 'application/json'
    }, 
    body: JSON.stringify({ 
      event_type: 'trigger-update',
      client_payload: {
        custom_benchmark: customBenchmark,
        target_user_id: user.email,
        triggered_at: new Date().toISOString()
      }
    }) 
  });
  
  return jsonResponse({ 
    success: true, 
    benchmark: customBenchmark,
    message: `Triggered update with benchmark: ${customBenchmark}`
  });
}
```

---

### 4️⃣ **GitHub Actions** (`.github/workflows/update.yml`)

#### 新增事件監聽：

```yaml
on:
  schedule:
    - cron: '0 0 * * *'
  
  # ✅ 新增：支援 repository_dispatch 事件（由 Cloudflare Worker 觸發）
  repository_dispatch:
    types: [trigger-update]
  
  workflow_dispatch:
```

---

### 5️⃣ **Python 運算核心** (`main.py`)

#### 已支援讀取 `client_payload`：

```python
def get_trigger_payload():
    """從 GitHub Action 的事件檔案中讀取 Payload"""
    event_path = os.environ.get('GITHUB_EVENT_PATH')
    if event_path and os.path.exists(event_path):
        try:
            with open(event_path, 'r') as f:
                event_data = json.load(f)
                # 取得由 Worker 傳過來的 client_payload
                return event_data.get('client_payload', {})
        except Exception as e:
            print(f"解析 GitHub Event Payload 失敗: {e}")
    return {}

def main():
    # ...
    
    # 4. 讀取觸發參數 (自訂 Benchmark 與 目標使用者)
    payload = get_trigger_payload()
    custom_benchmark = payload.get('custom_benchmark', 'SPY')
    target_user_id = payload.get('target_user_id')
    
    logger.info(f"觸發參數: Benchmark={custom_benchmark}, TargetUser={target_user_id}")
    
    # ...
    
    # 使用自訂 benchmark 初始化 calculator
    calculator = PortfolioCalculator(user_df, market_client, benchmark_ticker=custom_benchmark)
```

---

## 🚀 使用流程

### 步驟 1：切換到報酬率模式
點擊圖表上方的「**報酬率**」按鈕

### 步驟 2：輸入新的基準標的
在「基準標的」輸入框中輸入，例如：
- `QQQ` - 納斯達克 100 指數
- `TQQQ` - 3倍做多納斯達克
- `0050.TW` - 元大台灣 50

### 步驟 3：確認切換
- 按 **Enter** 鍵或點擊 **✓** 按鈕
- 系統會彈出確認對話框

### 步驟 4：等待計算
- 系統會自動觸發 GitHub Actions
- 預計 1-3 分鐘完成
- 完成後圖表自動更新

### 步驟 5：查看結果
- 圖表標籤會顯示新的基準標的名稱
- 基準線會根據新標的重新繪製

---

## 🔍 數據流圖

```
[使用者輸入 QQQ]
         ↓
[前端 Vue] → benchmarkInput.value = 'QQQ'
         ↓
[觸發 handleBenchmarkChange]
         ↓
[POST /api/trigger-update]
  body: { benchmark: 'QQQ' }
         ↓
[Cloudflare Worker] → 讀取 benchmark 參數
         ↓
[GitHub API] → repository_dispatch
  client_payload: { 
    custom_benchmark: 'QQQ',
    target_user_id: 'user@example.com'
  }
         ↓
[GitHub Actions] → 觸發 workflow
         ↓
[main.py] → 讀取 GITHUB_EVENT_PATH
  payload.get('custom_benchmark') = 'QQQ'
         ↓
[PortfolioCalculator] → benchmark_ticker='QQQ'
         ↓
[下載 QQQ 歷史數據]
         ↓
[計算 benchmark_twr]
         ↓
[上傳到 D1 快照]
         ↓
[前端輪詢到更新]
         ↓
[圖表自動重繪與標籤更新]
```

---

## ⚠️ 注意事項

### 1. **標的格式**
- 美股：直接輸入代碼（例：`AAPL`）
- 台股：需加 `.TW` 後綴（例：`0050.TW`）
- 港股：需加 `.HK` 後綴（例：`0700.HK`）

### 2. **數據可用性**
- 不是所有標的都有足夠的歷史數據
- 如果標的不存在，Yahoo Finance 會回傳空數據
- 建議使用知名 ETF 或指數

### 3. **計算時間**
- 第一次使用新標的需要下載數據，耗時較長
- 後續使用相同標的會利用快取，速度較快

### 4. **持久化儲存**
- 選擇的 benchmark 會儲存在 localStorage
- 下次登入會自動套用上次的設定

---

## 📊 常用基準標的推薦

### 美股大盤 ETF
| 代碼 | 名稱 | 說明 |
|------|------|------|
| **SPY** | S&P 500 ETF | 美股大盤指標（預設） |
| **QQQ** | 納斯達克 100 | 科技股為主 |
| **DIA** | 道瓊斯 30 | 藍籌股指標 |
| **IWM** | 羅素 2000 | 小型股指標 |
| **VTI** | 全市場 ETF | 涵蓋所有美股 |

### 科技股 ETF
| 代碼 | 名稱 | 說明 |
|------|------|------|
| **TQQQ** | 3x 納斯達克 | 三倍做多科技股 |
| **SOXL** | 3x 半導體 | 三倍做多晶片股 |
| **XLK** | 科技類股 ETF | S&P 500 科技類股 |

### 台灣 ETF
| 代碼 | 名稱 | 說明 |
|------|------|------|
| **0050.TW** | 元大台灣 50 | 台股大盤指標 |
| **0056.TW** | 元大高股息 | 高配息股票 |
| **00878.TW** | 國泰永續高股息 | 新興高息 ETF |

---

## 🐛 問題排解

### Q1：輸入標的後沒有反應？
A：確認：
1. 是否按了 Enter 或點擊了✓按鈕
2. 是否在確認對話框中點擊了「確定」
3. 檢查網路連線是否正常

### Q2：圖表沒有更新？
A：計算需要時間：
1. 等待 1-3 分鐘
2. 系統會自動輪詢並更新
3. 如果超過 5 分鐘，手動刷新頁面

### Q3：基準標的不支援？
A：確認：
1. 標的格式是否正確（例：台股需加 .TW）
2. 在 Yahoo Finance 搜尋該標的是否存在
3. 嘗試使用其他知名 ETF

### Q4：計算失敗？
A：可能原因：
1. 標的數據不足（如新上市股票）
2. 標的不存在於 Yahoo Finance
3. GitHub Actions 執行錯誤（查看 Actions 日誌）

---

## 🌟 功能亮點

✅ **即時切換**：無需重新部署或修改配置檔
✅ **持久化儲存**：選擇會自動儲存在本地
✅ **多人隔離**：每個使用者可以有自己的 benchmark
✅ **智慧驗證**：防止無效輸入與誤觸發
✅ **視覺回饋**：載入狀態與成功提示
✅ **响應式設計**：手機和電腦完美適配

---

## 📝 更新記錄

### v2.35 (2026-01-19)
- ✅ 新增自訂基準標的輸入框
- ✅ 支援 repository_dispatch 事件
- ✅ Worker 傳遞 benchmark 參數
- ✅ Python 讀取 client_payload
- ✅ 圖表標籤動態顯示

---

**Built with ❤️ by chihung1024**