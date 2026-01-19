import pandas as pd
import logging
import sys
import os
import json
from datetime import datetime, timedelta
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
                # 取得由 Worker 透過 repository_dispatch 傳過來的 client_payload
                return event_data.get('client_payload', {})
        except Exception as e:
            print(f"解析 GitHub Event Payload 失敗: {e}")
    return {}

def main():
    # 1. 初始化日誌系統
    setup_logging()
    logger = logging.getLogger("main")
    
    logger.info("=== 啟動交易日誌更新程序 (0至1自動觸發版) ===")

    # 2. 安全性檢查
    # 優先嘗試從 config 讀取，若無則嘗試從環境變數 API_SECRET 讀取 (相容 YAML 設定)
    actual_api_key = API_KEY or os.environ.get("API_SECRET")
    if not actual_api_key:
        logger.error("環境變數中找不到 API 金鑰，請檢查 GitHub Secrets (API_SECRET) 設定。")
        return

    # 3. 初始化 Clients
    api_client = CloudflareClient()
    market_client = MarketDataClient()
    
    # 4. 讀取觸發參數 (自訂 Benchmark 與 目標使用者)
    payload = get_trigger_payload()
    custom_benchmark = payload.get('custom_benchmark', 'SPY')
    target_user_id = payload.get('target_user_id') # Worker 傳入的特定使用者 Email
    
    logger.info(f"觸發參數: Benchmark={custom_benchmark}, TargetUser={target_user_id if target_user_id else 'ALL'}")

    # 5. 獲取交易紀錄
    logger.info("正在從 Cloudflare 獲取原始交易紀錄...")
    records = api_client.fetch_records()
    
    # 將原始資料轉換為 DataFrame
    df = pd.DataFrame(records) if records else pd.DataFrame()
    
    # 6. 資料前處理與分組準備
    user_list = []
    if not df.empty:
        if 'user_id' not in df.columns:
            logger.error("交易紀錄中缺少 user_id 欄位，請檢查 API 回傳內容。")
            return

        # 統一欄位名稱以符合計算引擎要求
        df.rename(columns={
            'txn_date': 'Date', 'symbol': 'Symbol', 'txn_type': 'Type', 
            'qty': 'Qty', 'price': 'Price', 'fee': 'Commission', 
            'tax': 'Tax', 'tag': 'Tag'
        }, inplace=True)
        
        # 轉換資料型態
        df['Date'] = pd.to_datetime(df['Date'])
        df['Qty'] = pd.to_numeric(df['Qty'])
        df['Price'] = pd.to_numeric(df['Price'])
        df['Commission'] = pd.to_numeric(df['Commission'].fillna(0))
        df['Tax'] = pd.to_numeric(df['Tax'].fillna(0)) 
        df = df.sort_values('Date')
        
        # 獲取所有使用者清單
        user_list = df['user_id'].unique().tolist()
    
    # 關鍵邏輯：如果 Worker 指定了目標使用者，但資料庫中已無紀錄 (例如剛刪除最後一筆)
    # 我們仍需將其加入清單，以便產生「空快照」來覆蓋舊數據
    if target_user_id and target_user_id not in user_list:
        user_list.append(target_user_id)

    if not user_list:
        logger.warning("目前無任何待處理的使用者紀錄，程序結束。")
        return

    # 7. 下載市場數據
    # 根據需求抓取最近 5 年數據
    fetch_start_date = datetime.now() - timedelta(days=365*5) 
    unique_tickers = df['Symbol'].unique().tolist() if not df.empty else []
    
    # 確保基準標的 (如 SPY) 也在下載清單中
    if custom_benchmark not in unique_tickers:
        unique_tickers.append(custom_benchmark)
    
    logger.info(f"開始下載全域市場數據。標的數: {len(unique_tickers)}, 基準: {custom_benchmark}")
    market_client.download_data(unique_tickers, fetch_start_date)
    
    # 8. 批次處理每位使用者
    # 如果有 target_user_id，則只處理該位使用者，以節省資源並加速反應
    users_to_process = [target_user_id] if target_user_id else user_list
    
    logger.info(f"準備處理 {len(users_to_process)} 位使用者的數據...")

    for user_email in users_to_process:
        try:
            logger.info(f"--- 正在計算使用者: {user_email} ---")
            
            # 篩選該使用者的交易紀錄
            user_df = df[df['user_id'] == user_email].copy() if not df.empty else pd.DataFrame()
            
            # 初始化計算引擎
            calculator = PortfolioCalculator(user_df, market_client, benchmark_ticker=custom_benchmark)
            user_snapshot = calculator.run()
            
            if user_snapshot:
                logger.info(f"計算完成，正在上傳 {user_email} 的快照數據...")
                # 上傳時需帶入 target_user_id，讓 Worker 知道這份快照屬於誰
                api_client.upload_portfolio(user_snapshot, target_user_id=user_email)
                logger.info(f"使用者 {user_email} 更新成功。")
            else:
                logger.warning(f"使用者 {user_email} 的計算結果為空，跳過上傳。")
                
        except Exception as u_err:
            logger.error(f"處理使用者 {user_email} 時發生錯誤: {u_err}")

    logger.info("=== 所有使用者處理程序執行完畢 ===")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logging.getLogger("main").exception(f"程序執行期間發生未預期錯誤: {e}")
        sys.exit(1)
