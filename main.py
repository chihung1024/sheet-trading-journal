import pandas as pd
import logging
import sys
import os
from datetime import timedelta
from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.config import API_SECRET, TARGET_USER_EMAIL

def setup_logging():
    """設定標準日誌格式"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        handlers=[logging.StreamHandler(sys.stdout)]
    )

def main():
    setup_logging()
    logger = logging.getLogger("main")
    
    logger.info("=== 啟動交易日誌更新程序 ===")

    # ✅ 安全檢查：確保知道是幫誰計算
    if not TARGET_USER_EMAIL:
        logger.error("環境變數中找不到 TARGET_USER_EMAIL。請在 GitHub Secrets 中設定。")
        return

    if not API_SECRET:
        logger.error("環境變數中找不到 API_SECRET。")
        return

    logger.info(f"執行目標使用者: {TARGET_USER_EMAIL}")

    # 初始化 Clients
    api_client = CloudflareClient()
    market_client = MarketDataClient()
    
    # 獲取特定使用者的交易紀錄
    logger.info(f"正在從 Cloudflare 獲取 {TARGET_USER_EMAIL} 的原始紀錄...")
    records = api_client.fetch_records()
    
    if not records:
        logger.warning(f"使用者 {TARGET_USER_EMAIL} 無任何交易紀錄，跳過後續計算。")
        return

    # 資料前處理
    df = pd.DataFrame(records)
    df.rename(columns={
        'txn_date': 'Date', 'symbol': 'Symbol', 'txn_type': 'Type', 
        'qty': 'Qty', 'price': 'Price', 'fee': 'Commission', 
        'tax': 'Tax', 'tag': 'Tag'
    }, inplace=True)
    
    df['Date'] = pd.to_datetime(df['Date'])
    df['Qty'] = pd.to_numeric(df['Qty'])
    df['Price'] = pd.to_numeric(df['Price'])
    df['Commission'] = pd.to_numeric(df['Commission'].fillna(0))
    df['Tax'] = pd.to_numeric(df['Tax'].fillna(0)) 
    df = df.sort_values('Date')
    
    # 下載市場數據
    start_date = df['Date'].min()
    fetch_start_date = start_date - timedelta(days=100)
    unique_tickers = df['Symbol'].unique().tolist()
    
    logger.info(f"開始下載數據。標的數: {len(unique_tickers)}")
    market_client.download_data(unique_tickers, fetch_start_date)
    
    # 核心計算
    calculator = PortfolioCalculator(df, market_client)
    final_snapshot = calculator.run()
    
    if final_snapshot:
        # 上傳結果（會自動標記為 TARGET_USER_EMAIL）
        logger.info("計算完成，上傳快照中...")
        api_client.upload_portfolio(final_snapshot)
        logger.info("=== 程序執行成功 ===")
    else:
        logger.error("計算失敗，未上傳。")

if __name__ == "__main__":
    main()
