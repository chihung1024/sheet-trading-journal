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

# Yahoo `CUR=X` quotes are native-currency units per 1 USD.
# TWD is the cross base used to derive TWD per 1 native-currency unit:
#   TWD/native = (TWD/USD) / (native/USD)
FX_USD_QUOTE_SYMBOLS = {
    'TWD': 'TWD=X',
    'KRW': 'KRW=X',
    'HKD': 'HKD=X',
    'CNY': 'CNY=X',
    'JPY': 'JPY=X',
    # London equities are commonly quoted in GBp. Yahoo's GBP=X quote is
    # pounds per USD, so the derived TWD/GBP rate must be scaled by 0.01.
    'GBp': 'GBP=X',
    'EUR': 'EUR=X',
}

FX_NATIVE_UNIT_SCALES = {
    'KRW': 1.0,
    'HKD': 1.0,
    'CNY': 1.0,
    'JPY': 1.0,
    'GBp': 0.01,
    'EUR': 1.0,
}

# Benchmark dividend withholding tax rates (Scheme A / total-return benchmark)
BENCHMARK_TAX_RATE_US = 0.30  # 30% withholding for US ETFs/stocks
BENCHMARK_TAX_RATE_TW = 0.0   # 0% withholding for Taiwan stocks/ETFs
