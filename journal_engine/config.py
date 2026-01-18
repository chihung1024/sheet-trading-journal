import os
from dotenv import load_dotenv

# 載入 .env 檔案 (本地開發用)
load_dotenv()

# --- Cloudflare Worker 設定 ---
WORKER_API_URL_RECORDS = os.getenv("WORKER_API_URL_RECORDS")
WORKER_API_URL_PORTFOLIO = os.getenv("WORKER_API_URL_PORTFOLIO")
API_SECRET = os.getenv("API_SECRET")

# ✅ 多用戶支援：指定計算的使用者 Email
TARGET_USER_EMAIL = os.getenv("TARGET_USER_EMAIL")

# API 請求標頭
API_HEADERS = {
    "X-API-KEY": API_SECRET,
    "Content-Type": "application/json"
}

# 若有指定目標使用者，則在 Header 中加入，讓 Worker 辨識身分
if TARGET_USER_EMAIL:
    API_HEADERS["X-TARGET-USER"] = TARGET_USER_EMAIL

# --- 市場數據設定 ---
BASE_CURRENCY = "TWD"
DEFAULT_FX_RATE = 32.5

# ✅ 補回遺漏的變數：用於抓取匯率的 Yahoo Finance 代碼
EXCHANGE_SYMBOL = "USDTWD=X"

# 支援的預設標的清單
WATCHLIST = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "AMZN", "SPY", "QQQ"]
