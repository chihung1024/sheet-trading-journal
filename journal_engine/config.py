import os
from dotenv import load_dotenv

load_dotenv()

# --- Cloudflare Worker 設定 ---
WORKER_API_URL_RECORDS = os.getenv("WORKER_API_URL_RECORDS")
WORKER_API_URL_PORTFOLIO = os.getenv("WORKER_API_URL_PORTFOLIO")
API_SECRET = os.getenv("API_SECRET")

# ✅ 新增：指定計算的使用者 Email (從 GitHub Secrets 或 .env 讀取)
# 如果是多用戶版，這個值會在 GitHub Actions 執行時動態傳入
TARGET_USER_EMAIL = os.getenv("TARGET_USER_EMAIL")

# API 請求標頭
API_HEADERS = {
    "X-API-KEY": API_SECRET,
    "Content-Type": "application/json"
}

# 若有指定目標使用者，則在 Header 中加入，讓 Worker 辨識
if TARGET_USER_EMAIL:
    API_HEADERS["X-TARGET-USER"] = TARGET_USER_EMAIL

# --- 市場數據設定 ---
BASE_CURRENCY = "TWD"
DEFAULT_FX_RATE = 32.5

# 支援的標的清單（可由 main.py 動態擴充）
WATCHLIST = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "AMZN", "SPY", "QQQ"]
