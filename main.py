import pandas as pd
import logging
import sys
import os
import json
from datetime import timedelta, datetime
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

def get_benchmark_from_env():
    """
    從環境變數讀取 CUSTOM_BENCHMARK
    優先序：
    1. CUSTOM_BENCHMARK 環境變數 (workflow_dispatch inputs)
    2. 預設值 SPY
    """
    custom_benchmark = os.environ.get('CUSTOM_BENCHMARK', 'SPY').strip().upper()
    target_user_id = os.environ.get('TARGET_USER_ID', '').strip()
    
    return custom_benchmark, target_user_id

def main():
    # 1. 初始化日誌系統
    setup_logging()
    logger = logging.getLogger("main")
    
    logger.info("=== 啟動交易日誌更新程序 (v2.54 用戶專屬 benchmark 版) ===")

    # 2. 安全性檢查
    if not API_KEY:
        logger.error("環境變數中找不到 API_KEY，請檢查 GitHub Secrets 設定。")
        return

    # 3. 初始化 Clients
    api_client = CloudflareClient()
    market_client = MarketDataClient()
    
    # 4. 從環境變數讀取 benchmark 與目標使用者
    fallback_benchmark, target_user_id = get_benchmark_from_env()
    
    logger.info(f"觸發參數: Fallback Benchmark={fallback_benchmark}, TargetUser={target_user_id if target_user_id else 'ALL'}")

    # 5. 獲取交易紀錄
    logger.info("正在從 Cloudflare 獲取原始交易紀錄...")
    records = api_client.fetch_records()
    
    df = pd.DataFrame(records) if records else pd.DataFrame()
    
    # 6. 資料前處理與分組準備
    user_list = []
    if not df.empty:
        if 'user_id' not in df.columns:
            logger.error("交易紀錄中缺少 user_id 欄位，請檢查 API 回傳內容。")
            return
        
        # [v2.53 修復] 確保 'id' 欄位被保留
        logger.info(f"[v2.53] API 回傳欄位: {list(df.columns)}")
        
        if 'id' not in df.columns:
            logger.warning("[v2.53] 警告：API 回傳的資料中缺少 'id' 欄位，重複檢測功能將無法使用！")
        else:
            logger.info(f"[v2.53] ✓ 確認 'id' 欄位存在，共 {len(df)} 筆記錄")

        # 重命名欄位（保留 id, user_id 等其他欄位）
        df.rename(columns={
            'txn_date': 'Date', 
            'symbol': 'Symbol', 
            'txn_type': 'Type', 
            'qty': 'Qty', 
            'price': 'Price', 
            'fee': 'Commission', 
            'tax': 'Tax', 
            'tag': 'Tag'
        }, inplace=True)
        
        # [v2.53] 確認 rename 後 'id' 仍然存在
        if 'id' in df.columns:
            logger.info(f"[v2.53] ✓ rename 後 'id' 欄位保留成功")
            div_records = df[df['Type'] == 'DIV']
            if not div_records.empty:
                logger.info(f"[v2.53] DIV 記錄數量: {len(div_records)}, ID 範圍: {div_records['id'].min()} - {div_records['id'].max()}")
        else:
            logger.error("[v2.53] ✗ rename 後 'id' 欄位消失！重複檢測將失敗！")
        
        df['Date'] = pd.to_datetime(df['Date'])
        df['Qty'] = pd.to_numeric(df['Qty'])
        df['Price'] = pd.to_numeric(df['Price'])
        df['Commission'] = pd.to_numeric(df['Commission'].fillna(0))
        df['Tax'] = pd.to_numeric(df['Tax'].fillna(0)) 
        df = df.sort_values('Date')
        user_list = df['user_id'].unique().tolist()
    
    if target_user_id and target_user_id not in user_list:
        user_list.append(target_user_id)

    if not user_list:
        logger.warning("目前無任何待處理的使用者紀錄，程序結束。")
        return

    # 7. [v2.54] 收集所有用戶的 benchmark 與股票代碼
    logger.info(f"正在收集 {len(user_list)} 位用戶的 benchmark 設定...")
    user_benchmarks = {}
    all_tickers = set(df['Symbol'].unique().tolist() if not df.empty else [])
    
    for user_email in user_list:
        user_benchmark = api_client.get_user_benchmark(user_email)
        if not user_benchmark or user_benchmark == 'SPY':
            user_benchmark = fallback_benchmark
        user_benchmarks[user_email] = user_benchmark
        all_tickers.add(user_benchmark)
        logger.info(f"用戶 {user_email} 使用 benchmark: {user_benchmark}")
    
    # 8. 動態計算數據抓取起始日期
    if not df.empty:
        earliest_transaction_date = df['Date'].min()
        fetch_start_date = earliest_transaction_date - timedelta(days=90)
        logger.info(f"最早交易日期: {earliest_transaction_date.strftime('%Y-%m-%d')}")
        logger.info(f"數據抓取起始日期: {fetch_start_date.strftime('%Y-%m-%d')} (往前推 3 個月)")
    else:
        fetch_start_date = datetime.now() - timedelta(days=90)
        logger.info(f"無交易紀錄，預設抓取起始日期: {fetch_start_date.strftime('%Y-%m-%d')}")
    
    logger.info(f"開始下載全域市場數據。標的數: {len(all_tickers)}")
    market_client.download_data(list(all_tickers), fetch_start_date)
    
    # 9. [v2.54] 批次處理每位使用者，使用各自的 benchmark
    logger.info(f"準備處理 {len(user_list)} 位使用者...")

    for user_email in user_list:
        try:
            # [v2.54] 獲取該用戶的專屬 benchmark
            user_benchmark = user_benchmarks.get(user_email, fallback_benchmark)
            
            logger.info(f"--- 正在處理使用者: {user_email} (Benchmark: {user_benchmark}) ---")
            
            user_df = df[df['user_id'] == user_email].copy() if not df.empty else pd.DataFrame()
            
            # [v2.53] 確認用戶資料中的 id 欄位
            if not user_df.empty and 'id' in user_df.columns:
                logger.info(f"[v2.53] 用戶 {user_email} 的資料包含 'id' 欄位，共 {len(user_df)} 筆記錄")
            
            # [v2.54] 使用用戶專屬的 benchmark
            calculator = PortfolioCalculator(
                user_df, 
                market_client, 
                benchmark_ticker=user_benchmark,  # ← 使用用戶專屬 benchmark
                api_client=api_client
            )
            user_snapshot = calculator.run()
            
            if user_snapshot:
                logger.info(f"計算完成，正在上傳 {user_email} 的快照數據 (Benchmark: {user_benchmark})...")
                api_client.upload_portfolio(user_snapshot, target_user_id=user_email)
                logger.info(f"使用者 {user_email} 處理成功。")
            else:
                logger.warning(f"使用者 {user_email} 未能產生有效快照數據。")
                
        except Exception as u_err:
            logger.error(f"處理使用者 {user_email} 時發生未預期錯誤: {u_err}")
            logger.exception(u_err)

    logger.info("=== 所有使用者處理程序執行完畢 ===")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logging.getLogger("main").exception(f"程序執行期間發生未預期錯誤: {e}")
        sys.exit(1)