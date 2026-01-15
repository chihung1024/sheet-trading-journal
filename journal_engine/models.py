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
    xirr: float = 0.0  # ✅ XIRR (擴展內部報酬率)
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
    
    # ✅ 用於計算今日損益的欄位
    prev_close_price: float = 0.0       # 前一交易日收盤價 (USD)
    daily_change_usd: float = 0.0       # 今日漲跌金額 (USD)
    daily_change_percent: float = 0.0   # 今日漲跌幅 (%)
    daily_pl_twd: float = 0.0           # ✅ 新增：當日損益台幣金額 (正確計算)

class DividendRecord(BaseModel):
    """
    配息記錄模型
    
    狀態說明：
    - pending: 待確認（系統自動抓取，但未確認）
    - confirmed: 已確認（使用者手動輸入或確認）
    """
    symbol: str
    ex_date: str  # 除息日 (YYYY-MM-DD)
    pay_date: Optional[str] = None  # 發放日 (YYYY-MM-DD)
    shares_held: float  # 除息日持股數
    dividend_per_share_gross: float  # 每股配息(稅前, USD)
    total_gross: float  # 總配息(稅前, USD)
    tax_rate: float = 30.0  # 稅率 (%)
    total_net_usd: float  # 稅後配息 (USD)
    total_net_twd: float  # 稅後配息 (TWD)
    fx_rate: float  # 匯率
    status: str = "pending"  # pending | confirmed
    notes: Optional[str] = None  # 備註
    record_id: Optional[int] = None  # ✅ 新增：已確認的 transaction ID

class GroupStats(BaseModel):
    """
    【新增】單一群組的統計數據封裝
    原本 PortfolioSnapshot 的統計數據層，現在下移至此
    """
    summary: PortfolioSummary
    holdings: List[HoldingPosition]
    history: List[Dict[str, Any]]
    pending_dividends: List[DividendRecord] = []

class PortfolioSnapshot(BaseModel):
    """
    【修改】最終輸出的總體快照 (包含多個群組)
    """
    updated_at: str
    base_currency: str
    exchange_rate: float
    # 核心改變：使用 Dictionary 儲存不同群組的數據
    # Key 為群組名稱 (例如 "ALL", "LongTerm", "ShortTerm")
    groups: Dict[str, GroupStats]
