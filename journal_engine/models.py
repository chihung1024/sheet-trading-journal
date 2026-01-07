from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List, Dict, Any

# === 基礎交易模型 (保持不變) ===
class TransactionRecord(BaseModel):
    id: Optional[int] = None
    txn_date: date = Field(alias='Date')
    symbol: str = Field(alias='Symbol')
    txn_type: str = Field(alias='Type')
    qty: float = Field(alias='Qty')
    price: float = Field(alias='Price')
    commission: float = Field(default=0.0, alias='Commission')
    tax: float = Field(default=0.0, alias='Tax')
    tag: Optional[str] = Field(default='', alias='Tag')

    class Config:
        populate_by_name = True

class PortfolioSummary(BaseModel):
    total_value: float
    invested_capital: float
    total_pnl: float
    twr: float
    realized_pnl: float
    benchmark_twr: float

class HoldingPosition(BaseModel):
    symbol: str
    tag: str
    currency: str
    qty: float
    market_value_twd: float
    pnl_twd: float
    pnl_percent: float
    current_price_origin: float
    avg_cost_usd: float = 0.0

# === [移植新增] 平倉分析模型 ===
# 對應舊專案 closed_positions.calculator.js 中的結構
class ClosedLot(BaseModel):
    open_date: str          # 開倉日期
    close_date: str         # 平倉日期
    qty: float              # 股數
    entry_price: float      # 買入均價 (TWD)
    exit_price: float       # 賣出均價 (TWD)
    cost_basis: float       # 總成本 (TWD)
    proceeds: float         # 總收入 (TWD)
    realized_pnl: float     # 淨損益 (TWD)
    holding_days: int       # 持倉天數
    return_rate: float      # 報酬率 %

class ClosedPosition(BaseModel):
    symbol: str
    total_realized_pnl: float # 該標的總已實現損益
    win_rate: float           # 勝率
    avg_holding_days: float   # 平均持倉天數
    total_trades_count: int   # 總交易次數
    lots: List[ClosedLot]     # 詳細交易批次清單

# === [移植修改] 總表模型新增 closed_positions ===
class PortfolioSnapshot(BaseModel):
    updated_at: str
    base_currency: str
    exchange_rate: float
    summary: PortfolioSummary
    holdings: List[HoldingPosition]
    history: List[Dict[str, Any]]
    closed_positions: List[ClosedPosition] = [] # 新增此欄位
