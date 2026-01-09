import pandas as pd
from datetime import timedelta
from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.calculator import PortfolioCalculator

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
    
    # 依日期排序 (FIFO 計算的關鍵)
    df = df.sort_values('Date')
    
    # 4. 下載市場數據
    # ✅ 抓取範圍：【最早交易日 - 100 天】至今
    # 用途：
    # 1. 捕捉買入日之前的拆股/配息事件
    # 2. 應對長假期與市場休市
    # 3. 確保有足夠的歷史數據計算調整因子
    if not df.empty:
        start_date = df['Date'].min()
        fetch_start_date = start_date - timedelta(days=100)
        unique_tickers = df['Symbol'].unique().tolist()
        
        print(f"[數據下載] 最早交易日: {start_date.date()}")
        print(f"[數據下載] 抓取起始日: {fetch_start_date.date()} (往前推 100 天)")
        print(f"[數據下載] 抓取標的: {unique_tickers}")
        
        market_client.download_data(unique_tickers, fetch_start_date)
    
    # 5. 核心計算
    calculator = PortfolioCalculator(df, market_client)
    final_snapshot = calculator.run()
    
    # 6. 上傳結果
    api_client.upload_portfolio(final_snapshot)

if __name__ == "__main__":
    main()
