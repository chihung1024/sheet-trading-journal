"""Network-free invariants for the active market-data boundary."""

from __future__ import annotations

import math
import unittest
from unittest.mock import patch

import pandas as pd
import pandas.testing as pdt

from journal_engine.clients.auto_price_selector import AutoPriceSelector
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.config import DEFAULT_FX_RATE


class AutoPriceSelectorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.index = pd.to_datetime(["2026-01-02", "2026-01-05"])

    def test_close_is_preferred_and_returned_as_an_isolated_copy(self) -> None:
        frame = pd.DataFrame(
            {"Close": [10.0, 11.0], "Adj Close": [8.0, 8.5]},
            index=self.index,
        )
        selector = AutoPriceSelector("TEST", frame)

        selected = selector.get_adjusted_price_series()
        pdt.assert_series_equal(selected, frame["Close"])
        selected.iloc[0] = 999.0

        self.assertEqual(frame.iloc[0]["Close"], 10.0)
        self.assertEqual(
            selector.get_metadata(),
            {
                "price_source": "Close",
                "selection_reason": "Scheme A: price-return valuation uses Close (split-adjusted)",
            },
        )

    def test_adj_close_is_used_only_when_close_is_absent(self) -> None:
        frame = pd.DataFrame({"Adj Close": [8.0, 8.5]}, index=self.index)
        selector = AutoPriceSelector("TEST", frame)

        self.assertEqual(selector.select_best_price(), "Adj Close")
        pdt.assert_series_equal(selector.get_adjusted_price_series(), frame["Adj Close"])
        self.assertEqual(selector.get_metadata()["price_source"], "Adj Close")

    def test_missing_price_columns_return_an_empty_aligned_float_series(self) -> None:
        frame = pd.DataFrame({"Volume": [100, 200]}, index=self.index)
        selector = AutoPriceSelector("TEST", frame)

        result = selector.get_adjusted_price_series()

        self.assertEqual(result.dtype, float)
        self.assertTrue(result.isna().all())
        self.assertEqual(list(result.index), list(self.index))
        self.assertEqual(selector.get_metadata()["price_source"], "Close")


class MarketDataPureInvariantTests(unittest.TestCase):
    def setUp(self) -> None:
        self.network_guard = patch(
            "journal_engine.clients.market_data.yf.Ticker",
            side_effect=AssertionError("network access is forbidden in pure market-data tests"),
        )
        self.network_guard.start()
        self.addCleanup(self.network_guard.stop)
        self.client = MarketDataClient()
        self.index = pd.to_datetime(["2026-01-02", "2026-01-04", "2026-01-05"])

    def _prepared_frame(self) -> pd.DataFrame:
        raw = pd.DataFrame(
            {
                "Close": [50.0, 26.0, 27.0],
                "Adj Close": [40.0, 22.0, 23.0],
                "Stock Splits": [0.0, 2.0, 0.0],
                "Dividends": [0.0, 0.5, 0.0],
            },
            index=self.index,
        )
        return self.client._prepare_data("TEST", raw)

    def test_fx_normalization_preserves_direct_and_inverts_reciprocal_quotes(self) -> None:
        self.assertEqual(self.client._normalize_twd_per_usd(31.5), 31.5)
        self.assertEqual(self.client._normalize_twd_per_usd(0.03125), 32.0)

    def test_fx_normalization_falls_back_for_invalid_or_non_finite_values(self) -> None:
        for value in (0, -1, "bad", None, math.nan, math.inf, -math.inf):
            with self.subTest(value=value):
                self.assertEqual(
                    self.client._normalize_twd_per_usd(value),
                    DEFAULT_FX_RATE,
                )

    def test_prepare_data_uses_close_and_builds_cumulative_split_factors(self) -> None:
        prepared = self._prepared_frame()

        pdt.assert_series_equal(
            prepared["Close_Adjusted"],
            prepared["Close"],
            check_names=False,
        )
        pdt.assert_series_equal(
            prepared["Close_Raw"],
            prepared["Close"],
            check_names=False,
        )
        self.assertEqual(prepared["Split_Factor"].tolist(), [2.0, 1.0, 1.0])
        self.assertEqual(prepared["Dividend_Adj_Factor"].tolist(), [1.0, 1.0, 1.0])

    def test_prepare_data_supports_adj_close_fallback_and_missing_split_column(self) -> None:
        raw = pd.DataFrame({"Adj Close": [8.0, 8.5, 9.0]}, index=self.index)

        prepared = self.client._prepare_data("TEST", raw)

        pdt.assert_series_equal(
            prepared["Close_Adjusted"],
            raw["Adj Close"],
            check_names=False,
        )
        pdt.assert_series_equal(
            prepared["Close_Raw"],
            raw["Adj Close"],
            check_names=False,
        )
        self.assertEqual(prepared["Stock Splits"].tolist(), [0.0, 0.0, 0.0])
        self.assertEqual(prepared["Split_Factor"].tolist(), [1.0, 1.0, 1.0])

    def test_get_price_uses_exact_or_previous_available_date(self) -> None:
        self.client.market_data["TEST"] = self._prepared_frame()

        self.assertEqual(self.client.get_price("TEST", self.index[1]), 26.0)
        self.assertEqual(self.client.get_price("TEST", pd.Timestamp("2026-01-03")), 50.0)
        self.assertEqual(self.client.get_price("TEST", pd.Timestamp("2026-01-01")), 0.0)
        self.assertEqual(self.client.get_price("MISSING", self.index[0]), 0.0)

    def test_get_price_asof_returns_the_actual_valuation_date(self) -> None:
        self.client.market_data["TEST"] = self._prepared_frame()

        exact = self.client.get_price_asof("TEST", "2026-01-04")
        gap = self.client.get_price_asof("TEST", "2026-01-03")
        before = self.client.get_price_asof("TEST", "2026-01-01")
        missing = self.client.get_price_asof("MISSING", "2026-01-03 18:00+08:00")

        self.assertEqual(exact, (26.0, pd.Timestamp("2026-01-04")))
        self.assertEqual(gap, (50.0, pd.Timestamp("2026-01-02")))
        self.assertEqual(before, (0.0, pd.Timestamp("2026-01-01")))
        self.assertEqual(missing, (0.0, pd.Timestamp("2026-01-03")))

    def test_previous_trading_date_handles_exact_gap_first_and_missing_symbol(self) -> None:
        self.client.market_data["TEST"] = self._prepared_frame()

        self.assertEqual(
            self.client.get_prev_trading_date("TEST", "2026-01-04"),
            pd.Timestamp("2026-01-02"),
        )
        self.assertEqual(
            self.client.get_prev_trading_date("TEST", "2026-01-03"),
            pd.Timestamp("2026-01-02"),
        )
        self.assertEqual(
            self.client.get_prev_trading_date("TEST", "2026-01-01"),
            pd.Timestamp("2026-01-01"),
        )
        self.assertEqual(
            self.client.get_prev_trading_date("MISSING", "2026-01-03 18:00+08:00"),
            pd.Timestamp("2026-01-03"),
        )

    def test_transaction_multiplier_uses_exact_asof_and_first_known_factor(self) -> None:
        self.client.market_data["TEST"] = self._prepared_frame()

        self.assertEqual(self.client.get_transaction_multiplier("TEST", "2026-01-02"), 2.0)
        self.assertEqual(self.client.get_transaction_multiplier("TEST", "2026-01-03"), 2.0)
        self.assertEqual(self.client.get_transaction_multiplier("TEST", "2026-01-01"), 2.0)
        self.assertEqual(
            self.client.get_transaction_multiplier(
                "TEST", pd.Timestamp("2026-01-04", tz="UTC")
            ),
            1.0,
        )
        self.assertEqual(self.client.get_transaction_multiplier("MISSING", "2026-01-02"), 1.0)

    def test_dividend_accessors_preserve_scheme_a_semantics(self) -> None:
        self.client.market_data["TEST"] = self._prepared_frame()

        self.assertEqual(self.client.get_dividend("TEST", self.index[1]), 0.5)
        self.assertEqual(self.client.get_dividend("TEST", pd.Timestamp("2026-01-03")), 0.0)
        self.assertEqual(self.client.get_dividend("MISSING", self.index[1]), 0.0)
        self.assertEqual(self.client.get_dividend_adjustment_factor("TEST", self.index[1]), 1.0)


if __name__ == "__main__":
    unittest.main()
