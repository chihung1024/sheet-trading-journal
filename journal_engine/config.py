import os

# ==========================================
# 設定區域 (Configuration)
# ==========================================

# Worker API URL
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
EXCHANGE_SYMBOL = 'TWD=X'  # Yahoo: TWD per 1 USD
DEFAULT_FX_RATE = 32.0

# Benchmark dividend withholding tax rates (Scheme A / total-return benchmark)
BENCHMARK_TAX_RATE_US = 0.30  # 30% withholding for US ETFs/stocks
BENCHMARK_TAX_RATE_TW = 0.0   # 0% withholding for Taiwan stocks/ETFs
