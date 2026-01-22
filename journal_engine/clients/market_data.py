import pandas as pd
import yfinance as yf
import concurrent.futures
from datetime import timedelta
from ..config import EXCHANGE_SYMBOL, DEFAULT_FX_RATE

class MarketDataClient:
    def __init__(self):
        """
        初始化市場數據客戶端
        - market_data: 存儲所有股票的歷史價格數據
        - fx_rates: 存儲匯率數據（USD/TWD）
        """
        self.market_data = {}
        self.fx_rates = pd.Series(dtype=float)

    def download_data(self, tickers: list, start_date):
        """
        下載市場數據（股票價格 + 匯率）
        
        參數:
            tickers: 股票代碼列表（如 ['NVDA', 'QQQI']）
            start_date: 開始日期
        
        返回:
            (market_data, fx_rates) 元組
        """
        print(f"正在下載市場數據，起始日期: {start_date}...")
        
        # ==================== 1. 下載匯率數據 ====================
        try:
            fx = yf.Ticker(EXCHANGE_SYMBOL)
            # 先抓取歷史日線
            fx_hist = fx.history(start=start_date - timedelta(days=5))
            
            if not fx_hist.empty:
                # 標準化時區和日期格式
                fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
                # 按日重採樣並前向填充（處理週末/假日）
                self.fx_rates = fx_hist['Close'].resample('D').ffill()

                # ✅ [新增] 強制抓取最新的即時匯率 (1分鐘K線)
                # 解決 Daily 資料在盤中可能不會即時更新的問題
                try:
                    print("[FX] 正在獲取即時匯率...")
                    # 抓取最近 1 天的 1 分鐘資料，取最後一筆
                    realtime_data = fx.history(period="1d", interval="1m")
                    if not realtime_data.empty:
                        latest_rate = float(realtime_data['Close'].iloc[-1])
                        # 取得今日的標準化日期 (00:00:00)
                        today = pd.Timestamp.now().normalize()
                        
                        # 覆蓋或新增今日匯率
                        self.fx_rates[today] = latest_rate
                        print(f"[FX] ✅ 已獲取即時匯率: {latest_rate:.4f} (已更新至今日數據)")
                    else:
                        print("[FX] ⚠️ 無法獲取即時數據，使用日線資料")
                except Exception as e:
                    print(f"[FX] ⚠️ 即時匯率抓取失敗: {e}")

            else:
                # 若下載失敗，使用預設匯率
                self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])
        except Exception as e:
            print(f"[FX] 匯率下載嚴重錯誤: {e}")
            # 錯誤處理：使用預設匯率
            self.fx_rates = pd.Series([DEFAULT_FX_RATE], index=[pd.Timestamp.now().normalize()])

        # ==================== 2. 下載個股數據 (平行化) ====================
        # 確保包含 SPY（用於基準對比）
        all_tickers = list(set([t for t in tickers if t] + ['SPY']))
        
        # 定義單個下載任務函數 (注意這裡的縮排是 8 個空格)
        def fetch_single_ticker(t):
            try:
                ticker_obj = yf.Ticker(t)
                
                # 關鍵參數設定：
                # - auto_adjust=False: 保留原始 Close 和 Adj Close 兩欄
                # - actions=True: 包含 Dividends 和 Stock Splits 事件
                hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
                
                if not hist.empty:
                    # 標準化日期格式
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    
                    # ✅ [修復] 使用 2天日線獲取最新收盤價
                    # 原因：1分鐘 K 線在盤前/盤中時無法獲取數據
                    # 方案：使用 2天日線確保能拿到最新收盤價
                    try:
                        # 抓取最近 2 天的日線數據
                        latest_data = ticker_obj.history(period="2d", interval="1d", auto_adjust=False)
                        
                        if not latest_data.empty and len(latest_data) > 0:
                            # 取最後一筆（最新收盤價）
                            latest_row = latest_data.iloc[-1]
                            latest_close = float(latest_row['Close'])
                            latest_adj_close = float(latest_row['Adj Close'])
                            latest_date = latest_data.index[-1]
                            
                            # 查找 hist 中對應的日期
                            if latest_date in hist.index:
                                # 直接覆蓋
                                hist.at[latest_date, 'Close'] = latest_close
                                hist.at[latest_date, 'Adj Close'] = latest_adj_close
                                print(f"[{t}] ✅ 最新收盤價: {latest_close:.2f} ({latest_date.strftime('%Y-%m-%d')})")
                            else:
                                # 如果是新的交易日，附加到 hist
                                new_row = latest_row.copy()
                                hist = pd.concat([hist, pd.DataFrame([new_row], index=[latest_date])])
                                print(f"[{t}] ✅ 新增最新交易日: {latest_close:.2f} ({latest_date.strftime('%Y-%m-%d')})")
                    except Exception as e:
                        print(f"[{t}] ⚠️ 獲取最新收盤價失敗: {e}")

                    # 準備數據：計算調整因子
                    hist_adj = self._prepare_data(t, hist)
                    return t, hist_adj
                else:
                    print(f"[{t}] 警告: 無歷史數據")
                    return t, None
                    
            except Exception as e:
                print(f"[{t}] 下載錯誤: {e}")
                return t, None

        # 使用 ThreadPoolExecutor 平行下載
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            # 提交所有任務
            future_to_ticker = {executor.submit(fetch_single_ticker, t): t for t in all_tickers}
            
            # 收集結果
            for future in concurrent.futures.as_completed(future_to_ticker):
                result = future.result()
                if result:
                    ticker, data = result
                    if data is not None:
                        self.market_data[ticker] = data
                        print(f"[{ticker}] 下載成功")
        
        return self.market_data, self.fx_rates

    def _prepare_data(self, symbol, df):
        """
        準備股票數據：計算各種調整因子
        
        核心概念：
        - Close: 原始收盤價（未調整）
        - Adj Close: 調整後收盤價（包含拆股+配息的總回報價格）
        - Split_Factor: 累積拆股倍數（用於調整交易股數）
        - Dividend_Adj_Factor: 配息調整因子（用於調整買入成本）
        
        為什麼需要這些調整？
        1. 拆股會改變股數，需要調整歷史交易的股數
        2. 配息會讓 Adj Close 與 Close 產生差異，需要調整成本基礎
        3. 使用 Adj Close 可以得到平滑的總回報曲線（無斷層）
        """
        df = df.copy()
        
        # ==================== 使用 Adj Close 作為主要價格 ====================
        # Adj Close 已經包含：
        # 1. 拆股調整：價格會自動縮放（如 10-for-1 拆股，價格除以10）
        # 2. 配息調整：配息效果會「加回」到歷史價格中
        # 
        # 例如：QQQI 在 2024-03-01 買入時 Close=$50.80
        #      之後累積配息 $4.00
        #      當前的 Adj Close(2024-03-01) = $54.80（包含配息再投資效果）
        df['Close_Adjusted'] = df['Adj Close']
        
        # 保留原始 Close 用於參考（實際成交價）
        df['Close_Raw'] = df['Close']
        
        # ==================== 計算累積拆股因子 ====================
        # 用途：將歷史交易的股數轉換為當前等價股數
        # 例如：NVDA 拆股前買 100股，拆股 10:1 後應該顯示為 1000股
        
        if 'Stock Splits' not in df.columns:
            df['Stock Splits'] = 0.0
        
        # 將 0 替換為 1.0（表示沒有拆股）
        splits = df['Stock Splits'].replace(0, 1.0)
        
        # 反向累積計算：從最新日期往回累積
        # 邏輯：某日的 Split_Factor = 該日之後所有拆股比率的乘積
        # 例如：
        #   2024-06-10: 拆股 10:1 → Split_Factor(2024-06-09) = 10
        #   2024-06-10: → Split_Factor(2024-06-10) = 1
        splits_reversed = splits.iloc[::-1]
        cum_splits_reversed = splits_reversed.cumprod()
        cum_splits = cum_splits_reversed.iloc[::-1]
        
        # Shift(-1) 讓因子對齊到正確的日期
        # 拆股日當天及之後的因子為 1.0（已經是拆股後的股數）
        # 拆股日之前的因子為拆股比率（需要調整股數）
        df['Split_Factor'] = cum_splits.shift(-1).fillna(1.0)
        
        # ==================== 計算配息調整因子 ====================
        # 用途：將買入成本調整到 Adj Close 的價格體系
        # 
        # 為什麼需要？
        # - 你用 $50.80 買入（實際成交價 = Close）
        # - 但 yfinance 會追溯調整歷史 Adj Close（加入配息效果）
        # - 買入日的 Adj Close 會隨著之後的配息而增加
        # - 為了讓成本基礎和市值使用同一個價格體系，需要調整成本
        # 
        # 公式：Dividend_Adj_Factor = Adj Close / Close
        # 
        # 範例：
        #   買入日: Close=$50.80, Adj Close=$50.80 → Factor=1.0
        #   （下載數據時）配息累積 $4
        #   買入日: Close=$50.80（不變）, Adj Close=$54.80 → Factor=1.078
        #   調整後成本: $50.80 × 1.078 = $54.80（對應當時的 Adj Close）
        df['Dividend_Adj_Factor'] = df['Adj Close'] / df['Close']
        
        return df

    def get_price(self, symbol, date):
        """
        取得指定日期的股票價格（使用 Adj Close）
        
        返回的價格特性：
        - 包含拆股調整（連續性）
        - 包含配息調整（總回報）
        - 形成平滑曲線（無斷層）
        
        參數:
            symbol: 股票代碼
            date: 查詢日期（pd.Timestamp 或 datetime）
        
        返回:
            調整後的收盤價（float）
        """
        if symbol not in self.market_data:
            return 0.0
        
        try:
            df = self.market_data[symbol]
            
            # 優先精確匹配日期
            if date in df.index:
                return float(df.loc[date, 'Close_Adjusted'])
            
            # 若找不到（如週末/假日），使用最近的前一個交易日價格
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Close_Adjusted'])
            
            return 0.0
        except:
            return 0.0

    def get_transaction_multiplier(self, symbol, date):
        """
        取得交易日的拆股復權因子
        
        用途：將原始交易股數轉換為當前等價股數
        
        範例：
        - 2024-01-02 買入 NVDA 100股 @ $492.44
        - 2024-06-10 拆股 10:1
        - get_transaction_multiplier('NVDA', '2024-01-02') = 10.0
        - 調整後股數: 100 × 10 = 1000股
        - 調整後價格: $492.44 / 10 = $49.24
        - 總成本維持不變: 100×$492.44 = 1000×$49.24 = $49,244
        
        參數:
            symbol: 股票代碼
            date: 交易日期
        
        返回:
            拆股因子（float，無拆股時為 1.0）
        """
        if symbol not in self.market_data:
            return 1.0
        
        try:
            df = self.market_data[symbol]
            
            # 精確匹配日期
            if date in df.index:
                return float(df.loc[date, 'Split_Factor'])
            
            # 若交易日在數據範圍之前（太早），使用最早的因子
            if date < df.index.min():
                return float(df.iloc[0]['Split_Factor'])
            
            # 若交易日在數據範圍之後（未來），使用最新的因子（通常是1.0）
            return float(df.iloc[-1]['Split_Factor'])
        except:
            return 1.0

    def get_dividend_adjustment_factor(self, symbol, date):
        """
        取得配息調整因子
        
        用途：將交易價格調整到 Adj Close 的價格體系
        
        核心邏輯：
        - yfinance 的 Adj Close 會「追溯調整」歷史價格
        - 當新配息發生時，所有歷史日期的 Adj Close 都會增加
        - 為了讓買入成本對應到 Adj Close，需要同步調整
        
        範例：
        - 2024-03-01 買入 QQQI @ $50.80（實際成交價）
        - 之後累積配息 $4.00
        - 當前 Adj Close(2024-03-01) = $54.80
        - Dividend_Adj_Factor = 54.80 / 50.80 = 1.078
        - 調整後買入價: $50.80 × 1.078 = $54.80
        
        這樣做的好處：
        - 買入當天的成本 = 買入當天的市值（TWR = 0%）✅
        - 圖表從買入日開始就是平滑的（無虛假盈虧）✅
        
        參數:
            symbol: 股票代碼
            date: 交易日期
        
        返回:
            配息調整因子（float，無配息時為 1.0）
        """
        if symbol not in self.market_data:
            return 1.0
        
        try:
            df = self.market_data[symbol]
            
            # 精確匹配日期
            if date in df.index:
                return float(df.loc[date, 'Dividend_Adj_Factor'])
            
            # 若找不到，向前填補最近的因子
            idx = df.index.get_indexer([date], method='pad')[0]
            if idx != -1:
                return float(df.iloc[idx]['Dividend_Adj_Factor'])
            
            return 1.0
        except:
            return 1.0

    def get_dividend(self, symbol, date):
        """
        取得指定日期的配息金額（每股）
        
        用途：記錄配息明細（僅用於報表顯示）
        
        重要提醒：
        - 此方法返回的是「除息日當天」的配息金額
        - yfinance 記錄的日期是「Ex-Dividend Date」（除息日）
        - 實際入帳日期（Payment Date）通常晚 1-2 週
        - 配息金額已經是「拆股調整後」的金額
        
        注意：
        - 當使用 Adj Close 計算市值時，配息效果已經包含在價格中
        - 不應該將此配息再次累加到 realized_pnl（會導致雙重計算）
        - 此方法僅用於產生配息明細報表
        
        參數:
            symbol: 股票代碼
            date: 查詢日期（除息日）
        
        返回:
            每股配息金額（USD，稅前）
        """
        if symbol not in self.market_data:
            return 0.0
        
        try:
            df = self.market_data[symbol]
            if date in df.index:
                return float(df.loc[date, 'Dividends'])
        except:
            pass
        
        return 0.0