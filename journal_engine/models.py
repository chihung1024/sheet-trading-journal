from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List, Dict, Any

# === 基礎交易模型 ===
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

# === [階段 3 新增] 平倉分析模型 ===
class ClosedLot(BaseModel):
    open_date: str          
    close_date: str         
    qty: float              
    entry_price: float      
    exit_price: float       
    cost_basis: float       
    proceeds: float         
    realized_pnl: float     
    holding_days: int       
    return_rate: float      
    dividends_collected: float = 0.0  # [新增] 該批次歸因的股息總額

class ClosedPosition(BaseModel):
    symbol: str
    total_realized_pnl: float 
    total_dividends: float    # [新增] 該標的平倉部分包含的總股息
    win_rate: float           
    avg_holding_days: float   
    total_trades_count: int   
    lots: List[ClosedLot]     

class PortfolioSnapshot(BaseModel):
    updated_at: str
    base_currency: str
    exchange_rate: float
    summary: PortfolioSummary
    holdings: List[HoldingPosition]
    history: List[Dict[str, Any]]
    closed_positions: List[ClosedPosition] = []
