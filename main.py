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
    
    logger.info("=== 啟動交易日誌更新程序 (多使用者版) ===")

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
    
    # 欄位重新命名以符合計算引擎需求
    df.rename(columns={
        'txn_date': 'Date', 'symbol': 'Symbol', 'txn_type': 'Type', 
        'qty': 'Qty', 'price': 'Price', 'fee': 'Commission', 
        'tax': 'Tax', 'tag': 'Tag'
    }, inplace=True)
    
    # 資料型態轉換
    df['Date'] = pd.to_datetime(df['Date'])
    df['Qty'] = pd.to_numeric(df['Qty'])
    df['Price'] = pd.to_numeric(df['Price'])
    df['Commission'] = pd.to_numeric(df['Commission'].fillna(0))
    df['Tax'] = pd.to_numeric(df['Tax'].fillna(0)) 
    
    # 依照日期排序，確保計算順序正確
    df = df.sort_values('Date')
    
    # 6. 下載市場數據 (維持全域下載)
    # 即使是多使用者，熱門標的(如 NVDA, TSM)通常是重疊的，一次下載效率最高
    if not df.empty:
        start_date = df['Date'].min()
        fetch_start_date = start_date - timedelta(days=100)
        unique_tickers = df['Symbol'].unique().tolist()
        
        logger.info(f"開始下載市場數據。最早交易日: {start_date.date()}, 全域標的數: {len(unique_tickers)}")
        market_client.download_data(unique_tickers, fetch_start_date)
    
    # ==========================================
    # 7. 核心計算：按使用者分組計算 (User-based Loop)
    # ==========================================
    
    # 取得所有有交易紀錄的使用者 ID (Email)
    # 檢查是否有 user_id 欄位 (相容性檢查)
    if 'user_id' in df.columns:
        user_ids = df['user_id'].dropna().unique()
    else:
        logger.warning("未偵測到 user_id 欄位，將視為單一系統使用者 system 處理")
        user_ids = ['system']

    logger.info(f"偵測到 {len(user_ids)} 位使用者，開始批次處理...")

    for user_email in user_ids:
        try:
            logger.info(f"--- 正在處理使用者: {user_email} ---")
            
            # 7-1. 篩選：只取該使用者的交易紀錄
            # 使用 copy() 避免污染原始資料
            if 'user_id' in df.columns:
                user_df = df[df['user_id'] == user_email].copy()
            else:
                user_df = df.copy()

            if user_df.empty:
                logger.info(f"使用者 {user_email} 無有效交易紀錄，跳過。")
                continue

            # 7-2. 計算：產出該使用者的專屬快照
            calculator = PortfolioCalculator(user_df, market_client)
            user_snapshot = calculator.run()
            
            if user_snapshot:
                # 7-3. 上傳：指定 target_user_id，讓 Worker 知道這份資料是誰的
                api_client.upload_portfolio(user_snapshot, target_user_id=user_email)
            else:
                logger.warning(f"使用者 {user_email} 計算後無有效數據 (可能是空倉或資料不足)")

        except Exception as u_err:
            logger.error(f"處理使用者 {user_email} 時發生錯誤: {u_err}")
            # 發生錯誤時跳過此人，繼續處理下一位，確保整體流程不中斷
            continue

    logger.info("=== 所有使用者處理程序執行完畢 ===")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logging.getLogger("main").exception(f"程序執行期間發生未預期錯誤: {e}")
        sys.exit(1)
