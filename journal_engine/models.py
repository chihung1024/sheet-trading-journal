from pydantic import BaseModel, Field, computed_field
from datetime import date, datetime
from typing import Optional, List, Dict, Any

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

    @computed_field
    @property
    def total_amount(self) -> float:
        """計算總交易金額 = 股數 × 單價 + 手續費 + 稅"""
        base_amount = abs(self.qty * self.price)
        return base_amount + self.commission + self.tax

    class Config:
        populate_by_name = True

class PortfolioSummary(BaseModel):
    total_value: float
    invested_capital: float
    total_pnl: float
    twr: float
    xirr: float = 0.0
    realized_pnl: float
    benchmark_twr: float

class HoldingPosition(BaseModel):
    symbol: str
    tag: str = '' # 標記這筆持倉屬於哪個群組視角 (例如 'AI', 'all')
    currency: str
    qty: float
    market_value_twd: float
    pnl_twd: float
    pnl_percent: float
    current_price_origin: float
    avg_cost_usd: float = 0.0
    prev_close_price: float = 0.0
    daily_change_usd: float = 0.0
    daily_change_percent: float = 0.0
    daily_pl_twd: float = 0.0

class DividendRecord(BaseModel):
    symbol: str
    ex_date: str
    pay_date: Optional[str] = None
    shares_held: float
    dividend_per_share_gross: float
    total_gross: float
    tax_rate: float = 30.0
    total_net_usd: float
    total_net_twd: float
    fx_rate: float
    status: str = "pending"
    notes: Optional[str] = None
    record_id: Optional[int] = None

class PortfolioGroupData(BaseModel):
    """
    單一策略群組的完整數據封裝
    包含該群組獨立的摘要、持倉、歷史曲線與配息
    """
    summary: PortfolioSummary
    holdings: List[HoldingPosition]
    history: List[Dict[str, Any]]
    pending_dividends: List[DividendRecord] = []

class PortfolioSnapshot(BaseModel):
    updated_at: str
    base_currency: str
    exchange_rate: float
    
    # --- 向下相容區塊 (對應 'all' 群組) ---
    summary: PortfolioSummary
    holdings: List[HoldingPosition]
    history: List[Dict[str, Any]]
    pending_dividends: List[DividendRecord] = []
    
    # --- 新增：多群組資料字典 ---
    # Key 為群組名稱 (如 "LongTerm", "AI"), Value 為該群組的計算結果
    groups: Dict[str, PortfolioGroupData] = {}
