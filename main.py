import pandas as pd
import logging
import sys
import os
import json
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

def get_trigger_payload():
    """從 GitHub Action 的事件檔案中讀取 Payload"""
    event_path = os.environ.get('GITHUB_EVENT_PATH')
    if event_path and os.path.exists(event_path):
        try:
            with open(event_path, 'r') as f:
                event_data = json.load(f)
                # 取得由 Worker 傳過來的 client_payload
                return event_data.get('client_payload', {})
        except Exception as e:
            print(f"解析 GitHub Event Payload 失敗: {e}")
    return {}

def main():
    # 1. 初始化日誌系統
    setup_logging()
    logger = logging.getLogger("main")
    
    logger.info("=== 啟動交易日誌更新程序 (多人隔離 & 自訂基準版) ===")

    # 2. 安全性檢查
    if not API_KEY:
        logger.error("環境變數中找不到 API_KEY，請檢查 GitHub Secrets 設定。")
        return

    # 3. 初始化 Clients
    api_client = CloudflareClient()
    market_client = MarketDataClient()
    
    # 4. 讀取觸發參數 (自訂 Benchmark 與 目標使用者)
    payload = get_trigger_payload()
    custom_benchmark = payload.get('custom_benchmark', 'SPY')
    target_user_id = payload.get('target_user_id') # 若 Worker 有傳入特定的 userId
    
    logger.info(f"觸發參數: Benchmark={custom_benchmark}, TargetUser={target_user_id if target_user_id else 'ALL'}")

    # 5. 獲取交易紀錄
    logger.info("正在從 Cloudflare 獲取原始交易紀錄...")
    records = api_client.fetch_records()
    
    # [修復 BUG]：即使 records 是空的，也不能直接 return，
    # 否則最後一位使用者刪除紀錄後，舊的快照永遠不會被清空。
    df = pd.DataFrame(records) if records else pd.DataFrame()
    
    # 6. 資料前處理與分組準備
    user_list = []
    if not df.empty:
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
        user_list = df['user_id'].unique().tolist()
    
    # 如果有指定的目標使用者但他在紀錄中已不存在 (被刪光了)，也要加入處理清單以執行重置
    if target_user_id and target_user_id not in user_list:
        user_list.append(target_user_id)

    if not user_list:
        logger.warning("目前無任何待處理的使用者紀錄，程序結束。")
        return

    # 7. 下載市場數據 (包含基準標的)
    fetch_start_date = datetime.now() - timedelta(days=365*5) # 預設抓取 5 年數據以利計算
    unique_tickers = df['Symbol'].unique().tolist() if not df.empty else []
    
    # 確保 Benchmark 也被下載
    if custom_benchmark not in unique_tickers:
        unique_tickers.append(custom_benchmark)
    
    logger.info(f"開始下載全域市場數據。標的數: {len(unique_tickers)}, 基準: {custom_benchmark}")
    market_client.download_data(unique_tickers, fetch_start_date)
    
    # 8. 批次處理每位使用者
    logger.info(f"準備處理 {len(user_list)} 位使用者...")

    for user_email in user_list:
        try:
            logger.info(f"--- 正在處理使用者: {user_email} ---")
            
            # 篩選該使用者的交易紀錄
            user_df = df[df['user_id'] == user_email].copy() if not df.empty else pd.DataFrame()
            
            # [修復 BUG]：如果紀錄為空，產生「空狀態」快照以上傳覆蓋
            calculator = PortfolioCalculator(user_df, market_client, benchmark_ticker=custom_benchmark)
            user_snapshot = calculator.run()
            
            if user_snapshot:
                logger.info(f"計算完成，正在上傳 {user_email} 的快照數據 (Benchmark: {custom_benchmark})...")
                api_client.upload_portfolio(user_snapshot, target_user_id=user_email)
                logger.info(f"使用者 {user_email} 處理成功。")
            else:
                logger.warning(f"使用者 {user_email} 未能產生效快照數據。")
                
        except Exception as u_err:
            logger.error(f"處理使用者 {user_email} 時發生未預期錯誤: {u_err}")

    logger.info("=== 所有使用者處理程序執行完畢 ===")

if __name__ == "__main__":
    from datetime import datetime
    try:
        main()
    except Exception as e:
        logging.getLogger("main").exception(f"程序執行期間發生未預期錯誤: {e}")
        sys.exit(1)
