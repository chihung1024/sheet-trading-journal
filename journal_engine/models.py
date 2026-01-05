from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List, Dict, Any

class TransactionRecord(BaseModel):
    id: Optional[int] = None
    txn_date: date = Field(alias='Date') # 對應原始 pandas 轉換後的欄位
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

class PortfolioSnapshot(BaseModel):
    updated_at: str
    base_currency: str
    exchange_rate: float
    summary: PortfolioSummary
    holdings: List[HoldingPosition]
    history: List[Dict[str, Any]]
