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
    
    # [改善方案]：不再因為 records 為空就結束，因為我們可能需要處理「剛刪除所有紀錄」的使用者
    if not records:
        logger.info("目前資料庫中無任何交易紀錄，將檢查是否需要清理過期快照。")

    # 5. 資料前處理
    if records:
        df = pd.DataFrame(records)
    else:
        # 建立具備欄位結構的空 DataFrame，避免後續處理出錯
        df = pd.DataFrame(columns=[
            'user_id', 'txn_date', 'symbol', 'txn_type', 
            'qty', 'price', 'fee', 'tax', 'tag'
        ])
    
    # 統一欄位名稱與型態
    df.rename(columns={
        'txn_date': 'Date', 'symbol': 'Symbol', 'txn_type': 'Type', 
        'qty': 'Qty', 'price': 'Price', 'fee': 'Commission', 
        'tax': 'Tax', 'tag': 'Tag'
    }, inplace=True)
    
    df['Date'] = pd.to_datetime(df['Date'])
    df['Qty'] = pd.to_numeric(df['Qty'], errors='coerce')
    df['Price'] = pd.to_numeric(df['Price'], errors='coerce')
    df['Commission'] = pd.to_numeric(df['Commission'].fillna(0), errors='coerce')
    df['Tax'] = pd.to_numeric(df['Tax'].fillna(0), errors='coerce') 
    df = df.sort_values('Date')
    
    # 6. 下載市場數據 (僅在有標的時執行)
    if not df.empty:
        start_date = df['Date'].min()
        fetch_start_date = start_date - timedelta(days=100)
        unique_tickers = df['Symbol'].dropna().unique().tolist()
        
        if unique_tickers:
            logger.info(f"開始下載全域市場數據。最早交易日: {start_date.date()}, 標的數: {len(unique_tickers)}")
            market_client.download_data(unique_tickers, fetch_start_date)
    
    # ==========================================
    # [關鍵修改] 核心計算：整合「紀錄」與「快照」使用者清單
    # ==========================================
    
    # 獲取所有需要處理的使用者 (包含有交易的人，以及目前已有快照的人)
    users_with_records = set(df['user_id'].unique()) if 'user_id' in df.columns else set()
    
    # 呼叫 api_client 新增的 fetch_active_users 方法 (將在下一個檔案提供)
    users_with_snapshots = set(api_client.fetch_active_users())
    
    # 取聯集，確保「剛刪除所有紀錄」的人也會被處理到
    user_list = sorted(list(users_with_records.union(users_with_snapshots)))
    
    logger.info(f"偵測到需維護的使用者共 {len(user_list)} 位，開始批次處理...")

    for user_email in user_list:
        try:
            logger.info(f"--- 正在處理使用者: {user_email} ---")
            
            # 篩選該使用者的交易紀錄 (若已刪除則會是空 DF)
            user_df = df[df['user_id'] == user_email].copy() if not df.empty else pd.DataFrame()
            
            # 執行計算 (若 user_df 為空，Calculator 將產出「重置快照」)
            calculator = PortfolioCalculator(user_df, market_client)
            user_snapshot = calculator.run()
            
            if user_snapshot:
                logger.info(f"正在上傳 {user_email} 的快照數據 (包含清理狀態)...")
                api_client.upload_portfolio(user_snapshot, target_user_id=user_email)
                logger.info(f"使用者 {user_email} 處理/重置成功。")
            else:
                logger.warning(f"使用者 {user_email} 處理失敗，未產生快照。")
                
        except Exception as u_err:
            logger.error(f"處理使用者 {user_email} 時發生未預期錯誤: {u_err}")

    logger.info("=== 所有使用者處理程序執行完畢 ===")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logging.getLogger("main").exception(f"程序執行期間發生未預期錯誤: {e}")
        sys.exit(1)
