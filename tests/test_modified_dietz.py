import math
import unittest

from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.performance_metrics import (
    annotate_twr_history,
    calculate_modified_dietz_metric,
)


class TestModifiedDietzMethod(unittest.TestCase):
    def test_modified_dietz_no_cashflow_equals_simple_return(self):
        """沒有現金流時，Modified Dietz 應等同簡單報酬率。"""
        r = PortfolioCalculator._calculate_modified_dietz_return(
            beginning_value=100.0,
            ending_value=110.0,
            cashflows=[],
        )
        self.assertAlmostEqual(r, 0.10, places=8)

    def test_modified_dietz_default_daily_weight(self):
        """日頻資料預設權重 w=0.5 的既有數字不可漂移。"""
        r = PortfolioCalculator._calculate_modified_dietz_return(
            beginning_value=100.0,
            ending_value=130.0,
            cashflows=[20.0],
        )
        self.assertAlmostEqual(r, 10.0 / 110.0, places=8)

        metric = calculate_modified_dietz_metric(100.0, 130.0, [20.0])
        self.assertEqual(metric.status, "ok")
        self.assertIsNone(metric.reason)
        self.assertAlmostEqual(metric.value, r, places=8)

    def test_modified_dietz_with_custom_weights(self):
        """精確權重的合法路徑維持既有公式。"""
        r = PortfolioCalculator._calculate_modified_dietz_return(
            beginning_value=100.0,
            ending_value=130.0,
            cashflows=[20.0],
            weights=[0.25],
        )
        self.assertAlmostEqual(r, 10.0 / 105.0, places=8)

        metric = calculate_modified_dietz_metric(
            100.0,
            130.0,
            [20.0],
            weights=[0.25],
        )
        self.assertEqual(metric.status, "ok")
        self.assertAlmostEqual(metric.value, r, places=8)

    def test_negative_beginning_value_keeps_numeric_sentinel_but_is_undefined(self):
        """舊 float wrapper 可保留 0.0 sentinel，但 primitive 必須說明不是 0% 報酬。"""
        r = PortfolioCalculator._calculate_modified_dietz_return(
            beginning_value=-10.0,
            ending_value=10.0,
            cashflows=[],
        )
        metric = calculate_modified_dietz_metric(-10.0, 10.0, [])

        self.assertEqual(r, 0.0)
        self.assertEqual(metric.value, 0.0)
        self.assertEqual(metric.status, "undefined")
        self.assertEqual(metric.reason, "negative_beginning_value")

    def test_true_zero_return_is_distinct_from_zero_denominator(self):
        genuine_zero = calculate_modified_dietz_metric(
            beginning_value=100.0,
            ending_value=100.0,
            cashflows=[],
        )
        singular = calculate_modified_dietz_metric(
            beginning_value=100.0,
            ending_value=50.0,
            cashflows=[-200.0],
        )

        self.assertEqual((genuine_zero.value, genuine_zero.status, genuine_zero.reason), (0.0, "ok", None))
        self.assertEqual(singular.value, 0.0)
        self.assertEqual(singular.status, "undefined")
        self.assertEqual(singular.reason, "zero_denominator")

    def test_invalid_inputs_and_weights_are_machine_readable(self):
        self.assertEqual(
            calculate_modified_dietz_metric(math.nan, 10.0, []).reason,
            "invalid_beginning_value",
        )
        self.assertEqual(
            calculate_modified_dietz_metric(10.0, math.inf, []).reason,
            "invalid_ending_value",
        )
        self.assertEqual(
            calculate_modified_dietz_metric(10.0, 11.0, [math.nan]).reason,
            "invalid_cashflow",
        )
        self.assertEqual(
            calculate_modified_dietz_metric(10.0, 11.0, [1.0], weights=[]).reason,
            "weights_length_mismatch",
        )
        self.assertEqual(
            calculate_modified_dietz_metric(10.0, 11.0, [1.0], weights=[1.5]).reason,
            "invalid_weight",
        )

    def test_zero_capital_without_exposure_is_not_applicable(self):
        metric = calculate_modified_dietz_metric(0.0, 0.0, [])
        self.assertEqual(metric.status, "not_applicable")
        self.assertEqual(metric.reason, "no_capital_exposure")


class TestTwrReliabilityAnnotation(unittest.TestCase):
    def test_valid_history_keeps_numeric_twr_unchanged(self):
        history = [
            {"date": "2026-01-01", "twr": 0.0, "total_value": 0.0, "net_cashflow_twd": 0.0},
            {
                "date": "2026-01-02",
                "twr": 0.0,
                "_raw_total_value": 100.0,
                "_raw_net_cashflow_twd": -100.0,
            },
            {
                "date": "2026-01-05",
                "twr": 10.0,
                "_raw_total_value": 110.0,
                "_raw_net_cashflow_twd": 0.0,
            },
        ]
        original_twr = [row["twr"] for row in history]

        result = annotate_twr_history(history)

        self.assertEqual([row["twr"] for row in history], original_twr)
        self.assertEqual(result.status, "ok")
        self.assertIsNone(result.reason)
        self.assertIsNone(result.invalid_since)
        self.assertEqual(history[1]["twr_period_status"], "ok")
        self.assertEqual(history[2]["twr_status"], "ok")

    def test_zero_denominator_marks_cumulative_twr_undefined_and_sticky(self):
        history = [
            {"date": "2026-01-01", "twr": 0.0, "total_value": 0.0, "net_cashflow_twd": 0.0},
            {
                "date": "2026-01-02",
                "twr": 0.0,
                "_raw_total_value": 100.0,
                "_raw_net_cashflow_twd": -100.0,
            },
            {
                "date": "2026-01-05",
                "twr": 0.0,
                "_raw_total_value": 50.0,
                # User-facing sign is opposite Dietz CF: +200 => Dietz CF -200,
                # denominator = 100 + 0.5 * (-200) = 0.
                "_raw_net_cashflow_twd": 200.0,
            },
            {
                "date": "2026-01-06",
                "twr": 10.0,
                "_raw_total_value": 55.0,
                "_raw_net_cashflow_twd": 0.0,
            },
        ]
        numeric_before = [row["twr"] for row in history]

        result = annotate_twr_history(history)

        self.assertEqual([row["twr"] for row in history], numeric_before)
        self.assertEqual(history[2]["twr_period_status"], "undefined")
        self.assertEqual(history[2]["twr_period_reason"], "zero_denominator")
        self.assertEqual(history[2]["twr_status"], "undefined")
        self.assertEqual(history[3]["twr_period_status"], "ok")
        self.assertEqual(history[3]["twr_status"], "undefined")
        self.assertEqual(result.status, "undefined")
        self.assertEqual(result.reason, "zero_denominator")
        self.assertEqual(result.invalid_since, "2026-01-05")

    def test_unfunded_value_from_zero_is_undefined(self):
        history = [
            {"date": "2026-01-01", "twr": 0.0, "total_value": 0.0, "net_cashflow_twd": 0.0},
            {
                "date": "2026-01-02",
                "twr": 0.0,
                "_raw_total_value": 100.0,
                "_raw_net_cashflow_twd": 0.0,
            },
        ]

        result = annotate_twr_history(history)

        self.assertEqual(history[1]["twr_period_status"], "undefined")
        self.assertEqual(history[1]["twr_period_reason"], "unfunded_value_from_zero")
        self.assertEqual(result.status, "undefined")

    def test_zero_to_zero_with_cashflow_is_undefined_without_intraday_timing(self):
        history = [
            {"date": "2026-01-01", "twr": 0.0, "total_value": 0.0, "net_cashflow_twd": 0.0},
            {
                "date": "2026-01-02",
                "twr": 0.0,
                "_raw_total_value": 0.0,
                "_raw_net_cashflow_twd": -10.0,
            },
        ]

        result = annotate_twr_history(history)

        self.assertEqual(history[1]["twr_period_status"], "undefined")
        self.assertEqual(history[1]["twr_period_reason"], "zero_exposure_with_cashflow")
        self.assertEqual(result.status, "undefined")


if __name__ == '__main__':
    unittest.main()
