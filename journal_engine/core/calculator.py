import pandas as pd
import numpy as np
from collections import deque
from datetime import datetime
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client):
        """
        初始化投資組合計算器
        
        參數:
            transactions_df: 交易記錄 DataFrame
            market_client: MarketDataClient 實例
        """
        self.df = transactions_df
        self.market = market_client
        
        # 當前持倉狀態
        self.holdings = {}  # {symbol: {qty, cost_basis_usd, cost_basis_twd, tag}}
        
        # FIFO 隊列（用於計算賣出時的成本基礎）
        self.fifo_queues = {}  # {symbol: deque([{qty, price, cost_total_usd, cost_total_twd, date}])}
        
        # 投資統計
        self.invested_capital = 0.0      # 當前投入資金（買入-賣出）
        self.total_realized_pnl_twd = 0.0  # 累計已實現損益（包含賣出盈虧+配息）
        
        # 歷史數據
        self.history_data = []  # 每日資產淨值記錄
        
        # 配息去重
        self.confirmed_dividends = set()  # 記錄已手動輸入的配息
        self._pre_scan_dividends()
        
        # 基準對比（SPY）
        self.benchmark_units = 0.0        # SPY 持有單位
        self.benchmark_invested = 0.0     # SPY 投入資金

        # 新增 TWR 計算專用變數
        self.cumulative_twr_factor = 1.0  # 用於累乘 TWR
        self.prev_total_equity = 0.0      # 記錄前一日總權益

    def _pre_scan_dividends(self):
        """
        預先掃描使用者手動輸入的配息記錄
        
        用途：
        - 使用者可能手動輸入配息交易（Type='DIV'）
        - 這些手動記錄通常是為了精確控制稅務或特殊處理
        - 需要防止自動邏輯重複計算這些配息
        
        邏輯：
        - 建立 {Symbol}_{Date} 的唯一鍵
        - 存入 confirmed_dividends 集合
        - _process_implicit_dividends 會檢查此集合並跳過
        """
        div_txs = self.df[self.df['Type'] == 'DIV']
        for _, row in div_txs.iterrows():
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            self.confirmed_dividends.add(key)

    def run(self):
        """
        執行投資組合計算主流程
        
        步驟：
        1. 復權處理：調整交易記錄以匹配 Adj Close 價格體系
        2. 日期迴圈：從第一筆交易到今天，逐日計算
        3. 每日處理：交易處理 → 配息處理 → 估值計算
        4. 產生報表：彙整最終持倉和績效數據
        
        返回:
            PortfolioSnapshot: 完整的投資組合快照
        """
        print("=== 開始執行投資組合計算 (總回報模式) ===")
        
        # ==================== 步驟 1: 復權處理 ====================
        # 將所有交易調整到 Adj Close 的價格基準
        # 這樣成本基礎和市值才能使用同一個價格體系
        self._back_adjust_transactions()
        
        # ==================== 步驟 2: 建立日期範圍 ====================
        start_date = self.df['Date'].min()
        end_date = datetime.now()
        date_range = pd.date_range(start=start_date, end=end_date, freq='D').normalize()
        
        # ==================== 步驟 3: 逐日計算 ====================
        for d in date_range:
            current_date = d.date()
            
            # 取得當日匯率
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx):
                    fx = DEFAULT_FX_RATE
            except:
                fx = DEFAULT_FX_RATE
            
            # 處理當日交易
            daily_txns = self.df[self.df['Date'].dt.date == current_date]
            for _, row in daily_txns.iterrows():
                self._process_transaction(row, fx, d)
            
            # 處理自動配息（yfinance 記錄但使用者未手動輸入的）
            self._process_implicit_dividends(d, fx)
            
            # 每日資產估值
            self._daily_valuation(d, fx)
        
        # ==================== 步驟 4: 產生最終報表 ====================
        return self._generate_final_output(fx)

    def _back_adjust_transactions(self):
        """
        復權處理：調整交易記錄以匹配 Adj Close 價格體系
        
        為什麼需要？
        - 你的交易記錄使用「實際成交價」（Close）
        - 市值計算使用「調整價格」（Adj Close）
        - 兩者的價格體系不同，會導致買入當天就出現虛假盈虧
        
        調整邏輯：
        1. 拆股調整：股數增加，價格減少（總成本不變）
        2. 配息調整：價格增加（對應 Adj Close 的追溯調整）
        
        範例 1 - 拆股：
        - 原始: 100股 @ $492.44 = $49,244
        - 拆股 10:1
        - 調整後: 1000股 @ $49.24 = $49,244（總成本不變）
        
        範例 2 - 配息：
        - 原始: 100股 @ $50.80（買入時的實際成交價）
        - 之後累積配息 $4，Adj Close 追溯調整
        - 買入日 Adj Close 從 $50.80 變成 $54.80
        - 調整後: 100股 @ $54.80（對應 Adj Close）
        
        這樣調整後：
        - 買入當天：成本 = 市值（TWR = 0%）✅
        - 圖表平滑：無虛假盈虧斷層 ✅
        """
        print("正在進行交易數據復權處理...")
        
        for index, row in self.df.iterrows():
            sym = row['Symbol']
            date = row['Date']
            tx_type = row['Type']
            
            # 只調整 BUY/SELL 交易
            # DIV 類型不需要調整（已經是最終金額）
            if tx_type not in ['BUY', 'SELL']:
                continue
            
            # 取得拆股因子（如 10.0 代表 10-for-1 拆股）
            split_factor = self.market.get_transaction_multiplier(sym, date)
            
            # 取得配息調整因子（Adj Close / Close）
            div_adj_factor = self.market.get_dividend_adjustment_factor(sym, date)
            
            # 只有在有拆股或配息時才需要調整
            if split_factor != 1.0 or div_adj_factor != 1.0:
                old_qty = row['Qty']
                old_price = row['Price']
                
                # 調整股數（拆股）
                # 公式: new_qty = old_qty × split_factor
                # 例如: 100股 × 10 = 1000股
                new_qty = old_qty * split_factor
                
                # 調整價格（拆股 + 配息）
                # 公式: new_price = (old_price / split_factor) × div_adj_factor
                # 
                # 步驟 1: 拆股調整
                #   $492.44 / 10 = $49.24
                # 
                # 步驟 2: 配息調整
                #   $49.24 × 1.078 = $53.08
                # 
                # 結果: 價格對應到當時的 Adj Close 水平
                new_price = (old_price / split_factor) * div_adj_factor
                
                # 更新 DataFrame
                self.df.at[index, 'Qty'] = new_qty
                self.df.at[index, 'Price'] = new_price
                
                print(f"  [復權] {sym} {date.date()}: {old_qty}股@${old_price:.2f} → {new_qty:.2f}股@${new_price:.2f}")

    def _process_implicit_dividends(self, date_ts, fx):
        """
        處理隱式配息（自動記錄但不累加盈虧）
        
        重要觀念：
        - 當使用 Adj Close 計算市值時，配息效果已經「內建」在價格中
        - Adj Close 會自動反映配息再投資的效果
        - 如果再額外累加配息到 realized_pnl，會造成「雙重計算」
        
        範例說明：
        假設持有 1000股 QQQI @ $50.80
        
        除息日當天：
        1. 配息 $0.50/股，股價從 $52.00 跌到 $51.50
        2. 如果使用 Close 計算:
           - 市值減少: 1000 × $0.50 = $500
           - 需要加回配息: +$500 × 0.7 = +$350（扣稅）
        
        3. 如果使用 Adj Close 計算:
           - Adj Close 自動「加回」配息效果
           - 除息前: Adj Close = $52.00
           - 除息後: Adj Close = $52.20（股價跌$0.50，但配息效果加回）
           - 市值自動保持平滑，不需要額外加配息！
        
        因此：
        - 此方法僅用於「記錄配息明細」（報表顯示）
        - 不累加到 total_realized_pnl_twd（避免雙重計算）
        """
        date_str = date_ts.strftime('%Y-%m-%d')
        
        for sym, h_data in self.holdings.items():
            qty = h_data['qty']
            
            if qty > 0:
                # 檢查是否已手動輸入此筆配息
                if f"{sym}_{date_str}" in self.confirmed_dividends:
                    continue
                
                # 從 yfinance 獲取除息日的配息金額（每股，稅前）
                div_per_share_gross = self.market.get_dividend(sym, date_ts)
                
                if div_per_share_gross > 0:
                    # 計算配息總額（稅後 70%，美股扣 30% 股息稅）
                    total_div_net_usd = qty * div_per_share_gross * 0.7
                    total_div_net_twd = total_div_net_usd * fx
                    
                    # ⚠️ 關鍵：不累加到 realized_pnl
                    # 原因：使用 Adj Close 時，配息效果已經反映在持倉市值的增長中
                    # 如果再累加，會導致配息被計算兩次：
                    #   1. 一次在市值增長中（Adj Close 自動處理）
                    #   2. 一次在 realized_pnl 中（手動累加）
                    # 
                    # self.total_realized_pnl_twd += total_div_net_twd  # ❌ 註解掉
                    
                    # ✅ 僅記錄配息事件（用於產生配息明細報表）
                    if not hasattr(self, 'dividend_history'):
                        self.dividend_history = []
                    
                    self.dividend_history.append({
                        'date': date_str,
                        'symbol': sym,
                        'shares': qty,
                        'div_per_share': div_per_share_gross,
                        'total_gross': qty * div_per_share_gross,
                        'total_net': total_div_net_usd,
                        'total_net_twd': total_div_net_twd
                    })

    def _process_transaction(self, row, fx, date_ts):
        """
        處理單筆交易
        
        支援的交易類型：
        - BUY: 買入股票
        - SELL: 賣出股票（使用 FIFO 計算成本）
        - DIV: 手動輸入的配息（會累加到 realized_pnl）
        """
        sym = row['Symbol']
        qty = row['Qty']
        price = row['Price']
        comm = row['Commission']
        tax = row['Tax']
        txn_type = row['Type']
        tag = row['Tag']
        
        # 初始化持倉
        if sym not in self.holdings:
            self.holdings[sym] = {
                'qty': 0.0,
                'cost_basis_usd': 0.0,
                'cost_basis_twd': 0.0,
                'tag': tag
            }
            self.fifo_queues[sym] = deque()
        
        if tag:
            self.holdings[sym]['tag'] = tag

        # ==================== 買入交易 ====================
        if txn_type == 'BUY':
            # 計算總成本（包含手續費和稅）
            cost_usd = (qty * price) + comm + tax
            cost_twd = cost_usd * fx
            
            # 更新持倉
            self.holdings[sym]['qty'] += qty
            self.holdings[sym]['cost_basis_usd'] += cost_usd
            self.holdings[sym]['cost_basis_twd'] += cost_twd
            
            # 加入 FIFO 隊列（用於未來賣出時計算成本）
            self.fifo_queues[sym].append({
                'qty': qty,
                'price': price,
                'cost_total_usd': cost_usd,
                'cost_total_twd': cost_twd,
                'date': date_ts
            })
            
            # 更新投入資金
            self.invested_capital += cost_twd
            
            # 同步交易基準（SPY）
            self._trade_benchmark(date_ts, cost_twd, fx, is_buy=True)

        # ==================== 賣出交易 ====================
        elif txn_type == 'SELL':
            # 計算賣出收益（扣除手續費和稅）
            proceeds_twd = ((qty * price) - comm - tax) * fx
            
            # 更新持倉股數
            self.holdings[sym]['qty'] -= qty
            
            # 使用 FIFO 計算賣出成本
            remaining = qty
            cost_sold_twd = 0.0
            cost_sold_usd = 0.0
            
            while remaining > 0 and self.fifo_queues[sym]:
                batch = self.fifo_queues[sym][0]
                take = min(remaining, batch['qty'])
                frac = take / batch['qty']
                
                # 從最早買入批次中取出成本
                cost_sold_usd += batch['cost_total_usd'] * frac
                cost_sold_twd += batch['cost_total_twd'] * frac
                
                # 更新批次剩餘股數
                batch['qty'] -= take
                batch['cost_total_usd'] -= batch['cost_total_usd'] * frac
                batch['cost_total_twd'] -= batch['cost_total_twd'] * frac
                
                remaining -= take
                
                # 若批次用盡，移除
                if batch['qty'] < 1e-9:
                    self.fifo_queues[sym].popleft()
            
            # 更新成本基礎
            self.holdings[sym]['cost_basis_usd'] -= cost_sold_usd
            self.holdings[sym]['cost_basis_twd'] -= cost_sold_twd
            
            # 更新投入資金
            self.invested_capital -= cost_sold_twd
            
            # 計算已實現損益
            realized_pnl = proceeds_twd - cost_sold_twd
            self.total_realized_pnl_twd += realized_pnl
            
            # 同步交易基準（SPY）
            self._trade_benchmark(date_ts, proceeds_twd, fx, is_buy=False, realized_cost_twd=cost_sold_twd)

        # ==================== 手動配息交易 ====================
        elif txn_type == 'DIV':
            # 手動輸入的配息記錄
            # Price 欄位存的是「稅後淨額」(USD)
            net_div_usd = price
            net_div_twd = net_div_usd * fx
            
            # 累加到已實現損益
            self.total_realized_pnl_twd += net_div_twd
            
            # 標記為已處理（避免 _process_implicit_dividends 重複計算）
            date_str = date_ts.strftime('%Y-%m-%d')
            self.confirmed_dividends.add(f"{sym}_{date_str}")

 def _daily_valuation(self, date_ts, fx):
        total_mkt_val = 0.0
        current_holdings_cost = 0.0
        
        # 1. 計算當日市值 (使用 Raw Price，除息日會跌)
        for sym, h in self.holdings.items():
            if h['qty'] > 0.0001:
                price = self.market.get_price(sym, date_ts)
                total_mkt_val += h['qty'] * price * fx
                current_holdings_cost += h['cost_basis_twd']
        
        # 2. 計算總權益 (Total Equity)
        # 總權益 = (股票市值) + (已實現損益 + 累計配息現金)
        # 這裡的 total_realized_pnl_twd 已經包含了剛補進來的稅後配息
        unrealized_pnl = total_mkt_val - current_holdings_cost
        total_pnl = unrealized_pnl + self.total_realized_pnl_twd
        
        # 當前總資產價值 (投入本金 + 總損益)
        current_total_equity = self.invested_capital + total_pnl
        
        # 3. 計算當日 TWR (每日連乘法)
        daily_return = 0.0
        
        # 只有在「昨天就有資產」的情況下，才能計算今天的報酬率
        if self.prev_total_equity > 0:
            # 簡化算法：當日權益變動 / 昨日權益
            # 變動包含：股價漲跌 + 配息收入(已含在 total_pnl)
            # 註：這裡假設當日沒有大額的出入金 (Deposit/Withdrawal)，
            # 若有出入金，分母應該要調整 (Modified Dietz)，但日頻率下此誤差可接受
            
            # 當日損益變化量 (Today PnL - Yesterday PnL)
            prev_pnl = self.history_data[-1]['net_profit'] if self.history_data else 0
            daily_pnl_change = total_pnl - prev_pnl
            
            daily_return = daily_pnl_change / self.prev_total_equity
            
        # 4. 累乘 TWR
        self.cumulative_twr_factor *= (1 + daily_return)
        twr_percentage = (self.cumulative_twr_factor - 1) * 100
        
        # 5. Benchmark TWR (邏輯保持原本的簡單版，或依需求修正)
        bench_val = 0.0
        bench_twr = 0.0
        spy_p = self.market.get_price('SPY', date_ts)
        if spy_p > 0:
            bench_val = self.benchmark_units * spy_p * fx
            if self.benchmark_invested > 0:
                bench_twr = ((bench_val - self.benchmark_invested) / self.benchmark_invested) * 100

        # 6. 更新狀態並記錄
        self.prev_total_equity = current_total_equity
        
        self.history_data.append({
            "date": date_ts.strftime("%Y-%m-%d"),
            "total_value": round(total_mkt_val, 0),
            "invested": round(self.invested_capital, 0),
            "net_profit": round(total_pnl, 0),
            "twr": round(twr_percentage, 2),  # 使用連乘算出的 TWR
            "benchmark_twr": round(bench_twr, 2)
        })

    def _trade_benchmark(self, date_ts, amount_twd, fx, is_buy=True, realized_cost_twd=0.0):
        """
        同步交易基準（SPY）
        
        邏輯：每次買入/賣出時，用相同金額買入/賣出 SPY
        用途：計算相對於市場基準的表現（Alpha）
        """
        spy_p = self.market.get_price('SPY', date_ts)
        if spy_p <= 0:
            return
        
        if is_buy:
            # 買入 SPY
            self.benchmark_units += (amount_twd / fx) / spy_p
            self.benchmark_invested += amount_twd
        else:
            # 賣出 SPY
            if self.benchmark_units > 0:
                ratio = realized_cost_twd / self.benchmark_invested if self.benchmark_invested > 0 else 0
                self.benchmark_units -= self.benchmark_units * ratio
                self.benchmark_invested -= realized_cost_twd

    def _generate_final_output(self, current_fx):
        """
        產生最終投資組合報表
        
        包含：
        1. 持倉明細：每個股票的數量、市值、盈虧
        2. 績效摘要：總市值、總損益、TWR、基準對比
        3. 歷史數據：每日資產淨值曲線
        """
        print("整理最終報表...")
        
        final_holdings = []
        current_holdings_cost_sum = 0.0
        
        for sym, h in self.holdings.items():
            if h['qty'] > 0.001:
                # 取得當前價格
                curr_p = self.market.get_price(sym, datetime.now())
                mkt_val = h['qty'] * curr_p * current_fx
                
                # 計算盈虧
                cost = h['cost_basis_twd']
                pnl = mkt_val - cost
                pnl_pct = (pnl / cost * 100) if cost > 0 else 0
                
                # 平均成本（顯示為復權後的每股成本）
                avg_cost_usd = h['cost_basis_usd'] / h['qty'] if h['qty'] > 0 else 0
                
                current_holdings_cost_sum += cost
                
                final_holdings.append(HoldingPosition(
                    symbol=sym,
                    tag=h['tag'],
                    currency="USD",
                    qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0),
                    pnl_twd=round(pnl, 0),
                    pnl_percent=round(pnl_pct, 2),
                    current_price_origin=round(curr_p, 2),
                    avg_cost_usd=round(avg_cost_usd, 2)
                ))
        
        # 按市值排序
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        # 計算總績效
        curr_total_val = sum(x.market_value_twd for x in final_holdings)
        total_pnl = (curr_total_val - current_holdings_cost_sum) + self.total_realized_pnl_twd
        
        summary = PortfolioSummary(
            total_value=round(curr_total_val, 0),
            invested_capital=round(current_holdings_cost_sum, 0),
            total_pnl=round(total_pnl, 0),
            twr=self.history_data[-1]['twr'] if self.history_data else 0,
            realized_pnl=round(self.total_realized_pnl_twd, 0),
            benchmark_twr=self.history_data[-1]['benchmark_twr'] if self.history_data else 0
        )
        
        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY,
            exchange_rate=round(current_fx, 2),
            summary=summary,
            holdings=final_holdings,
            history=self.history_data
        )
