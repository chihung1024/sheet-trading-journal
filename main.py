import pandas as pd
import logging
import os
import sys
from datetime import datetime

# 導入專案模組
from journal_engine.config import Config
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.clients.api_client import APIClient
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.market_stage_detector import get_market_detector
from journal_engine.core.validator import PortfolioValidator

# 配置全域日誌格式
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def main():
    """
    [v14.0] 交易紀錄處理與資產淨值 (NAV) 更新主程式
    執行流：環境驗證 -> 讀取紀錄 -> 下載數據 -> NAV核心計算 -> 數據校驗 -> 雲端同步
    """
    logger.info("=" * 60)
    logger.info("🚀 [Main] 啟動自動化更新流程 (v14.0 Asset Value Approach)")
    logger.info("=" * 60)

    # 1. 基礎環境與配置驗證
    if not Config.validate():
        logger.error("❌ 配置錯誤或缺少必要環境變數，程式終止。")
        sys.exit(1)

    # 2. 顯示當前市場時段狀態 (Debug 用)
    detector = get_market_detector()
    detector.log_current_status()

    try:
        # 3. 讀取交易紀錄 CSV 檔案
        csv_path = Config.CSV_FILENAME
        if not os.path.exists(csv_path):
            logger.error(f"❌ 找不到交易紀錄檔案: {csv_path}")
            return
        
        logger.info(f"📂 正在讀取交易紀錄: {csv_path}")
        # 讀取並確保日期欄位解析正確
        df = pd.read_csv(csv_path)
        if df.empty:
            logger.warning("⚠️ 交易紀錄為空，跳過本次計算更新。")
            return

        df['Date'] = pd.to_datetime(df['Date'])

        # 4. 初始化客戶端
        market_client = MarketDataClient()
        api_client = APIClient()

        # 5. 彙整標的清單並啟動市場數據下載
        # 包含所有交易過的 Symbol，並強制加入 Benchmark (SPY)
        symbols = list(df['Symbol'].unique())
        if "SPY" not in symbols:
            symbols.append("SPY")
        
        # 設定下載起始日：最早交易日的前一個月 (確保基準日 T0 資料充足)
        start_date = (df['Date'].min() - pd.Timedelta(days=31)).strftime('%Y-%m-%d')
        market_client.download_data(symbols, start_date)

        # 6. 執行計算引擎 (核心 NAV 邏輯)
        calculator = PortfolioCalculator(
            transactions_df=df,
            market_client=market_client,
            benchmark_ticker="SPY",
            api_client=api_client
        )
        
        logger.info("🧮 正在執行投資組合市值重估與損益計算...")
        snapshot = calculator.run()

        # 7. 數據校驗：最後的安全保險
        # 在資產價值法下，任何數據源異常都可能導致市值錯誤跳動，上傳前必須通過檢核
        validator = PortfolioValidator()
        if not validator.run_all_checks(snapshot.summary, snapshot.holdings):
            logger.error("❌ 數據一致性校驗失敗！為防止雲端報表數據出錯，已封鎖本次上傳流程。")
            return

        # 8. 同步至 Cloudflare KV
        logger.info("☁️ 正在將計算結果上傳至 Cloudflare KV...")
        success = api_client.upload_snapshot(snapshot)
        
        if success:
            logger.info("=" * 60)
            logger.info(f"✅ 投資組合更新成功！")
            logger.info(f"   更新時間: {snapshot.updated_at}")
            logger.info(f"   目前匯率基準: {snapshot.summary.daily_pnl_curr_fx:.4f}")
            logger.info(f"   當日資產變動: ${snapshot.summary.daily_pnl_twd:,.0f} TWD")
            logger.info("=" * 60)
        else:
            logger.error("❌ 上傳過程中發生錯誤。")

    except Exception as e:
        logger.exception(f"💥 程式執行失敗，捕捉到未預期異常: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
