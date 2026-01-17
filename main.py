import pandas as pd
import logging
import sys
import os
from datetime import timedelta
from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.config import API_KEY

def setup_logging():
    """設定標準日誌格式"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

def main():
    # 1. 初始化日誌系統
    setup_logging()
    logger = logging.getLogger("main")
    
    logger.info("=== 啟動交易日誌更新程序 ===")

    # 2. 安全性檢查
    if not API_KEY:
        logger.error("環境變數中找不到 API_KEY，請檢查 GitHub Secrets 設定。")
        return

    # 3. 初始化 Clients
    api_client = CloudflareClient()
    market_client = MarketDataClient()
    
    # 4. 獲取交易紀錄
    logger.info("正在從 Cloudflare 獲取原始交易紀錄...")
    records = api_client.fetch_records()
    if not records:
        logger.warning("資料庫中無任何交易紀錄，程式結束。")
        return

    # 5. 資料前處理
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
    
    # 6. 下載市場數據
    if not df.empty:
        start_date = df['Date'].min()
        fetch_start_date = start_date - timedelta(days=100)
        unique_tickers = df['Symbol'].unique().tolist()
        
        logger.info(f"開始下載市場數據。最早交易日: {start_date.date()}, 標的數: {len(unique_tickers)}")
        market_client.download_data(unique_tickers, fetch_start_date)
    
    # 7. 核心計算
    calculator = PortfolioCalculator(df, market_client)
    final_snapshot = calculator.run()
    
    if final_snapshot:
        # 8. 上傳結果
        logger.info("計算完成，正在將投資組合快照上傳至 Cloudflare...")
        api_client.upload_portfolio(final_snapshot)
        logger.info("=== 程序執行成功 ===")
    else:
        logger.error("核心計算失敗，未上傳任何數據。")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logging.getLogger("main").exception(f"程序執行期間發生未預期錯誤: {e}")
        sys.exit(1)
