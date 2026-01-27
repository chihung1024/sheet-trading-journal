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
    
    # 當日損益（TWD），口徑：Δ市值 + 當日已實現損益
    daily_pnl_twd: float = 0.0
    
    # ✅ v2.40 新增：時區與損益細項
    realized_pnl_today: float = 0.0  # 當日已實現損益 (Fixed PnL)
    daily_pnl_us: float = 0.0        # 美股未實現損益 (Floating PnL)
    daily_pnl_tw: float = 0.0        # 台股未實現損益 (Floating PnL)
    market_stage: str = ""           # 當前市場階段描述 (如: 美股盤中/台股盤後)
    updated_at_tw: str = ""          # 台灣時間更新戳記 (HH:MM)

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
    prev_close_price: float = 0.0
    daily_change_usd: float = 0.0
    daily_change_percent: float = 0.0
    daily_pl_twd: float = 0.0
    
    # ✅ v2.40 新增：交易活動與損益細節
    realized_pnl_today: float = 0.0  # 個股當日已實現損益
    today_buy_qty: float = 0.0       # 今日買入數量
    today_sell_qty: float = 0.0      # 今日賣出數量
    is_new_position: bool = False    # 是否為今日新建立的倉位

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
    """單一策略群組的完整投資組合數據"""
    summary: PortfolioSummary
    holdings: List[HoldingPosition]
    history: List[Dict[str, Any]]
    pending_dividends: List[DividendRecord] = []

class PortfolioSnapshot(BaseModel):
    updated_at: str
    base_currency: str
    exchange_rate: float
    
    # 向下相容欄位 (代表 'all' 群組的總體數據)
    summary: PortfolioSummary
    holdings: List[HoldingPosition]
    history: List[Dict[str, Any]]
    pending_dividends: List[DividendRecord] = []
    
    # 多群組資料字典 {group_name: PortfolioGroupData}
    groups: Dict[str, PortfolioGroupData] = {}
