"""Dividend withholding policy used by portfolio calculation and reconciliation.

Automatic pending-dividend accrual must never guess a jurisdictional tax rate.
The application currently has an explicit modeled policy only for Taiwan-listed
securities (0%) and USD securities (30%, preserving the existing application
model). Other native currencies may be valued once FX is available, but their
automatic dividend accrual is deferred until a reviewed policy exists. Users may
still record an actual confirmed DIV cash flow, which requires no estimated tax.
"""

from typing import Optional

from .currency_detector import CurrencyDetector


TAIWAN_DIVIDEND_WITHHOLDING_RATE = 0.0
USD_DIVIDEND_WITHHOLDING_RATE = 0.30


class UnsupportedDividendPolicyError(ValueError):
    """Raised when a caller requires an unreviewed automatic withholding policy."""


def reviewed_dividend_withholding_rate(symbol: str) -> Optional[float]:
    """Return a reviewed rate, or ``None`` when no automatic policy exists."""
    currency = CurrencyDetector.detect(symbol)
    if currency == 'TWD':
        return TAIWAN_DIVIDEND_WITHHOLDING_RATE
    if currency == 'USD':
        return USD_DIVIDEND_WITHHOLDING_RATE
    return None


def dividend_withholding_rate(symbol: str) -> float:
    """Return the modeled withholding rate, failing closed if it is unreviewed."""
    rate = reviewed_dividend_withholding_rate(symbol)
    if rate is None:
        currency = CurrencyDetector.detect(symbol)
        raise UnsupportedDividendPolicyError(
            f"Automatic dividend withholding policy is undefined for {currency} symbol {symbol}"
        )
    return rate


def reviewed_dividend_net_multiplier(symbol: str) -> Optional[float]:
    """Return reviewed net/gross multiplier, or ``None`` when accrual must wait."""
    rate = reviewed_dividend_withholding_rate(symbol)
    return None if rate is None else 1.0 - rate


def dividend_net_multiplier(symbol: str) -> float:
    """Return the modeled net/gross multiplier for a supported symbol."""
    return 1.0 - dividend_withholding_rate(symbol)
