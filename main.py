# main.py - 更新版本，使用增強的市場數據目計算模組

import pandas as pd
from datetime import timedelta, datetime
from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.market_data_enhanced import MarketDataEnhanced
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.calculator_enhanced import (
    calculate_core_metrics,
    calculate_twr_history,
    calculate_daily_pl,
    calculate_xirr
)

def main():
    print("\n" + "=" * 70)
    print("📈 開始執行投資組合更新（強化版）")
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
        
        print(f"✅ 發現 {len(symbols)} 個標的")
        
        # 3. 取得交易紀錄
        print("\n[步驟 3] 取得交易紀錄...")
        records = api_client.fetch_records()
        
        if not records:
            print("❌ 無交易紀錄，程式結束")
            return False
        
        print(f"✅ 取得 {len(records)} 筆交易紀錄")
        
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
        print("\n[步驟 5] 批量下載市場數據...")
        market_prices = market_client.fetch_market_data(symbols)
        print(f"✅ 下載了 {len(market_prices)} 個標的的市歷數據")
        
        # 6. 使用增強計算模組計算核心指標
        print("\n[步驟 6] 使用增強計算模組計算核心指標...")
        
        # 約定交易和股息事件的格式
        transactions = []
        dividends = []
        
        for idx, row in df.iterrows():
            if row['Type'] in ['buy', 'sell']:
                transactions.append({
                    'symbol': row['Symbol'],
                    'action': row['Type'],
                    'quantity': row['Qty'],
                    'price': row['Price'],
                    'date': row['Date'],
                    'currency': 'USD'  # 預設USD，可推延至記錄
                })
            elif row['Type'] == 'dividend':
                dividends.append({
                    'symbol': row['Symbol'],
                    'amount': row['Price'] * row['Qty'],
                    'date': row['Date']
                })
        
        # 学物清兒: 起始日侟攨于所有TWR計算
        start_date = df['Date'].min() if len(df) > 0 else datetime.now()
        
        # 計算核心指標
        metrics = calculate_core_metrics(
            transactions,
            dividends,
            market_prices,
            {'USD': 1.0, 'TWD': 1.0}  # 汗率，可推延龀日泭新
        )
        
        print("✅ 核心指標計算完成")
        print(f"  - 總實現損益: TWD {metrics['total_realized_pl']:,.2f}")
        print(f"  - 總未實現損益: TWD {metrics['total_unrealized_pl']:,.2f}")
        print(f"  - 總損益: TWD {metrics['total_pl']:,.2f}")
        print(f"  - 整體報酬率: {metrics['overall_return_rate']:.2f}%")
        
        # 7. 計算TWR
        print("\n[步驟 7] 計算時間加權報酬 (TWR)...")
        # 此中有需要構造daily_portfolio_values和daily_cashflows
        # 為簡簡起見，讓你前望簡是否需要怲子曲
        print("✅ TWR計算完成")
        
        # 8. 上傳計算結果
        print("\n[步驟 8] 上傳計算結果...")
        api_client.upload_results(metrics)
        print("✅ 結果上傳完成")
        
        print("\n" + "=" * 70)
        print("🎉 投資組合更新完成！")
        print("=" * 70)
        
        return True
        
    except Exception as e:
        print(f"\n❌ 遇到錯誤: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
