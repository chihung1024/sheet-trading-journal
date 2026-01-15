import pandas as pd
import json
import os
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
    if not target_tags or len(target_tags) == 0:
        return df
    
    def match_tags(record_tag):
        if pd.isna(record_tag) or not record_tag:
            return False
        
        # 將 record_tag 分割成列表
        record_tags = [t.strip().lower() for t in str(record_tag).split(',')]
        
        # 檢查是否有任何目標標籤在 record_tags 中
        return any(
            any(target.lower() in rt or rt in target.lower() for rt in record_tags)
            for target in target_tags
        )
    
    return df[df['Tag'].apply(match_tags)].copy()

def main():
    print("\n" + "="*60)
    print("🚀 Trading Journal - Portfolio Calculator (v2.1.0)")
    print("✨ 群組功能支援版 (輕量化方案)")
    print("="*60 + "\n")
    
    # 1. 初始化 Clients
    api_client = CloudflareClient()
    market_client = MarketDataClient()
    
    # 2. 獲取交易紀錄
    records = api_client.fetch_records()
    if not records:
        print("⚠️  無交易紀錄，程式結束")
        return

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
    df['Tag'] = df['Tag'].fillna('')  # ✅ 空 TAG 處理
    
    # 依日期排序 (FIFO 計算的關鍵)
    df = df.sort_values('Date')
    
    print(f"📋 總共載入 {len(df)} 筆交易紀錄")
    
    # 4. 下載市場數據
    if not df.empty:
        start_date = df['Date'].min()
        fetch_start_date = start_date - timedelta(days=100)
        unique_tickers = df['Symbol'].unique().tolist()
        
        print(f"\n📈 [數據下載]")
        print(f"   最早交易日: {start_date.date()}")
        print(f"   抓取起始日: {fetch_start_date.date()} (往前推 100 天)")
        print(f"   抓取標的: {unique_tickers}")
        
        market_client.download_data(unique_tickers, fetch_start_date)
    
    # 5. ✅ 讀取群組配置 (從環境變數或預設值)
    groups_config_json = os.getenv('GROUPS_CONFIG', '{}')
    
    try:
        groups_config = json.loads(groups_config_json)
        print(f"\n📁 [群組配置] 接收到 {len(groups_config)} 個群組")
    except json.JSONDecodeError:
        print("\n⚠️  群組配置格式錯誤，使用預設值")
        groups_config = {
            'all': {'name': '全部紀錄', 'tags': []}
        }
    
    # 如果沒有群組配置，只計算「全部」
    if not groups_config or len(groups_config) == 0:
        print("🔄 使用預設群組配置")
        groups_config = {
            'all': {'name': '全部紀錄', 'tags': []}
        }
    
    # 6. ✅ 為每個群組計算投資組合
    all_snapshots = {}
    
    for group_id, group_info in groups_config.items():
        group_name = group_info.get('name', group_id)
        group_tags = group_info.get('tags', [])
        
        print(f"\n⚙️  [計算群組] {group_name} ({group_id})")
        
        # 篩選該群組的交易紀錄
        if group_id == 'all':
            filtered_df = df.copy()
            print(f"   範圍: 所有交易 ({len(filtered_df)} 筆)")
        else:
            filtered_df = filter_records_by_tags(df, group_tags)
            print(f"   標籤: {group_tags}")
            print(f"   篩選結果: {len(filtered_df)} 筆交易")
        
        # 如果該群組沒有任何交易，跳過
        if filtered_df.empty:
            print(f"   ⚠️  跳過（無交易紀錄）")
            continue
        
        # 執行計算
        try:
            calculator = PortfolioCalculator(filtered_df, market_client)
            snapshot = calculator.run()
            all_snapshots[group_id] = snapshot
            
            # 顯示簡要結果
            if snapshot and 'summary' in snapshot:
                summary = snapshot['summary']
                print(f"   ✅ 完成 - 總市值: ${summary.get('total_value', 0):,.0f}")
            else:
                print(f"   ✅ 完成")
                
        except Exception as e:
            print(f"   ❌ 計算失敗: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # 7. ✅ 上傳所有群組的快照
    if not all_snapshots:
        print("\n⚠️  沒有任何群組計算成功，程式結束")
        return
    
    print(f"\n💾 [上傳快照] 準備上傳 {len(all_snapshots)} 個群組的數據")
    
    # 目前只上傳「全部紀錄」的快照（保持相容性）
    # 未來可修改 API 支援上傳多個群組
    if 'all' in all_snapshots:
        api_client.upload_portfolio(all_snapshots['all'])
        print("✅ 已上傳「全部紀錄」快照")
    else:
        # 如果沒有 'all'，上傳第一個群組
        first_group_id = list(all_snapshots.keys())[0]
        api_client.upload_portfolio(all_snapshots[first_group_id])
        print(f"✅ 已上傳「{groups_config[first_group_id]['name']}」快照")
    
    # ✅ 將所有群組快照輸出為 JSON（供未來使用）
    output_data = {
        'timestamp': pd.Timestamp.now().isoformat(),
        'groups_count': len(all_snapshots),
        'groups': {}
    }
    
    for group_id, snapshot in all_snapshots.items():
        group_name = groups_config[group_id].get('name', group_id)
        output_data['groups'][group_id] = {
            'name': group_name,
            'snapshot': snapshot
        }
    
    # 將結果寫入檔案（供 debug 使用）
    try:
        with open('portfolio_groups_output.json', 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2, default=str)
        print(f"\n📝 已儲存詳細結果到 portfolio_groups_output.json")
    except Exception as e:
        print(f"\n⚠️  無法儲存輸出檔案: {e}")
    
    print("\n" + "="*60)
    print("✅ 計算完成！")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
