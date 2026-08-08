from pydantic import BaseModel, Field, StrictBool, computed_field
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
    # Legacy numeric TWR remains for snapshot/API compatibility. New snapshots use
    # twr_status to distinguish trustworthy linked returns from compatibility values.
    twr: float
    twr_status: Optional[str] = None
    twr_reason: Optional[str] = None
    twr_invalid_since: Optional[str] = None
    # Legacy numeric field retained for snapshot/API compatibility. New snapshots
    # use xirr_status to distinguish a true 0% result from an unavailable XIRR.
    xirr: float = 0.0
    xirr_status: Optional[str] = None
    xirr_reason: Optional[str] = None
    xirr_asof_date: Optional[str] = None
    xirr_cashflow_conventional: Optional[StrictBool] = None
    realized_pnl: float
    benchmark_twr: float

    # ✅ 當日損益（TWD）：總和（台股分量 + 海外分量）
    daily_pnl_twd: float = 0.0

    # Backward-compatible keys: `us_pnl_twd` now represents all non-TWD
    # securities. Native-currency provenance lives on holdings/day-ledger rows.
    daily_pnl_breakdown: Optional[Dict[str, float]] = None

    # ✅ 新增：市場狀態（由後端判定，避免前端自行推論）
    market_stage: Optional[str] = None
    market_stage_desc: Optional[str] = None

    # ✅ 新增：當日損益的估值基準日（用 benchmark as-of / prev trading day）
    daily_pnl_asof_date: Optional[str] = None
    daily_pnl_prev_date: Optional[str] = None

    # ✅ [v3.18] 新增：後端計算的當日報酬率，避免前端依賴 history 索引
    daily_pnl_roi_percent: Optional[float] = None  # 精確計算的當日報酬率百分比
    daily_pnl_base_value: Optional[float] = None   # 計算基準值（前日總資產淨值）

class HoldingPosition(BaseModel):
    symbol: str
    tag: str
    currency: str
    qty: float
    market_value_twd: float
    pnl_twd: float
    pnl_percent: float
    current_price_origin: float
    # Legacy field names retained for API compatibility; values are in the
    # holding's native currency, identified by `currency`.
    avg_cost_usd: float = 0.0
    prev_close_price: float = 0.0
    daily_change_usd: float = 0.0
    daily_change_percent: float = 0.0
    daily_pl_twd: float = 0.0
    daily_pl_breakdown: Optional[Dict[str, float]] = None

class DividendRecord(BaseModel):
    symbol: str
    ex_date: str
    pay_date: Optional[str] = None
    shares_held: float
    dividend_per_share_gross: float
    total_gross: float
    tax_rate: float = 30.0
    currency: Optional[str] = None
    total_net_native: Optional[float] = None
    # Legacy name retained for API compatibility. For non-USD assets this is
    # numerically the native-currency net amount; prefer `total_net_native`.
    total_net_usd: float
    total_net_twd: float
    # TWD per 1 native-currency unit for this dividend.
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
    day_ledger: List[Dict[str, Any]] = []
    lot_ledger: List[Dict[str, Any]] = []
    anomalies: List[Dict[str, Any]] = []

class PortfolioSnapshot(BaseModel):
    updated_at: str
    base_currency: str
    # Backward-compatible USD/TWD reference rate.
    exchange_rate: float

    # Additive provenance for benchmark-derived summary/history values.
    # Optional preserves compatibility with snapshots published before PR-10C8.
    benchmark_symbol: Optional[str] = None
    
    # 向下相容欄位 (代表 'all' 群組的總體數據)
    summary: PortfolioSummary
    holdings: List[HoldingPosition]
    history: List[Dict[str, Any]]
    pending_dividends: List[DividendRecord] = []
    
    # ✅ 新增：多群組資料字典 {group_name: PortfolioGroupData}
    groups: Dict[str, PortfolioGroupData] = {}
