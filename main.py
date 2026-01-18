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
    
    logger.info("=== 啟動交易日誌更新程序 (多人隔離版) ===")

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
        logger.warning("資料庫中無任何交易紀錄，程序結束。")
        return

    # 5. 資料前處理
    df = pd.DataFrame(records)
    
    # 檢查是否有 user_id 欄位以進行分組
    if 'user_id' not in df.columns:
        logger.error("交易紀錄中缺少 user_id 欄位，請檢查 API 回傳內容。")
        return

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
    
    # 6. 下載市場數據 (維持全域下載以優化 API 呼叫效能)
    if not df.empty:
        start_date = df['Date'].min()
        fetch_start_date = start_date - timedelta(days=100)
        unique_tickers = df['Symbol'].unique().tolist()
        
        logger.info(f"開始下載全域市場數據。最早交易日: {start_date.date()}, 標的數: {len(unique_tickers)}")
        market_client.download_data(unique_tickers, fetch_start_date)
    
    # ==========================================
    # [關鍵修改] 核心計算：針對每位使用者分別處理
    # ==========================================
    
    # 取得所有有交易紀錄的使用者 ID 清單
    user_list = df['user_id'].unique()
    logger.info(f"偵測到 {len(user_list)} 位使用者，開始批次處理...")

    for user_email in user_list:
        try:
            logger.info(f"--- 正在處理使用者: {user_email} ---")
            
            # 1. 篩選該使用者的交易紀錄
            user_df = df[df['user_id'] == user_email].copy()
            
            if user_df.empty:
                logger.info(f"使用者 {user_email} 無效紀錄，跳過。")
                continue

            # 2. 計算該使用者的投資組合快照
            calculator = PortfolioCalculator(user_df, market_client)
            user_snapshot = calculator.run()
            
            if user_snapshot:
                # 3. 指定 target_user_id 並上傳結果
                logger.info(f"計算完成，正在上傳 {user_email} 的快照數據...")
                api_client.upload_portfolio(user_snapshot, target_user_id=user_email)
                logger.info(f"使用者 {user_email} 處理成功。")
            else:
                logger.warning(f"使用者 {user_email} 核心計算失敗，未產生快照。")
                
        except Exception as u_err:
            logger.error(f"處理使用者 {user_email} 時發生未預期錯誤: {u_err}")

    logger.info("=== 所有使用者處理程序執行完畢 ===")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logging.getLogger("main").exception(f"程序執行期間發生未預期錯誤: {e}")
        sys.exit(1)
