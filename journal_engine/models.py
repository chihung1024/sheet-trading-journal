from pydantic import BaseModel, Field, computed_field, model_validator
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
    daily_pnl_twd: float = 0.0
    daily_pnl_breakdown: Optional[Dict[str, float]] = None
    market_stage: Optional[str] = None
    market_stage_desc: Optional[str] = None
    daily_pnl_asof_date: Optional[str] = None
    daily_pnl_prev_date: Optional[str] = None
    daily_pnl_roi_percent: Optional[float] = None
    daily_pnl_base_value: Optional[float] = None

class HoldingPosition(BaseModel):
    symbol: str
    # [FIX] tag: str → Optional[str] = None
    # 根因：holdings[sym] 初始化時 tag=row['Tag']，資料庫中 Tag 欄位可為 NULL。
    # h.get('tag') 回傳 None，Pydantic str 不接受 None，觸發 ValidationError。
    tag: Optional[str] = None
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
    daily_pl_breakdown: Optional[Dict[str, float]] = None

class DividendRecord(BaseModel):
    symbol: str
    ex_date: str
    pay_date: Optional[str] = None
    shares_held: float
    dividend_per_share_gross: float
    total_gross: float

    # 百分比形式（30.0 = 30%）；預設美股 30%，台股應傳入 0.0
    tax_rate: float = 30.0

    # [FIX] Optional[float] + model_validator 自動補算
    #
    # 根因：calculator.py 的 dividend_history.append({...}) 從未填入此欄位，
    # 導致三位使用者均拋出 ValidationError: Field required，全面崩潰。
    #
    # 修正策略（雙層防禦）：
    #   Layer 1 → calculator.py 正確計算並填入（治本，見修正 2）
    #   Layer 2 → 此 validator 容錯補算（防止未來類似遺漏再次崩潰）
    total_net_usd: Optional[float] = None

    total_net_twd: float
    fx_rate: float
    status: str = "pending"
    notes: Optional[str] = None
    record_id: Optional[int] = None

    @model_validator(mode='after')
    def compute_missing_fields(self) -> 'DividendRecord':
        """
        若 total_net_usd 未由上游填入，自動由 total_gross 與 tax_rate 補算。

        US 股票: total_net_usd = total_gross(USD) × (1 - tax_rate/100)
        台  股: tax_rate=0，total_net_usd = total_gross(TWD 單位)
               台股此欄位語意有限，但維持欄位完整性避免序列化問題。
        """
        if self.total_net_usd is None:
            self.total_net_usd = round(
                self.total_gross * (1.0 - self.tax_rate / 100.0), 4
            )
        return self

class PortfolioGroupData(BaseModel):
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
    exchange_rate: float
    summary: PortfolioSummary
    holdings: List[HoldingPosition]
    history: List[Dict[str, Any]]
    pending_dividends: List[DividendRecord] = []
    groups: Dict[str, PortfolioGroupData] = {}
