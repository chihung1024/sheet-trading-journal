import logging
import os
import sys
from datetime import datetime, timedelta
import inspect

import pandas as pd

from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.config import API_KEY


def setup_logging():
    """設定標準日誌格式"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def get_benchmark_from_env():
    """
    從環境變數讀取 CUSTOM_BENCHMARK
    優先序：
      1) CUSTOM_BENCHMARK (workflow_dispatch inputs)
      2) 預設值 SPY
    """
    custom_benchmark = os.environ.get("CUSTOM_BENCHMARK", "SPY").strip().upper()
    target_user_id = os.environ.get("TARGET_USER_ID", "").strip()
    return custom_benchmark, target_user_id


def _build_calculator(user_df, market_client, user_benchmark, api_client):
    """
    Backward-compatible calculator builder:
    - If PortfolioCalculator.__init__ supports benchmark_ticker, pass it.
    - Otherwise do not pass it (avoid crash).
    """
    sig = inspect.signature(PortfolioCalculator.__init__)
    if "benchmark_ticker" in sig.parameters:
        return PortfolioCalculator(
            user_df,
            market_client,
            benchmark_ticker=user_benchmark,
            api_client=api_client,
        )
    # fallback: old signature
    return PortfolioCalculator(user_df, market_client, api_client=api_client)


def main():
    setup_logging()
    logger = logging.getLogger("main")
    logger.info("=== 啟動交易日誌更新程序 (v2.54 用戶專屬 benchmark 版) ===")

    if not API_KEY:
        logger.error("環境變數中找不到 API_KEY，請檢查 GitHub Secrets 設定。")
        return

    api_client = CloudflareClient()
    market_client = MarketDataClient()

    fallback_benchmark, target_user_id = get_benchmark_from_env()
    logger.info(
        f"觸發參數: Fallback Benchmark={fallback_benchmark}, "
        f"TargetUser={target_user_id if target_user_id else 'ALL'}"
    )

    logger.info("正在從 Cloudflare 獲取原始交易紀錄...")
    records = api_client.fetch_records()
    df = pd.DataFrame(records) if records else pd.DataFrame()

    user_list = []
    if not df.empty:
        if "user_id" not in df.columns:
            logger.error("交易紀錄中缺少 user_id 欄位，請檢查 API 回傳內容。")
            return

        # [v2.53] 確保 'id' 欄位被保留
        logger.info(f"[v2.53] API 回傳欄位: {list(df.columns)}")
        if "id" not in df.columns:
            logger.warning("[v2.53] 警告：API 回傳的資料中缺少 'id' 欄位，重複檢測功能將無法使用！")
        else:
            logger.info(f"[v2.53] ✓ 確認 'id' 欄位存在，共 {len(df)} 筆記錄")

        df.rename(
            columns={
                "txn_date": "Date",
                "symbol": "Symbol",
                "txn_type": "Type",
                "qty": "Qty",
                "price": "Price",
                "fee": "Commission",
                "tax": "Tax",
                "tag": "Tag",
            },
            inplace=True,
        )

        if "id" in df.columns:
            logger.info("[v2.53] ✓ rename 後 'id' 欄位保留成功")
        else:
            logger.error("[v2.53] ✗ rename 後 'id' 欄位消失！重複檢測將失敗！")

        df["Date"] = pd.to_datetime(df["Date"])
        df["Qty"] = pd.to_numeric(df["Qty"])
        df["Price"] = pd.to_numeric(df["Price"])
        df["Commission"] = pd.to_numeric(df["Commission"].fillna(0))
        df["Tax"] = pd.to_numeric(df["Tax"].fillna(0))
        df = df.sort_values("Date")

        user_list = df["user_id"].unique().tolist()
        if target_user_id and target_user_id not in user_list:
            user_list.append(target_user_id)

    if not user_list:
        logger.warning("目前無任何待處理的使用者紀錄，程序結束。")
        return

    # [v2.54] 收集所有用戶的 benchmark 與股票代碼
    logger.info(f"正在收集 {len(user_list)} 位用戶的 benchmark 設定...")
    user_benchmarks = {}
    all_tickers = set(df["Symbol"].unique().tolist() if not df.empty else [])

    for user_email in user_list:
        user_benchmark = api_client.get_user_benchmark(user_email)
        if not user_benchmark or user_benchmark == "SPY":
            user_benchmark = fallback_benchmark
        user_benchmarks[user_email] = user_benchmark
        all_tickers.add(user_benchmark)
        logger.info(f"用戶 {user_email} 使用 benchmark: {user_benchmark}")

    # 動態計算數據抓取起始日期
    if not df.empty:
        earliest_transaction_date = df["Date"].min()
        fetch_start_date = earliest_transaction_date - timedelta(days=90)
        logger.info(f"最早交易日期: {earliest_transaction_date.strftime('%Y-%m-%d')}")
        logger.info(f"數據抓取起始日期: {fetch_start_date.strftime('%Y-%m-%d')} (往前推 3 個月)")
    else:
        fetch_start_date = datetime.now() - timedelta(days=90)
        logger.info(f"無交易紀錄，預設抓取起始日期: {fetch_start_date.strftime('%Y-%m-%d')}")

    logger.info(f"開始下載全域市場數據。標的數: {len(all_tickers)}")

    # 終局版抓價：預設 intraday 只在市場開盤時才會啟動，且以 batch 下載
    market_client.download_data(list(all_tickers), fetch_start_date)

    logger.info(f"準備處理 {len(user_list)} 位使用者...")

    for user_email in user_list:
        try:
            user_benchmark = user_benchmarks.get(user_email, fallback_benchmark)
            logger.info(f"--- 正在處理使用者: {user_email} (Benchmark: {user_benchmark}) ---")

            user_df = df[df["user_id"] == user_email].copy() if not df.empty else pd.DataFrame()

            if not user_df.empty and "id" in user_df.columns:
                logger.info(f"[v2.53] 用戶 {user_email} 的資料包含 'id' 欄位，共 {len(user_df)} 筆記錄")

            calculator = _build_calculator(
                user_df=user_df,
                market_client=market_client,
                user_benchmark=user_benchmark,
                api_client=api_client,
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
