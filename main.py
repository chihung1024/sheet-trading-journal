import os
import sys
import argparse
import logging
from datetime import datetime
from journal_engine.clients.api_client import APIClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.calculator import PortfolioCalculator

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def main():
    """
    Portfolio Update Engine (v20260119 穩定版)
    核心功能：抓取交易紀錄、計算績效指標、推送更新快照
    """
    # 1. 參數解析
    parser = argparse.ArgumentParser(description="Trading Journal Calculation Engine")
    parser.add_argument("--benchmark", type=str, default="SPY", help="Benchmark ticker (default: SPY)")
    args = parser.parse_args()

    # 2. 環境變數檢查
    api_secret = os.getenv("API_SECRET")
    if not api_secret:
        logger.error("❌ 缺少環境變數 API_SECRET，請在 GitHub Secrets 中設定。")
        sys.exit(1)

    # 3. 初始化客戶端
    api_client = APIClient(secret=api_secret)
    market_data = MarketDataClient()
    
    logger.info(f"🚀 啟動計算引擎 | 基準標的: {args.benchmark}")

    try:
        # 4. 取得系統使用者清單
        users = api_client.get_users()
        if not users:
            logger.warning("⚠️ 系統中目前無使用者。")
            return

        # 5. 迭代處理每一位使用者的投資組合
        for user_email in users:
            logger.info(f"--- 處理使用者: {user_email} ---")
            
            try:
                # 取得交易紀錄
                records = api_client.get_records(user_email)
                
                # ✅ [核心修正]: 處理零紀錄情況
                if not records:
                    logger.info(f"ℹ️ 使用者 {user_email} 目前無交易紀錄，正在推送空快照以清理舊數據。")
                    empty_snapshot = {
                        "summary": {
                            "total_value": 0,
                            "invested_capital": 0,
                            "total_pnl": 0,
                            "realized_pnl": 0,
                            "twr": 0,
                            "xirr": 0
                        },
                        "holdings": [],
                        "history": [],
                        "pending_dividends": [],
                        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M")
                    }
                    api_client.upload_portfolio(user_email, empty_snapshot)
                    continue

                # 6. 執行核心計算
                calculator = PortfolioCalculator(
                    records=records, 
                    market_client=market_data,
                    benchmark_symbol=args.benchmark
                )
                
                # 執行計算並取得結果物件
                portfolio_data = calculator.run()
                
                if portfolio_data:
                    # 7. 回傳結果至 Worker API
                    success = api_client.upload_portfolio(user_email, portfolio_data)
                    if success:
                        logger.info(f"✅ 使用者 {user_email} 快照更新成功。")
                else:
                    logger.error(f"❌ 使用者 {user_email} 計算失敗。")

            except Exception as e:
                logger.error(f"❌ 處理使用者 {user_email} 時發生異常: {str(e)}")
                continue # 繼續處理下一個使用者

        logger.info("🏁 所有使用者處理完畢。")

    except Exception as e:
        logger.error(f"💥 引擎運行發生嚴重錯誤: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
