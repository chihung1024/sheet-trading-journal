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

    # ✅ 當日損益（TWD）：總和（台股分量 + 美股分量）
    daily_pnl_twd: float = 0.0

    # ✅ Tooltip/明細用：台/美分量
    # { "tw_pnl_twd": <float>, "us_pnl_twd": <float> }
    daily_pnl_breakdown: Optional[Dict[str, float]] = None

    # ✅ 新增：市場狀態（由後端判定，避免前端自行推論）
    market_stage: Optional[str] = None
    market_stage_desc: Optional[str] = None

    # ✅ 新增：當日損益的估值基準日（用 benchmark as-of / prev trading day）
    daily_pnl_asof_date: Optional[str] = None
    daily_pnl_prev_date: Optional[str] = None

    # ✅ [v3.18] 新增：即時市值變動追蹤（匯率變動造成的未實現損益）
    live_mtm_delta_twd: float = 0.0  # 即時市值變動（TWD）
    live_mtm_delta_breakdown: Optional[Dict[str, float]] = None  # 分幣別明細 {"tw": 0.0, "us": 123.45}
    live_mtm_ref_timestamp: Optional[str] = None  # 快照基準日期（YYYY-MM-DD）

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
    
    # ✅ 新增：多群組資料字典 {group_name: PortfolioGroupData}
    groups: Dict[str, PortfolioGroupData] = {}