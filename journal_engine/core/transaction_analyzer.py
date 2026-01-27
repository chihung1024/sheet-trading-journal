from datetime import date
import pandas as pd
from dataclasses import dataclass
import logging

# 設定 logger
logger = logging.getLogger(__name__)

@dataclass
class PositionSnapshot:
    """
    持倉快照數據結構
    用於儲存單一標的在特定日期的完整狀態
    """
    symbol: str
    qty: float
    avg_cost: float        # 剩餘持倉的平均成本 (單股)
    total_cost: float      # 剩餘持倉的總成本
    is_new_today: bool     # 是否為今日純新倉
    
    # 當日交易活動數據
    today_buy_qty: float   # 今日總買入量
    today_sell_qty: float  # 今日總賣出量
    realized_pnl: float    # 當日已實現損益 (Fixed PnL)
    
    # 用於計算加權基準價的組件 (解決加碼/混合倉問題)
    old_qty_remaining: float  # 昨日舊倉在今日的剩餘量
    new_qty_remaining: float  # 今日新倉在今日的剩餘量
    new_avg_cost: float       # 今日新倉的平均成本

class TransactionAnalyzer:
    """
    金融級交易分析引擎 (v2.40 Core)
    透過重演當日交易，精確計算持倉狀態與已實現/未實現損益分離。
    解決：加碼成本混合、當沖損益鎖定、減碼成本追蹤等問題。
    """
    def __init__(self, transactions_df: pd.DataFrame):
        """
        初始化分析器
        :param transactions_df: 包含所有交易記錄的 DataFrame
        """
        self.df = transactions_df.copy()
        
        # 確保日期格式正確
        if not pd.api.types.is_datetime64_any_dtype(self.df['Date']):
            self.df['Date'] = pd.to_datetime(self.df['Date'])
            
        # 確保必要欄位存在 (對應 Calculator 中的欄位名稱)
        # 注意：使用 Commission 與 Tax 以匹配現有資料庫結構
        for col in ['Commission', 'Tax']:
            if col not in self.df.columns:
                self.df[col] = 0.0

    def analyze_today_position(self, symbol: str, target_date: date, fx: float = 1.0) -> PositionSnapshot:
        """
        分析某標的在目標日期的完整持倉狀態 (核心邏輯)
        
        :param symbol: 股票代碼
        :param target_date: 目標日期
        :param fx: 匯率 (用於將已實現損益轉為 TWD)
        :return: PositionSnapshot 物件
        """
        # 1. 篩選該標的交易並按日期排序
        symbol_txns = self.df[self.df['Symbol'] == symbol].sort_values('Date')
        
        # 2. 分割「歷史交易 (昨日及以前)」與「今日交易」
        prior_txns = symbol_txns[symbol_txns['Date'].dt.date < target_date]
        today_txns = symbol_txns[symbol_txns['Date'].dt.date == target_date]

        # === 階段一：重建昨日收盤狀態 (Yesterday Close State) ===
        p_qty = 0.0
        p_cost = 0.0 # 總成本基礎

        for _, t in prior_txns.iterrows():
            qty = float(t['Qty'])
            price = float(t['Price'])
            # 成本 = 價金 + 手續費 + 稅
            # 確保欄位存在，若無則預設為 0
            comm = float(t.get('Commission', 0))
            tax = float(t.get('Tax', 0))
            cost_impact = price * qty + comm + tax

            if t['Type'] == 'BUY':
                p_qty += qty
                p_cost += cost_impact
            elif t['Type'] == 'SELL':
                if p_qty > 1e-9:
                    # 賣出時，成本按比例減少 (FIFO 假設)
                    ratio = min(qty / p_qty, 1.0)
                    p_cost *= (1.0 - ratio)
                    p_qty -= qty
                    p_qty = max(0.0, p_qty)

        # 計算昨日平均成本
        p_avg = p_cost / p_qty if p_qty > 1e-9 else 0.0
        initial_old_qty = p_qty # 保存初始舊倉數量，用於判斷是否為純新倉

        # === 階段二：執行今日交易重演 (Intraday Replay) ===
        today_buy_pool_qty = 0.0
        today_buy_pool_cost = 0.0 # 今日買入部分的總成本
        
        today_buy_total_vol = 0.0
        today_sell_total_vol = 0.0
        realized_pnl_today = 0.0

        for _, t in today_txns.iterrows():
            qty = float(t['Qty'])
            price = float(t['Price'])
            comm = float(t.get('Commission', 0))
            tax = float(t.get('Tax', 0))
            fees = comm + tax
            
            if t['Type'] == 'BUY':
                # 買入：增加今日持倉池
                # 買入成本包含手續費
                cost_basis = qty * price + comm
                today_buy_pool_qty += qty
                today_buy_pool_cost += cost_basis
                today_buy_total_vol += qty

            elif t['Type'] == 'SELL':
                today_sell_total_vol += qty
                remaining_sell = qty
                
                # FIFO 邏輯 A: 優先賣出舊倉 (Sell Prior)
                if p_qty > 1e-9 and remaining_sell > 0:
                    take = min(remaining_sell, p_qty)
                    
                    # 該筆賣出的手續費分攤 (依數量比例)
                    chunk_fees = fees * (take / qty)
                    
                    # 已實現損益 = (賣出價值 - 分攤費用) - (舊平均成本 * 數量)
                    pnl = (price * take - chunk_fees) - (p_avg * take)
                    realized_pnl_today += pnl
                    
                    # 更新舊倉狀態
                    p_qty -= take
                    p_cost -= p_avg * take
                    remaining_sell -= take
                
                # FIFO 邏輯 B: 再賣出新倉 (Day Trade / 當沖)
                if today_buy_pool_qty > 1e-9 and remaining_sell > 0:
                    t_avg = today_buy_pool_cost / today_buy_pool_qty
                    take = min(remaining_sell, today_buy_pool_qty)
                    
                    chunk_fees = fees * (take / qty)
                    
                    # 當沖已實現損益
                    pnl = (price * take - chunk_fees) - (t_avg * take)
                    realized_pnl_today += pnl
                    
                    # 更新新倉狀態
                    today_buy_pool_qty -= take
                    today_buy_pool_cost -= t_avg * take
                    remaining_sell -= take
        
        # === 階段三：計算最終快照數據 ===
        final_qty = p_qty + today_buy_pool_qty
        final_total_cost = p_cost + today_buy_pool_cost
        final_avg = final_total_cost / final_qty if final_qty > 1e-9 else 0.0
        
        # 判定是否為今日純新倉: 初始無舊倉 且 今日有買入
        is_new = (initial_old_qty < 1e-9) and (today_buy_total_vol > 0)
        
        # 計算今日新倉的平均成本 (若有的話)
        new_avg = today_buy_pool_cost / today_buy_pool_qty if today_buy_pool_qty > 1e-9 else 0.0

        return PositionSnapshot(
            symbol=symbol,
            qty=final_qty,
            avg_cost=final_avg,
            total_cost=final_total_cost,
            is_new_today=is_new,
            today_buy_qty=today_buy_total_vol,
            today_sell_qty=today_sell_total_vol,
            realized_pnl=realized_pnl_today * fx, # 轉換為台幣 (若需要)
            
            # 用於計算基準價的詳細組件
            old_qty_remaining=p_qty,
            new_qty_remaining=today_buy_pool_qty,
            new_avg_cost=new_avg
        )

    def get_base_price_for_pnl(self, snapshot: PositionSnapshot, yesterday_close: float) -> float:
        """
        計算「未實現損益」的加權基準價 (Weighted Base Price)
        
        這是解決「加碼」場景下，新舊倉成本混合的關鍵邏輯。
        未實現損益 = (現價 - 加權基準價) * 總數量
        
        :param snapshot: 由 analyze_today_position 產生的快照
        :param yesterday_close: 昨日收盤價
        :return: 用於計算 PnL 的基準價格
        """
        if snapshot.qty < 1e-9:
            return 0.0
            
        # 情境 1: 純新倉，基準價 = 平均買入成本 (當日變動看成本)
        if snapshot.is_new_today:
            return snapshot.avg_cost
            
        # 情境 2: 純舊倉，基準價 = 昨日收盤價 (當日變動看昨收)
        if snapshot.new_qty_remaining < 1e-9:
            return yesterday_close
            
        # 情境 3: 混合倉 (加碼)，基準價 = 加權平均
        # 公式: (舊倉殘量 * 昨收 + 新倉殘量 * 新倉成本) / 總殘量
        val_old = snapshot.old_qty_remaining * yesterday_close
        val_new = snapshot.new_qty_remaining * snapshot.new_avg_cost
        
        return (val_old + val_new) / snapshot.qty
