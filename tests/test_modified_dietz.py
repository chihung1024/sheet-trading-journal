import unittest

from journal_engine.core.calculator import PortfolioCalculator


class TestModifiedDietzMethod(unittest.TestCase):
    def test_modified_dietz_no_cashflow_equals_simple_return(self):
        """測試：當期間內沒有現金流時，Modified Dietz 應等同於簡單報酬率 (HPR)"""
        r = PortfolioCalculator._calculate_modified_dietz_return(
            beginning_value=100.0,
            ending_value=110.0,
            cashflows=[]
        )
        self.assertAlmostEqual(r, 0.10, places=8)

    def test_modified_dietz_default_daily_weight(self):
        """測試：日頻資料預設權重 (w=0.5) 的計算是否正確"""
        # 期初價值 (BV) = 100, 期末價值 (EV) = 130, 現金流 (CF) = 20
        # 由於沒有指定權重，預設採用期中發生 (w = 0.5)
        # numerator = 130 - 100 - 20 = 10
        # denominator = 100 + 20 * 0.5 = 110
        # r = 10 / 110 = 0.090909...
        r = PortfolioCalculator._calculate_modified_dietz_return(
            beginning_value=100.0,
            ending_value=130.0,
            cashflows=[20.0]
        )
        self.assertAlmostEqual(r, 10.0 / 110.0, places=8)

    def test_modified_dietz_with_custom_weights(self):
        """測試：未來擴充支援日內時間戳時，帶入精確權重 (w_i) 的計算是否正確"""
        # 期初價值 (BV) = 100, 期末價值 (EV) = 130, 現金流 (CF) = 20
        # 指定權重 (w) = 0.25 (例如在交易日剩餘 25% 時間時發生的交易)
        # numerator = 130 - 100 - 20 = 10
        # denominator = 100 + 20 * 0.25 = 105
        # r = 10 / 105 = 0.095238...
        r = PortfolioCalculator._calculate_modified_dietz_return(
            beginning_value=100.0,
            ending_value=130.0,
            cashflows=[20.0],
            weights=[0.25]
        )
        self.assertAlmostEqual(r, 10.0 / 105.0, places=8)
        
    def test_modified_dietz_negative_beginning_value_returns_zero(self):
        """測試邊界防護：當期初資金因異常狀態為負數時，應安全回傳 0.0 避免無限大或負報酬錯亂"""
        r = PortfolioCalculator._calculate_modified_dietz_return(
            beginning_value=-10.0,
            ending_value=10.0,
            cashflows=[]
        )
        self.assertEqual(r, 0.0)


if __name__ == '__main__':
    unittest.main()
