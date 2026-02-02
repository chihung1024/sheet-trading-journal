import os
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

class Config:
    """專案全域配置類別"""
    
    # --- 核心路徑配置 ---
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # --- GitHub / 資料源配置 ---
    # 儲存交易紀錄的 CSV 檔案名稱 (位於 GitHub Repository)
    CSV_FILENAME = os.getenv("CSV_FILENAME", "trading_journal.csv")
    
    # --- Cloudflare / API 配置 ---
    # Cloudflare KV 儲存用的 API Token 與 Account ID
    CF_API_TOKEN = os.getenv("CF_API_TOKEN")
    CF_ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID")
    CF_KV_NAMESPACE_ID = os.getenv("CF_KV_NAMESPACE_ID")
    
    # 部署環境名稱 (例如: production, staging)
    ENV = os.getenv("ENV", "production")
    
    # --- 金融計算配置 ---
    # 基準幣別 (預設為台幣 TWD)
    BASE_CURRENCY = "TWD"
    
    # 預設美金對台幣匯率 (當 API 抓取失敗時的備援值)
    DEFAULT_FX_RATE = 32.0
    
    # ✅ 新增：資產淨值法 (NAV) 計算開關
    NAV_CALC_ENABLED = True
    
    # ✅ 新增：匯率數據過期閾值 (秒)
    # 預設 3600 秒 (1 小時)，若匯率數據早於此時間則視為過時，需重新抓取
    FX_STALE_THRESHOLD = int(os.getenv("FX_STALE_THRESHOLD", 3600))
    
    # --- 市場時段配置 ---
    # 台股與美股的開盤/收盤時間設定 (UTC+8)
    MARKET_HOURS = {
        "TW": {"open": "09:00", "close": "13:30"},
        "US": {"open": "21:30", "close": "04:00"}  # 考慮冬令時間，邏輯由 detector 處理
    }

    @classmethod
    def validate(cls):
        """驗證必要配置是否存在"""
        required_vars = ["CF_API_TOKEN", "CF_ACCOUNT_ID", "CF_KV_NAMESPACE_ID"]
        missing = [var for var in required_vars if not getattr(cls, var)]
        if missing:
            print(f"⚠️ 警告: 缺少必要環境變數: {', '.join(missing)}")
            return False
        return True

# 執行驗證
Config.validate()
