"""Network-free invariants for the active market-data boundary."""

from __future__ import annotations

import math
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd
import pandas.testing as pdt

from journal_engine.clients.auto_price_selector import AutoPriceSelector
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.config import DEFAULT_FX_RATE, EXCHANGE_SYMBOL, FX_NATIVE_UNIT_SCALES
from journal_engine.core.currency_detector import CurrencyDetector
from journal_engine.core.dividend_policy import (
    UnsupportedDividendPolicyError,
    dividend_withholding_rate,
    reviewed_dividend_net_multiplier,
    reviewed_dividend_withholding_rate,
)


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

    def test_cross_rate_derives_twd_per_krw_from_usd_quotes(self) -> None:
        idx = pd.to_datetime(["2026-01-02", "2026-01-03"])
        twd_per_usd = pd.Series([32.0, 33.0], index=idx)
        krw_per_usd = pd.Series([1600.0, 1650.0], index=idx)

        derived = self.client._derive_twd_per_native(twd_per_usd, krw_per_usd)

        self.assertAlmostEqual(derived.loc[idx[0]], 0.02, places=10)
        self.assertAlmostEqual(derived.loc[idx[1]], 0.02, places=10)
        self.assertTrue(self.client._derive_twd_per_native(pd.Series(dtype=float), krw_per_usd).empty)
        self.assertTrue(self.client._derive_twd_per_native(twd_per_usd, pd.Series(dtype=float)).empty)

    def test_london_gbp_cross_is_scaled_to_gbp_pence_not_major_pounds(self) -> None:
        idx = pd.to_datetime(["2026-01-02"])
        twd_per_usd = pd.Series([32.0], index=idx)
        gbp_per_usd = pd.Series([0.8], index=idx)

        twd_per_gbp = self.client._derive_twd_per_native(twd_per_usd, gbp_per_usd).iloc[0]
        twd_per_gbp_pence = twd_per_gbp * FX_NATIVE_UNIT_SCALES["GBp"]

        self.assertAlmostEqual(twd_per_gbp, 40.0)
        self.assertAlmostEqual(twd_per_gbp_pence, 0.4)
        self.assertAlmostEqual(250.0 * twd_per_gbp_pence, 100.0)

    def test_currency_detector_covers_supported_suffixes_and_fails_closed_on_missing_fx(self) -> None:
        expected = {
            "2330.TW": "TWD",
            "8069.TWO": "TWD",
            "005930.KS": "KRW",
            "035720.KQ": "KRW",
            "0700.HK": "HKD",
            "000001.SZ": "CNY",
            "7203.T": "JPY",
            "VOD.L": "GBp",
            "AIR.PA": "EUR",
            "SAP.DE": "EUR",
            "NVDA": "USD",
        }
        for symbol, currency in expected.items():
            with self.subTest(symbol=symbol):
                self.assertEqual(CurrencyDetector.detect(symbol), currency)

        self.assertTrue(CurrencyDetector.is_base_currency("2330.TW"))
        self.assertFalse(CurrencyDetector.is_base_currency("NVDA"))
        self.assertEqual(CurrencyDetector.get_fx_multiplier("2330.TW", {}), 1.0)
        self.assertEqual(CurrencyDetector.get_fx_multiplier("NVDA", 32.0), 32.0)
        self.assertEqual(
            CurrencyDetector.get_fx_multiplier("005930.KS", {"KRW": 0.022}),
            0.022,
        )
        with self.assertRaisesRegex(ValueError, "Missing KRW/TWD"):
            CurrencyDetector.get_fx_multiplier("005930.KS", {"USD": 32.0})
        with self.assertRaisesRegex(ValueError, "Invalid KRW/TWD"):
            CurrencyDetector.get_fx_multiplier("005930.KS", {"KRW": 0.0})
        with self.assertRaisesRegex(ValueError, "Invalid USD/TWD"):
            CurrencyDetector.get_fx_multiplier("NVDA", math.nan)
        with self.assertRaisesRegex(ValueError, "Currency-aware FX context required"):
            CurrencyDetector.get_fx_multiplier("005930.KS", 32.0)

    def test_currency_amount_formatting_matches_native_quote_units(self) -> None:
        self.assertEqual(CurrencyDetector.format_amount("2330.TW", 1234), "NT$1,234")
        self.assertEqual(CurrencyDetector.format_amount("NVDA", 12.5), "$12.50")
        self.assertEqual(CurrencyDetector.format_amount("005930.KS", 1234), "₩1,234")
        self.assertEqual(CurrencyDetector.format_amount("0700.HK", 12.5), "HK$12.50")
        self.assertEqual(CurrencyDetector.format_amount("VOD.L", 250), "250.00 GBp")
        self.assertEqual(CurrencyDetector.format_amount("7203.T", 250), "250.00 JPY")

    def test_download_fx_history_normalizes_timezone_and_quote_direction(self) -> None:
        fake = SimpleNamespace(
            history=lambda **kwargs: pd.DataFrame(
                {"Close": [0.03125, 0.031], "Volume": [1, 1]},
                index=pd.to_datetime(["2026-01-02", "2026-01-03"], utc=True),
            )
        )
        with patch("journal_engine.clients.market_data.yf.Ticker", return_value=fake):
            series, returned = self.client._download_fx_history(
                EXCHANGE_SYMBOL,
                pd.Timestamp("2026-01-02"),
                usd_twd=True,
            )

        self.assertIs(returned, fake)
        self.assertIsNone(series.index.tz)
        self.assertAlmostEqual(series.iloc[0], 32.0)
        self.assertGreater(series.iloc[1], 32.0)

    def test_download_fx_history_handles_missing_close_and_invalid_native_values(self) -> None:
        no_close = SimpleNamespace(
            history=lambda **kwargs: pd.DataFrame(
                {"Volume": [1]}, index=pd.to_datetime(["2026-01-02"])
            )
        )
        invalid = SimpleNamespace(
            history=lambda **kwargs: pd.DataFrame(
                {"Close": [0.0, -1.0, math.nan]},
                index=pd.to_datetime(["2026-01-02", "2026-01-03", "2026-01-04"]),
            )
        )
        with patch("journal_engine.clients.market_data.yf.Ticker", side_effect=[no_close, invalid]):
            empty_missing, _ = self.client._download_fx_history("TEST=X", pd.Timestamp("2026-01-02"))
            empty_invalid, _ = self.client._download_fx_history("TEST2=X", pd.Timestamp("2026-01-02"))

        self.assertTrue(empty_missing.empty)
        self.assertTrue(empty_invalid.empty)

    def test_realtime_quote_prefers_fast_info_then_falls_back_to_intraday(self) -> None:
        fast = SimpleNamespace(
            fast_info={"last_price": 31.5},
            history=lambda **kwargs: (_ for _ in ()).throw(AssertionError("unused")),
        )
        self.assertEqual(self.client._get_realtime_quote(fast, usd_twd=True), 31.5)

        fallback = SimpleNamespace(
            fast_info={"last_price": None, "regular_market_price": None},
            history=lambda **kwargs: pd.DataFrame({"Close": [1600.0]}),
        )
        self.assertEqual(self.client._get_realtime_quote(fallback), 1600.0)

        broken = SimpleNamespace(
            fast_info={"last_price": "bad"},
            history=lambda **kwargs: (_ for _ in ()).throw(RuntimeError("no intraday")),
        )
        self.assertIsNone(self.client._get_realtime_quote(broken))

    def test_download_currency_fx_builds_historical_and_realtime_crosses(self) -> None:
        idx = pd.to_datetime(["2026-01-02", "2026-01-03"])
        histories = {
            EXCHANGE_SYMBOL: pd.Series([32.0, 32.0], index=idx),
            "KRW=X": pd.Series([1600.0, 1600.0], index=idx),
            "GBP=X": pd.Series([0.8, 0.8], index=idx),
        }
        tickers = {name: SimpleNamespace(name=name) for name in histories}

        def fake_history(symbol, start_date, usd_twd=False):
            return histories[symbol], tickers[symbol]

        realtime = {EXCHANGE_SYMBOL: 32.0, "KRW=X": 1600.0, "GBP=X": 0.8}

        with patch.object(self.client, "_download_fx_history", side_effect=fake_history), patch.object(
            self.client,
            "_get_realtime_quote",
            side_effect=lambda ticker, usd_twd=False: realtime[ticker.name],
        ):
            self.client._download_currency_fx({"USD", "KRW", "GBp"}, pd.Timestamp("2026-01-02"))

        self.assertAlmostEqual(self.client.fx_rates_by_currency["KRW"].iloc[-1], 0.02)
        self.assertAlmostEqual(self.client.fx_rates_by_currency["GBp"].iloc[-1], 0.4)
        self.assertAlmostEqual(self.client.realtime_fx_rates_by_currency["KRW"], 0.02)
        self.assertAlmostEqual(self.client.realtime_fx_rates_by_currency["GBp"], 0.4)

    def test_fx_snapshot_and_realtime_overlay_are_currency_aware(self) -> None:
        idx = pd.to_datetime(["2026-01-02", "2026-01-03"])
        self.client.fx_rates = pd.Series([32.0, 32.5], index=idx)
        self.client.fx_rates_by_currency = {
            "USD": self.client.fx_rates,
            "KRW": pd.Series([0.021, 0.022], index=idx),
        }
        self.client.realtime_fx_rate = 33.0
        self.client.realtime_fx_rates_by_currency = {"USD": 33.0, "KRW": 0.023}

        historical = self.client.get_fx_snapshot("2026-01-03")
        before_history = self.client.get_fx_snapshot("2026-01-01")
        realtime = self.client.get_realtime_fx_snapshot("2026-01-03")

        self.assertEqual(historical["TWD"], 1.0)
        self.assertEqual(historical["USD"], 32.5)
        self.assertEqual(historical["KRW"], 0.022)
        self.assertEqual(before_history, {"TWD": 1.0})
        self.assertEqual(realtime["USD"], 33.0)
        self.assertEqual(realtime["KRW"], 0.023)

    def test_required_fx_validation_reports_missing_and_invalid_native_currency(self) -> None:
        idx = pd.to_datetime(["2026-01-02"])
        self.client.fx_rates_by_currency = {
            "USD": pd.Series([32.0], index=idx),
        }
        self.assertEqual(
            self.client.validate_required_fx_data(["SPY", "005930.KS"]),
            ["KRW"],
        )

        self.client.fx_rates_by_currency["KRW"] = pd.Series([0.0], index=idx)
        self.assertEqual(self.client.validate_required_fx_data(["005930.KS"]), ["KRW"])

        self.client.fx_rates_by_currency["KRW"] = pd.Series([0.022], index=idx)
        self.assertEqual(self.client.validate_required_fx_data(["005930.KS"]), [])

    def test_dividend_policy_exposes_reviewed_and_unreviewed_states_without_guessing(self) -> None:
        self.assertEqual(reviewed_dividend_withholding_rate("2330.TW"), 0.0)
        self.assertEqual(reviewed_dividend_withholding_rate("NVDA"), 0.30)
        self.assertEqual(reviewed_dividend_net_multiplier("NVDA"), 0.70)
        self.assertIsNone(reviewed_dividend_withholding_rate("005930.KS"))
        self.assertIsNone(reviewed_dividend_net_multiplier("005930.KS"))
        with self.assertRaises(UnsupportedDividendPolicyError):
            dividend_withholding_rate("005930.KS")

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
