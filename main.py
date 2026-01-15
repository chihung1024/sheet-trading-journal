import os
import pandas as pd
from datetime import datetime
from journal_engine.config import GOOGLE_SHEET_URL, D1_DB_PATH
from journal_engine.clients.api_client import GoogleSheetClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.models import PortfolioSnapshot

def load_transactions_from_csv(csv_path="data/transactions.csv"):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"找不到交易記錄檔: {csv_path}")
    
    df = pd.read_csv(csv_path)
    
    # 確保欄位名稱正確 (處理 BOM 或空白)
    df.columns = df.columns.str.strip().str.replace('\ufeff', '')
    
    # 轉換日期格式
    df['Date'] = pd.to_datetime(df['Date'])
    
    # 確保數值欄位型別正確
    num_cols = ['Qty', 'Price', 'Commission', 'Tax']
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
            
    # 確保 Tag 欄位存在且為字串
    if 'Tag' not in df.columns:
        df['Tag'] = ''
    df['Tag'] = df['Tag'].fillna('').astype(str)
            
    return df

def main():
    print("=== 啟動美股投資組合計算引擎 (多群組支援版) ===")
    
    # 1. 讀取數據
    # 優先從 CSV 讀取 (開發測試用)，正式環境可切換回 Google Sheet
    try:
        print("正在讀取交易記錄...")
        df = load_transactions_from_csv()
        print(f"成功載入 {len(df)} 筆交易記錄")
    except Exception as e:
        print(f"讀取 CSV 失敗，嘗試從 Google Sheet 下載... ({e})")
        # 這裡保留原有的 Google Sheet 邏輯，視需求啟用
        return

    # 2. 準備市場數據
    symbols = df['Symbol'].unique().tolist()
    if 'SPY' not in symbols:
        symbols.append('SPY') # 基準指數
        
    market_client = MarketDataClient()
    print(f"正在更新市場數據 (共 {len(symbols)} 檔股票)...")
    market_client.update_market_data(symbols)
    
    # 3. 識別所有群組 (Tags)
    # 解析 Tag 欄位 (支援逗號分隔，如 "LongTerm, Tech")
    unique_tags = set()
    for tags_str in df['Tag']:
        if not tags_str.strip():
            continue
        # 分割並去除空白
        for tag in tags_str.split(','):
            clean_tag = tag.strip()
            if clean_tag:
                unique_tags.add(clean_tag)
    
    # 定義計算目標：全部 (ALL) + 各個別標籤
    # 注意：'ALL' 包含所有交易，無視標籤
    calculation_targets = ['ALL'] + sorted(list(unique_tags))
    print(f"識別到的群組: {calculation_targets}")
    
    # 4. 平行宇宙運算 (Loop Calculation)
    group_results = {}
    
    for group_key in calculation_targets:
        print(f"\n--- 正在計算群組: [{group_key}] ---")
        
        target_df = pd.DataFrame()
        
        if group_key == 'ALL':
            # ALL 群組包含所有資料
            target_df = df.copy()
        else:
            # 篩選包含該 Tag 的交易
            # 邏輯：將 Tag 欄位分割成列表，檢查 group_key 是否在列表中
            # 這樣可以避免 "US" 匹配到 "US_Stock" 的部分字串問題
            mask = df['Tag'].apply(lambda x: group_key in [t.strip() for t in x.split(',')])
            target_df = df[mask].copy()
            
        if target_df.empty:
            print(f"群組 [{group_key}] 無交易記錄，跳過。")
            continue
            
        # 為每個群組建立獨立的計算器實例 (確保 FIFO 獨立)
        calculator = PortfolioCalculator(target_df, market_client)
        result_stats = calculator.run()
        
        # 存入結果容器
        group_results[group_key] = result_stats
        
    # 5. 打包最終結果
    # 取得最新匯率用於顯示
    try:
        latest_fx = market_client.fx_rates.iloc[-1]
    except:
        latest_fx = 30.0 # Fallback

    final_snapshot = PortfolioSnapshot(
        updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
        base_currency="TWD",
        exchange_rate=round(latest_fx, 2),
        groups=group_results # 這裡傳入巢狀的群組數據
    )
    
    # 6. 輸出結果
    output_path = "data/portfolio_snapshot.json"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(final_snapshot.model_dump_json(indent=2))
        
    print(f"\n計算完成！結果已儲存至 {output_path}")
    print(f"包含群組: {list(group_results.keys())}")

if __name__ == "__main__":
    main()
