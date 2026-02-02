import pandas as pd
from datetime import date
from collections import deque
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class PositionSnapshot:
    """[v14.0] 標的物當日狀態快照，用於精確損益歸因"""
    symbol: str
    qty: float = 0.0              # 當前總持倉股數
    avg_cost: float = 0.0         # 歷史平均成本
    
    # --- 當日動態 ---
    is_new_today: bool = False    # 是否為今日純新開倉 (昨日持倉為 0)
    old_qty_remaining: float = 0.0 # 昨日留存到現在的股數 (T0 股數)
    new_qty_remaining: float = 0.0 # 今日買入且尚未賣出的股數
    new_avg_cost: float = 0.0     # 今日買入部分的平均成本
    
    # --- 實現損益 ---
    realized_pnl: float = 0.0     # 今日已實現損益 (原幣)
    realized_pnl_vs_prev_close: float = 0.0 # 考慮匯率校正用的過渡欄位

class TransactionAnalyzer:
    """
    交易分析器：負責執行 FIFO 演算法並分析持倉狀態。
    """
    
    def __init__(self, transactions_df: pd.DataFrame):
        """
        初始化分析器
        Args:
            transactions_df: 包含 Date, Symbol, Type, Qty, Price, Commission, Tax 的 DataFrame
        """
        self.df = transactions_df.copy()
        if not self.df.empty:
            self.df['Date'] = pd.to_datetime(self.df['Date']).dt.date
            # 統一數值型別
            for col in ['Qty', 'Price', 'Commission', 'Tax']:
                self.df[col] = pd.to_numeric(self.df[col], errors='coerce').fillna(0.0)

    def get_current_holdings(self, tag_filter: Optional[str] = None) -> Dict[str, Dict]:
        """
        計算截至目前的持倉與平均成本。
        """
        df = self.df
        if tag_filter:
            df = df[df['Tag'].apply(lambda x: tag_filter in str(x) if x else False)]
            
        holdings = {}
        fifo_queues = {} # {symbol: deque([{'qty':, 'price':, 'cost':}])}
        
        # 按日期與類型排序 (BUY 優先於 SELL 以處理同日交易)
        df = df.sort_values(by=['Date', 'Type'], ascending=[True, True])
        
        for _, row in df.iterrows():
            sym = row['Symbol']
            if row['Type'] == 'BUY':
                if sym not in holdings:
                    holdings[sym] = {'qty': 0.0, 'cost_basis': 0.0, 'avg_cost': 0.0, 'tags': []}
                    fifo_queues[sym] = deque()
                
                total_cost = (row['Qty'] * row['Price']) + row['Commission'] + row['Tax']
                holdings[sym]['qty'] += row['Qty']
                holdings[sym]['cost_basis'] += total_cost
                fifo_queues[sym].append({
                    'qty': row['Qty'],
                    'price': row['Price'],
                    'cost_per_share': total_cost / row['Qty'] if row['Qty'] > 0 else 0
                })
                if row['Tag'] and row['Tag'] not in holdings[sym]['tags']:
                    holdings[sym]['tags'].append(row['Tag'])
                    
            elif row['Type'] == 'SELL':
                if sym not in fifo_queues or not fifo_queues[sym]:
                    continue
                
                qty_to_sell = row['Qty']
                while qty_to_sell > 1e-6 and fifo_queues[sym]:
                    batch = fifo_queues[sym][0]
                    take = min(qty_to_sell, batch['qty'])
                    
                    # 比例分攤成本
                    cost_reduction = (take / batch['qty']) * batch['cost_per_share'] * batch['qty']
                    holdings[sym]['qty'] -= take
                    holdings[sym]['cost_basis'] -= cost_reduction
                    
                    batch['qty'] -= take
                    qty_to_sell -= take
                    
                    if batch['qty'] < 1e-6:
                        fifo_queues[sym].popleft()
                
                if holdings[sym]['qty'] < 1e-6:
                    del holdings[sym]
                    del fifo_queues[sym]
        
        # 更新最後的平均成本
        for sym in holdings:
            holdings[sym]['avg_cost'] = holdings[sym]['cost_basis'] / holdings[sym]['qty']
            
        return holdings

    def analyze_today_position(self, symbol: str, today_date: date) -> PositionSnapshot:
        """
        🚀 [v14.0 核心方法] 分析特定標的在「今日」的持倉組成。
        用於區分哪些是從昨天留下來的 (T0)，哪些是今天新買的。
        """
        sym_df = self.df[self.df['Symbol'] == symbol].sort_values(['Date', 'Type'])
        
        # 1. 計算截至昨日為止的持倉
        prev_qty = 0.0
        fifo_q = deque()
        
        hist_df = sym_df[sym_df['Date'] < today_date]
        for _, row in hist_df.iterrows():
            if row['Type'] == 'BUY':
                fifo_q.append({'qty': row['Qty'], 'price': row['Price'], 'cost': (row['Qty']*row['Price'])+row['Commission']+row['Tax']})
                prev_qty += row['Qty']
            elif row['Type'] == 'SELL' and fifo_q:
                rem = row['Qty']
                while rem > 1e-6 and fifo_q:
                    take = min(rem, fifo_q[0]['qty'])
                    fifo_q[0]['qty'] -= take
                    prev_qty -= take
                    rem -= take
                    if fifo_q[0]['qty'] < 1e-6: fifo_q.popleft()

        # 2. 分析今日交易
        today_tx = sym_df[sym_df['Date'] == today_date]
        realized_pnl = 0.0
        new_buy_qty = 0.0
        new_buy_cost = 0.0
        
        # 模擬今日流程
        for _, row in today_tx.iterrows():
            if row['Type'] == 'BUY':
                total_cost = (row['Qty'] * row['Price']) + row['Commission'] + row['Tax']
                fifo_q.append({'qty': row['Qty'], 'price': row['Price'], 'cost': total_cost, 'is_new': True})
                new_buy_qty += row['Qty']
                new_buy_cost += total_cost
            elif row['Type'] == 'SELL' and fifo_q:
                rem = row['Qty']
                sell_price = row['Price']
                while rem > 1e-6 and fifo_q:
                    batch = fifo_q[0]
                    take = min(rem, batch['qty'])
                    cost_per_share = batch['cost'] / (batch['qty'] + 1e-9) if 'cost' in batch else batch['price']
                    
                    # 計算已實現損益 (賣價 - 成本)
                    realized_pnl += take * (sell_price - cost_per_share)
                    
                    if batch.get('is_new'):
                        new_buy_qty -= take
                        # 簡化處理：新買入部分的成本按比例扣除
                    else:
                        prev_qty -= take
                        
                    batch['qty'] -= batch['qty'] if batch['qty'] <= take else take
                    rem -= take
                    if batch['qty'] < 1e-6: fifo_q.popleft()

        # 3. 組裝結果
        total_qty = prev_qty + new_buy_qty
        return PositionSnapshot(
            symbol=symbol,
            qty=total_qty,
            is_new_today=(prev_qty < 1e-6 and new_buy_qty > 0),
            old_qty_remaining=prev_qty,
            new_qty_remaining=new_buy_qty,
            new_avg_cost=new_buy_cost / (new_buy_qty if new_buy_qty > 0 else 1),
            realized_pnl=realized_pnl
        )

    def get_base_price_for_pnl(self, snapshot: PositionSnapshot, prev_close_price: float) -> float:
        """
        🚀 [v14.0 核心方法] 計算資產淨值法 (NAV) 的損益基準價 P0。
        
        邏輯：
        - 若全為舊倉：P0 = 昨日收盤價
        - 若全為今日新買入：P0 = 買入平均成本
        - 若為加碼：P0 = (舊倉股數*昨日收盤 + 新買股數*買入成本) / 總股數
        """
        if snapshot.qty <= 0:
            return 0.0
        
        # 加權平均計算基準價值
        total_base_value = (snapshot.old_qty_remaining * prev_close_price) + \
                           (snapshot.new_qty_remaining * snapshot.new_avg_cost)
        
        return total_base_value / snapshot.qty
