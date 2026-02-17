import unittest

from journal_engine.core.calculator import PortfolioCalculator


class TestModifiedDietzMethod(unittest.TestCase):
    def test_weight_distribution(self):
        w1 = PortfolioCalculator._get_dietz_cashflow_weight(1, 3)
        w2 = PortfolioCalculator._get_dietz_cashflow_weight(2, 3)
        w3 = PortfolioCalculator._get_dietz_cashflow_weight(3, 3)

        self.assertAlmostEqual(w1, 0.75)
        self.assertAlmostEqual(w2, 0.5)
        self.assertAlmostEqual(w3, 0.25)

    def test_modified_dietz_no_cashflow_equals_simple_return(self):
        r = PortfolioCalculator._calculate_modified_dietz_return(
            beginning_value=100.0,
            ending_value=110.0,
            cashflows=[]
        )
        self.assertAlmostEqual(r, 0.10, places=8)

    def test_modified_dietz_with_mid_period_inflow(self):
        # BV=100, EV=130, CF=+20 at middle (single flow -> weight 0.5)
        # numerator = 130 - 100 - 20 = 10
        # denominator = 100 + 20*0.5 = 110
        # r = 10/110 = 0.090909...
        r = PortfolioCalculator._calculate_modified_dietz_return(
            beginning_value=100.0,
            ending_value=130.0,
            cashflows=[20.0]
        )
        self.assertAlmostEqual(r, 10.0 / 110.0, places=8)


if __name__ == '__main__':
    unittest.main()
