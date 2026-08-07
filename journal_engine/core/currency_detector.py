"""
CurrencyDetector - 標的原生計價幣別辨識器。

以 Yahoo Finance 常見市場 suffix 辨識交易標的原生幣別。實際換算成
TWD 的歷史／即時匯率由 MarketDataClient 提供；本模組不再對未提供的
外幣匯率靜默回傳 1.0。
"""

from collections.abc import Mapping
import logging
import math

logger = logging.getLogger(__name__)


class CurrencyDetector:
    """依 Symbol suffix 辨識原生計價幣別。"""

    CURRENCY_RULES = {
        'TWD': ['.TW', '.TWO'],
        'KRW': ['.KS', '.KQ'],
        'HKD': ['.HK', '.HKG'],
        'CNY': ['.SS', '.SZ'],
        'JPY': ['.T'],
        'GBP': ['.L'],
        'EUR': ['.PA', '.DE'],
        'USD': [],
    }

    @classmethod
    def detect(cls, symbol: str) -> str:
        """辨識標的原生計價幣別；無已知 suffix 時維持 USD 相容行為。"""
        symbol_upper = str(symbol or '').strip().upper()

        for currency, suffixes in cls.CURRENCY_RULES.items():
            if any(symbol_upper.endswith(suffix) for suffix in suffixes):
                return currency
        return 'USD'

    @classmethod
    def get_fx_multiplier(cls, symbol: str, fx_context) -> float:
        """取得「TWD / 1 原生幣」換算乘數。

        `fx_context` 可為：
        - 傳統單一 float：僅支援 USD/TWD 相容路徑；
        - mapping：key 為幣別、value 為 TWD per native currency。

        對 KRW/HKD/CNY/JPY/GBP/EUR 若沒有 currency-aware context，必須
        fail closed；不得再以 1.0 代替真實匯率。
        """
        currency = cls.detect(symbol)

        if currency == 'TWD':
            return 1.0

        if isinstance(fx_context, Mapping):
            if currency not in fx_context:
                raise ValueError(f"Missing {currency}/TWD FX context for {symbol}")
            rate = float(fx_context[currency])
            if not math.isfinite(rate) or rate <= 0:
                raise ValueError(f"Invalid {currency}/TWD FX rate for {symbol}: {rate}")
            return rate

        if currency == 'USD':
            rate = float(fx_context)
            if not math.isfinite(rate) or rate <= 0:
                raise ValueError(f"Invalid USD/TWD FX rate for {symbol}: {rate}")
            return rate

        raise ValueError(
            f"Currency-aware FX context required for {currency} symbol {symbol}"
        )

    @classmethod
    def format_amount(cls, symbol: str, amount: float) -> str:
        """以原生幣別格式化金額。"""
        currency = cls.detect(symbol)

        if currency == 'TWD':
            return f"NT${amount:,.0f}"
        if currency == 'USD':
            return f"${amount:,.2f}"
        if currency == 'KRW':
            return f"₩{amount:,.0f}"
        if currency == 'HKD':
            return f"HK${amount:,.2f}"
        return f"{amount:,.2f} {currency}"

    @classmethod
    def is_base_currency(cls, symbol: str) -> bool:
        """是否以 TWD 計價。"""
        return cls.detect(symbol) == 'TWD'
