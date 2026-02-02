from ..config import Config

class CurrencyDetector:
    """
    幣別識別器 (v14.0)
    負責判定標的代碼所屬的幣別，並提供對應的匯率轉換係數。
    """

    def __init__(self, base_currency: str = "TWD"):
        """
        初始化識別器
        Args:
            base_currency: 系統基準幣別，預設為台幣 (TWD)
        """
        self.base_currency = base_currency

    def is_base_currency(self, symbol: str) -> bool:
        """
        判斷標的是否為本幣資產 (台股)。
        
        判斷標準：
        - Yahoo Finance 代碼後綴為 .TW (上市) 或 .TWO (上櫃)
        """
        if not symbol or not isinstance(symbol, str):
            return False
            
        upper_sym = symbol.upper()
        return upper_sym.endswith(".TW") or upper_sym.endswith(".TWO")

    def detect(self, symbol: str) -> str:
        """
        識別並回傳標的的原始結算幣別。
        
        Returns:
            "TWD" (台幣) 或 "USD" (美金)。目前預設非台股標的皆視為美金資產。
        """
        if self.is_base_currency(symbol):
            return self.base_currency
        return "USD"

    def get_fx_multiplier(self, symbol: str, current_fx_rate: float) -> float:
        """
        獲取該標的計算市值與損益時所需的匯率乘數。
        
        邏輯：
        - 若為台股：回傳 1.0 (台幣資產不需再乘匯率)
        - 若為美股：回傳傳入的 USD/TWD 即時匯率
        
        Args:
            symbol: 標的代碼
            current_fx_rate: 當前系統抓取到的美金兌台幣匯率
        """
        if self.is_base_currency(symbol):
            return 1.0
        
        # 確保匯率為有效數值
        if current_fx_rate is None or current_fx_rate <= 0:
            return 1.0
            
        return current_fx_rate
