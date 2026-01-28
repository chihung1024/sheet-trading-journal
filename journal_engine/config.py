import os

# ==========================================
# 設定區域 (Configuration)
# ==========================================

# Worker API URL
# [修正]: 改為從環境變數讀取 WORKER_URL，這樣 GitHub Actions 才能注入您的網址
WORKER_BASE_URL = os.environ.get('WORKER_URL', 'https://journal-backend.chired.workers.dev')

WORKER_API_URL_RECORDS = f'{WORKER_BASE_URL}/api/records'
WORKER_API_URL_PORTFOLIO = f'{WORKER_BASE_URL}/api/portfolio'

# 讀取環境變數 (GitHub Secrets)
API_KEY = os.environ.get("API_KEY", "")

# API Headers
API_HEADERS = {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json"
}

# 基礎設定
BASE_CURRENCY = 'TWD'
EXCHANGE_SYMBOL = 'TWD=X'  # 正確：直接返回 TWD per 1 USD
DEFAULT_FX_RATE = 32.0
