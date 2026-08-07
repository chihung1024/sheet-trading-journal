"""Dividend withholding policy used by portfolio calculation and reconciliation.

Automatic pending-dividend accrual must never guess a jurisdictional tax rate.
The application currently has an explicit modeled policy only for Taiwan-listed
securities (0%) and USD securities (30%, preserving the existing application
model). Other native currencies may be valued once FX is available, but their
automatic dividend accrual is rejected until a reviewed policy exists. Users may
still record an actual confirmed DIV cash flow, which requires no estimated tax.
"""

from .currency_detector import CurrencyDetector


TAIWAN_DIVIDEND_WITHHOLDING_RATE = 0.0
USD_DIVIDEND_WITHHOLDING_RATE = 0.30


class UnsupportedDividendPolicyError(ValueError):
    """Raised when automatic dividend accrual has no reviewed withholding policy."""


def dividend_withholding_rate(symbol: str) -> float:
    """Return the modeled withholding rate as a decimal fraction."""
    currency = CurrencyDetector.detect(symbol)
    if currency == 'TWD':
        return TAIWAN_DIVIDEND_WITHHOLDING_RATE
    if currency == 'USD':
        return USD_DIVIDEND_WITHHOLDING_RATE
    raise UnsupportedDividendPolicyError(
        f"Automatic dividend withholding policy is undefined for {currency} symbol {symbol}"
    )


def dividend_net_multiplier(symbol: str) -> float:
    """Return the modeled net/gross dividend multiplier for a supported symbol."""
    return 1.0 - dividend_withholding_rate(symbol)
