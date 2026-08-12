"""AutoPriceSelector - price field selector.

Scheme A (recommended for this project):
- Use split-adjusted Close (price return) for valuation.
- Dividends are handled as cashflow/realized PnL via DIV records or dividend detection.

Therefore, we intentionally avoid using Adj Close to prevent dividend double-counting.
"""

import pandas as pd
import logging

logger = logging.getLogger(__name__)


class AutoPriceSelector:
    """Selects which price column to use for valuation."""

    def __init__(self, symbol: str, df: pd.DataFrame):
        self.symbol = symbol
        self.df = df
        self.selected_price = None
        self.reason = None

    def select_best_price(self) -> str:
        """Scheme A: always use 'Close' (split-adjusted, not dividend-adjusted).

        Fallback: if 'Close' is missing but 'Adj Close' exists (unexpected), use 'Adj Close'.
        """
        if 'Close' in self.df.columns:
            self.selected_price = 'Close'
            self.reason = 'Scheme A: price-return valuation uses Close (split-adjusted)'
            logger.debug(f"[{self.symbol}] {self.reason}")
            return 'Close'

        if 'Adj Close' in self.df.columns:
            self.selected_price = 'Adj Close'
            self.reason = "Fallback: 'Close' missing; using 'Adj Close'"
            logger.warning(f"[{self.symbol}] {self.reason}")
            return 'Adj Close'

        self.selected_price = 'Close'
        self.reason = "Fallback: no known price column; defaulting to 'Close'"
        logger.warning(f"[{self.symbol}] {self.reason}")
        return 'Close'

    def get_adjusted_price_series(self) -> pd.Series:
        price_field = self.select_best_price()
        if price_field in self.df.columns:
            selected = self.df[price_field].copy()
            missing_rows = self.df.loc[selected.isna()]
            if not missing_rows.empty:
                diagnostic_columns = [
                    'Open',
                    'High',
                    'Low',
                    'Close',
                    'Adj Close',
                    'Volume',
                    'Dividends',
                    'Stock Splits',
                    'Capital Gains',
                ]
                logger.error(
                    "[%s] Selected price field %s contains %s NaN row(s); "
                    "preserving fail-closed input for downstream validation",
                    self.symbol,
                    price_field,
                    len(missing_rows),
                )
                for row_index, row in missing_rows.head(10).iterrows():
                    logger.error(
                        "[%s] NaN selected-price provider row: field=%s date=%s market_fields=%s",
                        self.symbol,
                        price_field,
                        str(row_index),
                        row.reindex(diagnostic_columns).to_dict(),
                    )
            return selected
        return pd.Series(index=self.df.index, dtype=float)

    def get_metadata(self) -> dict:
        return {
            'price_source': self.selected_price,
            'selection_reason': self.reason
        }
