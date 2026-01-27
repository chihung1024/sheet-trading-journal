from datetime import date
import pandas as pd
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class PositionSnapshot:
    """持倉快照（增強版 - 完整實作）"""
    symbol: str
    qty: float
    avg_cost: float
    total_cost: float
    is_new_today: bool
    today_buy_qty: float
    today_sell_qty: float
    realized_pnl: float
    
    # 新增：持倉分解
    old_qty_remaining: float = 0.0
    new_qty_remaining: float = 0.0
    old_avg_cost: float = 0.0
    new_avg_cost: float = 0.0

class TransactionAnalyzer:
    """交易分析引擎（金融級 - 完整實作）"""
    
    def __init__(self, transactions_df: pd.DataFrame):
        self.df = transactions_df.copy()
        self.df['Date'] = pd.to_datetime(self.df['Date'])
        
        # 確保必要欄位存在
        for col in ['Fee', 'Tax']:
            if col not in self.df.columns:
                self.df[col] = 0.0
    
    def analyze_today_position(
        self, 
        symbol: str, 
        target_date: date, 
        fx: float = 1.0
    ) -> PositionSnapshot:
        """分析某標的在目標日期的完整持倉狀態"""
        try:
            symbol_txns = self.df[self.df['Symbol'] == symbol].sort_values('Date')
            prior_txns = symbol_txns[symbol_txns['Date'].dt.date < target_date]
            today_txns = symbol_txns[symbol_txns['Date'].dt.date == target_date]
            
            # === 步驟 1: 重建昨日收盤狀態 ===
            p_qty = 0.0
            p_cost = 0.0
            
            for _, t in prior_txns.iterrows():
                if t['Type'] == 'BUY':
                    p_qty += t['Qty']
                    p_cost += t['Qty'] * t['Price'] + t['Fee'] + t['Tax']
                elif t['Type'] == 'SELL':
                    if p_qty > 1e-9:
                        ratio = min(t['Qty'] / p_qty, 1.0)
                        p_cost *= (1 - ratio)
                        p_qty -= t['Qty']
                        p_qty = max(p_qty, 0)
            
            p_avg = p_cost / p_qty if p_qty > 1e-9 else 0.0
            initial_old_qty = p_qty
            
            # === 步驟 2: 處理今日交易（順序執行） ===
            today_buy_pool_qty = 0.0
            today_buy_pool_cost = 0.0
            today_buy_total = 0.0
            today_sell_total = 0.0
            realized_pnl = 0.0
            
            for _, t in today_txns.iterrows():
                if t['Type'] == 'BUY':
                    qty = t['Qty']
                    cost = qty * t['Price'] + t['Fee']
                    today_buy_pool_qty += qty
                    today_buy_pool_cost += cost
                    today_buy_total += qty
                    
                elif t['Type'] == 'SELL':
                    sell_qty = t['Qty']
                    today_sell_total += sell_qty
                    remaining_sell = sell_qty
                    
                    # FIFO: 優先賣出舊倉
                    if p_qty > 1e-9 and remaining_sell > 0:
                        take = min(remaining_sell, p_qty)
                        pnl = (t['Price'] - p_avg) * take - (t['Fee'] + t['Tax']) * (take / sell_qty)
                        realized_pnl += pnl
                        
                        p_qty -= take
                        p_cost -= p_avg * take
                        remaining_sell -= take
                    
                    # FIFO: 再賣出新倉（當沖）
                    if today_buy_pool_qty > 1e-9 and remaining_sell > 0:
                        t_avg = today_buy_pool_cost / today_buy_pool_qty
                        take = min(remaining_sell, today_buy_pool_qty)
                        pnl = (t['Price'] - t_avg) * take - (t['Fee'] + t['Tax']) * (take / sell_qty)
                        realized_pnl += pnl
                        
                        today_buy_pool_qty -= take
                        today_buy_pool_cost -= t_avg * take
                        remaining_sell -= take
                    
                    if remaining_sell > 1e-9:
                        logger.warning(f"{symbol} on {target_date}: Oversell detected! Remaining: {remaining_sell}")
            
            # === 步驟 3: 計算最終狀態 ===
            final_qty = p_qty + today_buy_pool_qty
            final_total_cost = p_cost + today_buy_pool_cost
            final_avg = final_total_cost / final_qty if final_qty > 1e-9 else 0.0
            
            is_new = (initial_old_qty < 1e-9) and (today_buy_total > 0)
            
            old_remaining = p_qty
            new_remaining = today_buy_pool_qty
            old_avg = p_avg
            new_avg = today_buy_pool_cost / today_buy_pool_qty if today_buy_pool_qty > 1e-9 else 0.0
            
            return PositionSnapshot(
                symbol=symbol,
                qty=final_qty,
                avg_cost=final_avg,
                total_cost=final_total_cost,
                is_new_today=is_new,
                today_buy_qty=today_buy_total,
                today_sell_qty=today_sell_total,
                realized_pnl=realized_pnl * fx,
                old_qty_remaining=old_remaining,
                new_qty_remaining=new_remaining,
                old_avg_cost=old_avg,
                new_avg_cost=new_avg
            )
            
        except Exception as e:
            logger.error(f"Failed to analyze {symbol} on {target_date}: {e}")
            return PositionSnapshot(
                symbol=symbol, qty=0, avg_cost=0, total_cost=0,
                is_new_today=False, today_buy_qty=0, today_sell_qty=0,
                realized_pnl=0
            )
    
    def get_base_price_for_pnl(
        self, 
        snapshot: PositionSnapshot, 
        yesterday_close: float
    ) -> float:
        """計算未實現損益的加權基準價"""
        if snapshot.qty < 1e-9:
            return 0.0
        
        # 如果舊倉已耗盡，強制使用新倉成本為基準（視為今日新倉）
        if snapshot.old_qty_remaining < 1e-9:
            return snapshot.new_avg_cost if snapshot.new_qty_remaining > 0 else 0.0
            
        if snapshot.is_new_today:
            return snapshot.avg_cost
        
        old_qty = snapshot.old_qty_remaining
        new_qty = snapshot.new_qty_remaining
        total_qty = snapshot.qty
        
        # 加權基準價 (混合 昨收 與 今日成本)
        # 注意: 這裡的 yesterday_close 必須是還原後的價格(若有除權息)
        weighted_base = (
            old_qty * yesterday_close + 
            new_qty * snapshot.new_avg_cost
        ) / total_qty
        
        return weighted_base
