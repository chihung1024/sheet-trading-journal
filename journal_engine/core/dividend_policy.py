"""Dividend withholding policy used by portfolio calculation and reconciliation.

The policy is intentionally narrow and matches the application's current supported
semantics: Taiwan-listed securities have no withholding in this model; other
currently handled securities retain the existing 30% default. Multi-currency and
jurisdiction expansion belongs to the separate currency-support program.
"""

TAIWAN_DIVIDEND_WITHHOLDING_RATE = 0.0
DEFAULT_DIVIDEND_WITHHOLDING_RATE = 0.30


def dividend_withholding_rate(symbol: str) -> float:
    """Return the modeled dividend withholding rate as a decimal fraction."""
    normalized = str(symbol or "").strip().upper()
    if normalized.endswith((".TW", ".TWO")):
        return TAIWAN_DIVIDEND_WITHHOLDING_RATE
    return DEFAULT_DIVIDEND_WITHHOLDING_RATE


def dividend_net_multiplier(symbol: str) -> float:
    """Return the modeled net/gross dividend multiplier for a symbol."""
    return 1.0 - dividend_withholding_rate(symbol)
