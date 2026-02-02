"""
CurrencyDetector - 货币自动识别器
基于 Symbol 后缀自动检测交易标的的计价货币
"""

import logging

logger = logging.getLogger(__name__)


class CurrencyDetector:
    """
    基于 Symbol 的货币自动识别
    - 无需数据库字段
    - 无需手动配置
    - 支持扩展
    """
    
    # 货币规则映射（可扩展）
    CURRENCY_RULES = {
        'TWD': ['.TW', '.TWO'],  # 台湾证券交易所
        'HKD': ['.HK', '.HKG'],  # 香港交易所
        'CNY': ['.SS', '.SZ'],   # 上海/深圳交易所
        'JPY': ['.T'],           # 东京证券交易所
        'GBP': ['.L'],           # 伦敦证券交易所
        'EUR': ['.PA', '.DE'],   # 巴黎/法兰克福交易所
        'USD': []                # 默认（无后缀或其他）
    }
    
    @classmethod
    def detect(cls, symbol: str) -> str:
        """
        自动检测交易标的的货币
        
        示例：
        - 'NVDA' → 'USD'
        - '2330.TW' → 'TWD'
        - '0700.HK' → 'HKD'
        """
        symbol_upper = symbol.upper()
        
        for currency, suffixes in cls.CURRENCY_RULES.items():
            if any(symbol_upper.endswith(suffix) for suffix in suffixes):
                return currency
        
        # 默认 USD
        return 'USD'
    
    @classmethod
    def get_fx_multiplier(cls, symbol: str, fx_rate: float) -> float:
        """
        获取汇率乘数
        - 基准货币（TWD）→ 1.0
        - 外币 → fx_rate
        """
        currency = cls.detect(symbol)
        
        if currency == 'TWD':
            return 1.0
        elif currency == 'USD':
            return fx_rate
        else:
            # 其他货币暂不支持，返回 1.0 并警告
            logger.warning(f"Unsupported currency {currency} for {symbol}, using 1.0")
            return 1.0
    
    @classmethod
    def format_amount(cls, symbol: str, amount: float) -> str:
        """格式化金额显示"""
        currency = cls.detect(symbol)
        
        if currency == 'TWD':
            return f"NT${amount:,.0f}"
        elif currency == 'USD':
            return f"${amount:,.2f}"
        elif currency == 'HKD':
            return f"HK${amount:,.2f}"
        else:
            return f"{amount:,.2f} {currency}"
    
    @classmethod
    def is_base_currency(cls, symbol: str) -> bool:
        """检查是否为基准货币 (TWD)"""
        return cls.detect(symbol) == 'TWD'
