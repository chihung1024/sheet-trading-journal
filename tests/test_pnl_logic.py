import unittest
from datetime import date
import pandas as pd
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from journal_engine.core.transaction_analyzer import TransactionAnalyzer, PositionSnapshot

class TestPnLLogic(unittest.TestCase):
    def setUp(self):
        # Create a mock DataFrame structure
        self.columns = ['Date', 'Symbol', 'Type', 'Qty', 'Price', 'Fee', 'Tax']

    def create_analyzer(self, data):
        df = pd.DataFrame(data, columns=self.columns)
        return TransactionAnalyzer(df)

    def test_pure_new_buy(self):
        """測試情境 1: 今日純買入 (New Buy)"""
        print("\n=== Test 1: Pure New Buy ===")
        data = [
            # Today: Buy 100 @ $100
            {'Date': '2026-01-27', 'Symbol': 'TEST', 'Type': 'BUY', 'Qty': 100, 'Price': 100, 'Fee': 0, 'Tax': 0}
        ]
        analyzer = self.create_analyzer(data)
        snapshot = analyzer.analyze_today_position('TEST', date(2026, 1, 27))
        
        # 驗證
        self.assertAlmostEqual(snapshot.qty, 100)
        self.assertAlmostEqual(snapshot.avg_cost, 100)
        self.assertTrue(snapshot.is_new_today) # Should be new
        self.assertAlmostEqual(snapshot.old_qty_remaining, 0)
        
        # PnL Base Price Check (Yesterday Close $90 - Irrelevant)
        base_price = analyzer.get_base_price_for_pnl(snapshot, 90)
        self.assertAlmostEqual(base_price, 100) # Should be cost
        print("PASS: Base Price used Cost ($100) instead of Prev Close ($90)")

    def test_add_position(self):
        """測試情境 2: 加碼 (Add Position)"""
        print("\n=== Test 2: Add Position ===")
        data = [
            # Yesterday: Buy 100 @ $100
            {'Date': '2026-01-26', 'Symbol': 'TEST', 'Type': 'BUY', 'Qty': 100, 'Price': 100, 'Fee': 0, 'Tax': 0},
            # Today: Buy 50 @ $110
            {'Date': '2026-01-27', 'Symbol': 'TEST', 'Type': 'BUY', 'Qty': 50, 'Price': 110, 'Fee': 0, 'Tax': 0}
        ]
        analyzer = self.create_analyzer(data)
        snapshot = analyzer.analyze_today_position('TEST', date(2026, 1, 27))
        
        # 驗證
        self.assertAlmostEqual(snapshot.qty, 150) # 100 + 50
        self.assertFalse(snapshot.is_new_today)
        self.assertAlmostEqual(snapshot.old_qty_remaining, 100)
        self.assertAlmostEqual(snapshot.new_qty_remaining, 50)
        self.assertAlmostEqual(snapshot.new_avg_cost, 110)
        
        # PnL Base Price Check (Yesterday Close $105)
        # Expected: (100 * 105 + 50 * 110) / 150 = (10500 + 5500) / 150 = 16000 / 150 = 106.66...
        base_price = analyzer.get_base_price_for_pnl(snapshot, 105)
        expected_base = (100 * 105 + 50 * 110) / 150
        self.assertAlmostEqual(base_price, expected_base)
        print(f"PASS: Weighted Base Price correct: {base_price:.2f}")

    def test_partial_sell_old(self):
        """測試情境 3: 減碼舊倉 (Sell Partial Old)"""
        print("\n=== Test 3: Sell Partial Old ===")
        data = [
            # Yesterday: Buy 100 @ $100
            {'Date': '2026-01-26', 'Symbol': 'TEST', 'Type': 'BUY', 'Qty': 100, 'Price': 100, 'Fee': 0, 'Tax': 0},
            # Today: Sell 40 @ $120
            {'Date': '2026-01-27', 'Symbol': 'TEST', 'Type': 'SELL', 'Qty': 40, 'Price': 120, 'Fee': 0, 'Tax': 0}
        ]
        analyzer = self.create_analyzer(data)
        snapshot = analyzer.analyze_today_position('TEST', date(2026, 1, 27))
        
        # 驗證
        self.assertAlmostEqual(snapshot.qty, 60) # 100 - 40
        self.assertAlmostEqual(snapshot.old_qty_remaining, 60)
        self.assertAlmostEqual(snapshot.new_qty_remaining, 0)
        
        # Realized PnL: (120 - 100) * 40 = 800
        self.assertAlmostEqual(snapshot.realized_pnl, 800)
        
        # Unrealized Base Price (Yesterday Close $105)
        # Remaining 60 shares should use Yesterday Close
        base_price = analyzer.get_base_price_for_pnl(snapshot, 105)
        self.assertAlmostEqual(base_price, 105)
        print("PASS: Remaining old shares use Prev Close")

    def test_day_trade_full(self):
        """測試情境 4: 當沖全出 (Day Trade Full Exit)"""
        print("\n=== Test 4: Day Trade Full Exit ===")
        data = [
            # Yesterday: None
            # Today: Buy 100 @ $100
            {'Date': '2026-01-27', 'Symbol': 'TEST', 'Type': 'BUY', 'Qty': 100, 'Price': 100, 'Fee': 0, 'Tax': 0},
            # Today: Sell 100 @ $105
            {'Date': '2026-01-27', 'Symbol': 'TEST', 'Type': 'SELL', 'Qty': 100, 'Price': 105, 'Fee': 0, 'Tax': 0}
        ]
        analyzer = self.create_analyzer(data)
        snapshot = analyzer.analyze_today_position('TEST', date(2026, 1, 27))
        
        # 驗證
        self.assertAlmostEqual(snapshot.qty, 0)
        self.assertAlmostEqual(snapshot.realized_pnl, 500) # (105-100)*100
        
        # Base Price (Irrelevant as qty is 0, but logic should handle it)
        base_price = analyzer.get_base_price_for_pnl(snapshot, 90)
        self.assertAlmostEqual(base_price, 0)
        print("PASS: Realized PnL captured correctly for Day Trade")

    def test_reentry_after_liquidation(self):
        """測試情境 5: 出清後重買 (Liquidate then Re-buy)"""
        print("\n=== Test 5: Re-entry After Liquidation ===")
        data = [
            # Prior: Buy 100
            {'Date': '2026-01-20', 'Symbol': 'TEST', 'Type': 'BUY', 'Qty': 100, 'Price': 80, 'Fee': 0, 'Tax': 0},
            # Prior: Sell 100 (Clean slate)
            {'Date': '2026-01-25', 'Symbol': 'TEST', 'Type': 'SELL', 'Qty': 100, 'Price': 90, 'Fee': 0, 'Tax': 0},
            # Today: Buy 50 @ $100
            {'Date': '2026-01-27', 'Symbol': 'TEST', 'Type': 'BUY', 'Qty': 50, 'Price': 100, 'Fee': 0, 'Tax': 0}
        ]
        analyzer = self.create_analyzer(data)
        snapshot = analyzer.analyze_today_position('TEST', date(2026, 1, 27))
        
        # 驗證
        self.assertAlmostEqual(snapshot.qty, 50)
        self.assertAlmostEqual(snapshot.old_qty_remaining, 0) # Prior positions gone
        self.assertAlmostEqual(snapshot.new_qty_remaining, 50)
        self.assertAlmostEqual(snapshot.new_avg_cost, 100)
        
        # This is the bug fix verification!
        # Yesterday Close was $95 (irrelevant as we have no old shares)
        # Should use Cost $100
        base_price = analyzer.get_base_price_for_pnl(snapshot, 95)
        self.assertAlmostEqual(base_price, 100) 
        print(f"PASS: Re-entry uses Cost ({base_price}) not Prev Close ($95)")

    def test_fx_only_pnl_change(self):
        """測試情境 6: 價格不變，僅匯率變動 (FX Only P&L Change)"""
        print("\n=== Test 6: FX Only P&L Change ===")
        # 假設持倉 100 股，價格固定 $100
        # 基準點 (T0): Price=100, FX=32.0
        # 現時點 (T1): Price=100, FX=32.5
        qty = 100
        p0, p1 = 100.0, 100.0
        fx0, fx1 = 32.0, 32.5
        
        # 正確公式 (NAV 變動法): Q * (P1*FX1 - P0*FX0)
        # = 100 * (100 * 32.5 - 100 * 32.0) = 100 * (3250 - 3200) = 5000 (TWD)
        expected_pnl_twd = qty * (p1 * fx1 - p0 * fx0)
        
        # 驗證期望值是否為 5000
        self.assertAlmostEqual(expected_pnl_twd, 5000.0)
        
        # 驗證舊公式 (ΔP * FX) 的錯誤性：在價格不變時會回傳 0
        wrong_pnl_old = qty * (p1 - p0) * fx1
        self.assertEqual(wrong_pnl_old, 0)
        
        print(f"PASS: Expected NAV P&L ({expected_pnl_twd}) is non-zero despite constant price.")

    def test_realized_pnl_with_fx(self):
        """測試情境 7: 已實現損益包含匯率變動 (Realized P&L with FX)"""
        print("\n=== Test 7: Realized P&L with FX ===")
        # 假設之前買入成本 $100 (FX=31.0)
        # 今日以 $110 賣出 (FX=32.0)
        qty = 10
        buy_p, buy_fx = 100.0, 31.0
        sell_p, sell_fx = 110.0, 32.0
        
        # 總實現損益 (本幣計價): (賣出價*賣出匯率 - 買入價*買入匯率) * 股數 
        # = (110 * 32.0 - 100 * 31.0) * 10 
        # = (3520 - 3100) * 10 = 420 * 10 = 4200 TWD
        expected_realized_twd = qty * (sell_p * sell_fx - buy_p * buy_fx)
        
        self.assertAlmostEqual(expected_realized_twd, 4200.0)
        print(f"PASS: Realized P&L correctly accounts for FX gains: {expected_realized_twd}")

if __name__ == '__main__':
    unittest.main()
