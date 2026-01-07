# main.py - 更新版本，使用增強的市場數據

import pandas as pd
from datetime import timedelta
from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.market_data_enhanced import MarketDataEnhanced
from journal_engine.core.calculator import PortfolioCalculator


def main():
    print("\n" + "=" * 70)
    print("📊 開始執行投資組合更新（增強版）")
    print("=" * 70)
    
    try:
        # 1. 初始化 Clients
        print("\n[步驟 1] 初始化客戶端...")
        api_client = CloudflareClient()
        market_client = MarketDataEnhanced()
        print("✅ 客戶端初始化完成")
        
        # 2. 自動發現需要更新的標的
        print("\n[步驟 2] 自動發現需要更新的標的...")
        symbols = market_client.auto_discover_targets(api_client)
        
        if not symbols:
            print("❌ 無法發現任何標的，程式結束")
            return False
        
        # 3. 獲取交易紀錄
        print("\n[步驟 3] 獲取交易紀錄...")
        records = api_client.fetch_records()
        
        if not records:
            print("❌ 無交易紀錄，程式結束")
            return False
        
        print(f"✅ 獲取 {len(records)} 筆交易紀錄")
        
        # 4. 準備 DataFrame
        print("\n[步驟 4] 準備數據...")
        df = pd.DataFrame(records)
        
        # 映射欄位名稱
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
        
        # 數據類型轉換
        df['Date'] = pd.to_datetime(df['Date'])
        df['Qty'] = pd.to_numeric(df['Qty'])
        df['Price'] = pd.to_numeric(df['Price'])
        df['Commission'] = pd.to_numeric(df['Commission'].fillna(0))
        df['Tax'] = pd.to_numeric(df['Tax'].fillna(0))
        
        # 按日期排序（FIFO計算的關鍵）
        df = df.sort_values('Date')
        
        print(f"✅ 數據準備完成 ({len(df)} 行)")
        
        # 5. 批量下載市場數據
        print("\n
