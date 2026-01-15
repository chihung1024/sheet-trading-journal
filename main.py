import pandas as pd
import json
import os
import sys
from datetime import timedelta
from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.calculator import PortfolioCalculator

def filter_records_by_tags(df, target_tags):
    """
    根據 TAG 欄位篩選交易紀錄
    
    Args:
        df: 交易紀錄 DataFrame
        target_tags: 目標標籤列表，例如 ['long', 'hold']
    
    Returns:
        篩選後的 DataFrame
    """
    if not target_tags:
        return df
    
    def match_tags(record_tag):
        if pd.isna(record_tag) or not record_tag:
            return False
        
        # 將 record_tag 分割成列表
        record_tags = [t.strip().lower() for t in str(record_tag).split(',')]
        
        # 檢查是否有任何目標標籤在 record_tags 中
        # 支援部分匹配
        return any(
            any(target.lower() in rt or rt in target.lower() 
                for rt in record_tags)
            for target in target_tags
        )
    
    filtered_df = df[df['Tag'].apply(match_tags)].copy()
    print(f"  • 篩選標籤: {target_tags}")
    print(f"  • 符合條件的紀錄: {len(filtered_df)} / {len(df)}")
    return filtered_df

def main():
    print("="*60)
    print("📈 Trading Journal Portfolio Calculator")
    print("="*60)
    
    # ✅ 從環境變數或參數接收群組配置
    groups_config_json = os.getenv('GROUPS_CONFIG', '{}')
    try:
        groups_config = json.loads(groups_config_json)
        print(f"✅ 接收到 {len(groups_config)} 個群組配置")
        for gid, ginfo in groups_config.items():
            print(f"  • {ginfo.get('name', gid)}: tags={ginfo.get('tags', [])}")
    except json.JSONDecodeError as e:
        print(f"⚠️  群組配置解析失敗: {e}")
        groups_config = {}
    
    print("\n" + "="*60)
    print("🔌 Step 1: 初始化 API Clients")
    print("="*60)
    
    # 1. 初始化 Clients
    api_client = CloudflareClient()
    market_client = MarketDataClient()
    
    print("\n" + "="*60)
    print("📊 Step 2: 獲取交易紀錄")
    print("="*60)
    
    # 2. 獲取交易紀錄
    records = api_client.fetch_records()
    if not records:
        print("⚠️  無交易紀錄，程式結束")
        return
    
    print(f"✅ 獲取 {len(records)} 筆交易紀錄")

    # 3. 資料前處理
    df = pd.DataFrame(records)
    
    # 映射欄位名稱 (DB欄位 -> 程式內部邏輯欄位)
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
    
    # 型別轉換與空值填充
    df['Date'] = pd.to_datetime(df['Date'])
    df['Qty'] = pd.to_numeric(df['Qty'])
    df['Price'] = pd.to_numeric(df['Price'])
    df['Commission'] = pd.to_numeric(df['Commission'].fillna(0))
    df['Tax'] = pd.to_numeric(df['Tax'].fillna(0)) 
    df['Tag'] = df['Tag'].fillna('')
    
    # 依日期排序 (FIFO 計算的關鍵)
    df = df.sort_values('Date')
    
    print("\n" + "="*60)
    print("📈 Step 3: 下載市場數據")
    print("="*60)
    
    # 4. 下載市場數據
    # ✅ 抓取範圍：【最早交易日 - 100 天】至今
    if not df.empty:
        start_date = df['Date'].min()
        fetch_start_date = start_date - timedelta(days=100)
        unique_tickers = df['Symbol'].unique().tolist()
        
        print(f"• 最早交易日: {start_date.date()}")
        print(f"• 抓取起始日: {fetch_start_date.date()} (往前推 100 天)")
        print(f"• 抓取標的: {unique_tickers}")
        
        market_client.download_data(unique_tickers, fetch_start_date)
        print("✅ 市場數據下載完成")
    
    print("\n" + "="*60)
    print("🧮 Step 4: 核心計算 - 分群組計算投資組合")
    print("="*60)
    
    # 5. ✅ 為每個群組計算投資組合
    all_snapshots = {}
    
    # 如果沒有群組配置，預設只計算「全部紀錄」
    if not groups_config:
        groups_config = {'all': {'name': '全部紀錄', 'tags': []}}
        print("⚠️  未接收到群組配置，使用預設配置")
    
    for group_id, group_info in groups_config.items():
        group_name = group_info.get('name', group_id)
        group_tags = group_info.get('tags', [])
        
        print(f"\n📁 計算群組: {group_name} (ID: {group_id})")
        
        # 篩選該群組的交易紀錄
        if group_id == 'all' or not group_tags:
            filtered_df = df
            print(f"  • 使用全部紀錄")
        else:
            filtered_df = filter_records_by_tags(df, group_tags)
        
        if filtered_df.empty:
            print(f"  ⚠️  該群組無符合的交易紀錄，跳過")
            continue
        
        # 使用篩選後的 DataFrame 計算
        calculator = PortfolioCalculator(filtered_df, market_client)
        snapshot = calculator.run()
        
        all_snapshots[group_id] = snapshot
        print(f"  ✅ 計算完成")
    
    print("\n" + "="*60)
    print("📤 Step 5: 上傳結果")
    print("="*60)
    
    # 6. ✅ 上傳所有群組的快照
    # 為了保持與現有 API 相容，預設上傳 "all" 群組
    if 'all' in all_snapshots:
        api_client.upload_portfolio(all_snapshots['all'])
        print("✅ 已上傳「全部紀錄」快照至 D1")
    
    # ✅ 新增：將所有群組快照儲存為 JSON 檔
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    
    for group_id, snapshot in all_snapshots.items():
        output_file = os.path.join(output_dir, f"portfolio_snapshot_{group_id}.json")
        
        # 轉換為 JSON 格式
        snapshot_dict = snapshot.dict()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(snapshot_dict, f, ensure_ascii=False, indent=2)
        
        group_name = groups_config[group_id].get('name', group_id)
        print(f"✅ 已儲存「{group_name}」快照: {output_file}")
    
    print("\n" + "="*60)
    print("✅ 所有任務完成！")
    print("="*60)
    print(f"\n• 總共計算 {len(all_snapshots)} 個群組")
    for gid in all_snapshots.keys():
        print(f"  - {groups_config[gid].get('name', gid)}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ 程式執行錯誤: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
