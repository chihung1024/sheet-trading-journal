import os

# ==========================================
# 交易日誌系統配置 (Configuration)
# ==========================================

# 1. Cloudflare Worker 連線設定
# 優先從環境變數讀取 WORKER_URL，若無則使用預設值
WORKER_BASE_URL = os.environ.get('WORKER_URL', 'https://journal-backend.chired.workers.dev')

# 自動生成的 API 端點路徑
WORKER_API_URL_RECORDS = f'{WORKER_BASE_URL}/api/records'
WORKER_API_URL_PORTFOLIO = f'{WORKER_BASE_URL}/api/portfolio'

# 2. 安全驗證設定
# 讀取 GitHub Secrets 中定義的金鑰
# 兼容兩種常見命名方式：API_KEY 或 API_SECRET
API_KEY = os.environ.get("API_KEY") or os.environ.get("API_SECRET") or ""

# 3. HTTP 請求標頭
# 確保每次與 Worker 通訊時都帶上正確的驗證金鑰
API_HEADERS = {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json"
}

# 4. 計算引擎基礎設定
# 預設顯示貨幣
BASE_CURRENCY = 'TWD'

# Yahoo Finance 匯率標的 (美金對台幣)
EXCHANGE_SYMBOL = 'USDTWD=X'

# 預備匯率 (當 API 無法取得即時匯率時的後備方案)
DEFAULT_FX_RATE = 32.0

# 日誌級別
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
