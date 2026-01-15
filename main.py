import pandas as pd
from datetime import timedelta
from typing import Dict
from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.models import PortfolioSnapshot, GroupStats

def main():
    # 1. 初始化 Clients
    api_client = CloudflareClient()
    market_client = MarketDataClient()
    
    # 2. 獲取交易紀錄
    records = api_client.fetch_records()
    if not records:
        print("無交易紀錄，程式結束")
        return

    # 3. 資料前處理
    df_all = pd.DataFrame(records)
    
    # 映射欄位名稱 (DB欄位 -> 程式內部邏輯欄位)
    df_all.rename(columns={
        'txn_date': 'Date', 
        'symbol': 'Symbol', 
        'txn_type': 'Type', 
        'qty': 'Qty', 
        'price': 'Price', 
        'fee': 'Commission', 
        'tax': 'Tax', 
        'tag': 'Tag'
    }, inplace=True)
    
    # 型別轉換與空值填充
    df_all['Date'] = pd.to_datetime(df_all['Date'])
    df_all['Qty'] = pd.to_numeric(df_all['Qty'])
    df_all['Price'] = pd.to_numeric(df_all['Price'])
    df_all['Commission'] = pd.to_numeric(df_all['Commission'].fillna(0))
    df_all['Tax'] = pd.to_numeric(df_all['Tax'].fillna(0)) 
    
    # ✅ Phase 1: 標籤欄位格式化（去除空白、統一分隔符）
    df_all['Tag'] = df_all['Tag'].fillna('')  # 空值填充為空字串
    df_all['Tag'] = df_all['Tag'].str.strip()  # 去除首尾空白
    
    # 依日期排序 (FIFO 計算的關鍵)
    df_all = df_all.sort_values('Date')
    
    # 4. 下載市場數據
    # ✅ 抓取範圍：【最早交易日 - 100 天】至今
    # 用途：
    # 1. 捕捉買入日之前的拆股/配息事件
    # 2. 應對長假期與市場休市
    # 3. 確保有足夠的歷史數據計算調整因子
    if not df_all.empty:
        start_date = df_all['Date'].min()
        fetch_start_date = start_date - timedelta(days=100)
        unique_tickers = df_all['Symbol'].unique().tolist()
        
        print(f"[數據下載] 最早交易日: {start_date.date()}")
        print(f"[數據下載] 抓取起始日: {fetch_start_date.date()} (往前推 100 天)")
        print(f"[數據下載] 抓取標的: {unique_tickers}")
        
        market_client.download_data(unique_tickers, fetch_start_date)
    
    # ============================================================
    # Phase 1: 標籤掃描與多群組平行運算 (Tag Discovery & Multiverse Loop)
    # ============================================================
    
    print("\n" + "="*60)
    print("✅ Phase 1: 開始基於標籤的多維度運算 (Tag-Based Multiverse Calculation)")
    print("="*60)
    
    # 步驟 1: 標籤掃描 (Tag Discovery)
    # 建立不重複標籤列表（支援多標籤，以逗號分隔）
    unique_tags = set()
    for tags_str in df_all['Tag'].unique():
        if tags_str:  # 跳過空字串
            # 支援多標籤："LongTerm,ShortTerm" -> ["LongTerm", "ShortTerm"]
            for tag in tags_str.split(','):
                tag = tag.strip()
                if tag:
                    unique_tags.add(tag)
    
    # 定義計算目標：ALL (總帳) + 各個獨立群組
    targets = ["ALL"] + sorted(list(unique_tags))
    
    print(f"\n[標籤掃描] 發現的獨特標籤: {sorted(list(unique_tags))}")
    print(f"[計算目標] 將運算 {len(targets)} 個群組: {targets}")
    
    # 步驟 2: 平行宇宙迴圈 (The Multiverse Loop)
    # 對每個群組獨立運算，互不干擾
    group_results: Dict[str, GroupStats] = {}
    
    for target in targets:
        print(f"\n{'='*60}")
        print(f"⚙️  處理群組: {target}")
        print(f"{'='*60}")
        
        # 篩選 (Filter)：根據群組名稱篩選交易紀錄
        if target == "ALL":
            # 總帳：使用全部交易
            df_subset = df_all.copy()
            print(f"[篩選] 使用全部交易紀錄 ({len(df_subset)} 筆)")
        else:
            # 特定群組：篩選包含該標籤的交易
            # 支援部分匹配："LongTerm" 匹配 "LongTerm" 和 "LongTerm,ShortTerm"
            mask = df_all['Tag'].str.contains(target, case=False, na=False, regex=False)
            df_subset = df_all[mask].copy()
            print(f"[篩選] 標籤包含 '{target}' 的交易: {len(df_subset)} 筆")
            
            if df_subset.empty:
                print(f"⚠️  警告: 群組 '{target}' 無交易紀錄，跳過")
                continue
        
        # 實例化 (Instantiate)：為每個群組建立獨立的 Calculator
        # ✅ 核心設計：每個 Calculator 有獨立的 FIFO 佇列，互不干擾
        calculator = PortfolioCalculator(df_subset, market_client)
        
        # 執行 (Run)：運算該群組的績效
        print(f"[運算] 執行 FIFO 與績效計算...")
        group_snapshot = calculator.run()
        
        # 儲存 (Store)：將舊版 PortfolioSnapshot 轉換為新版 GroupStats
        # ✅ 注意：calculator.run() 現在還是返回舊版的 PortfolioSnapshot
        #    我們需要提取其中的數據封裝為 GroupStats
        group_stats = GroupStats(
            summary=group_snapshot.summary,
            holdings=group_snapshot.holdings,
            history=group_snapshot.history,
            pending_dividends=group_snapshot.pending_dividends
        )
        
        group_results[target] = group_stats
        
        print(f"✅ 完成: {target}")
        print(f"   - 總價值: {group_stats.summary.total_value:,.0f} TWD")
        print(f"   - 總損益: {group_stats.summary.total_pnl:,.0f} TWD")
        print(f"   - TWR: {group_stats.summary.twr:.2%}")
        print(f"   - 持倉數: {len(group_stats.holdings)} 個")
    
    # 步驟 3: 打包輸出 (Package Output)
    # 建立新版的 PortfolioSnapshot，包含多群組數據
    print(f"\n{'='*60}")
    print("✅ 所有群組運算完成，打包輸出...")
    print(f"{'='*60}")
    
    # 獲取基本資訊（從任意一個群組取得，因為都相同）
    # 注意：這裡需要確保至少有一個群組（ALL）
    if "ALL" in group_results:
        # 從原本的 group_snapshot 中取得基本資訊
        # （這是最後一次計算的 snapshot，應該是 ALL 群組）
        final_snapshot = PortfolioSnapshot(
            updated_at=group_snapshot.updated_at,
            base_currency=group_snapshot.base_currency,
            exchange_rate=group_snapshot.exchange_rate,
            groups=group_results
        )
    else:
        # 如果沒有 ALL 群組（理論上不應該發生），使用預設值
        from datetime import datetime
        final_snapshot = PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            base_currency="TWD",
            exchange_rate=31.5,  # 預設匯率
            groups=group_results
        )
    
    print(f"✅ 打包完成，包含 {len(final_snapshot.groups)} 個群組")
    
    # 6. 上傳結果
    print(f"\n[上傳] 正在上傳投資組合快照...")
    api_client.upload_portfolio(final_snapshot)
    print("✅ Phase 1 重構完成！")

if __name__ == "__main__":
    main()
