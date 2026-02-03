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

    def test_mixed_tw_us_positions(self):
        """測試情境 6: 台/美混合持倉的當日損益計算"""
        print("\n=== Test 6: Mixed TW/US Positions ===")
        data = [
            # Taiwan Stock (suffix .TW)
            {'Date': '2026-01-25', 'Symbol': '2330.TW', 'Type': 'BUY', 'Qty': 100, 'Price': 500, 'Fee': 0, 'Tax': 0},
            # US Stock
            {'Date': '2026-01-25', 'Symbol': 'NVDA', 'Type': 'BUY', 'Qty': 10, 'Price': 100, 'Fee': 0, 'Tax': 0},
        ]
        analyzer = self.create_analyzer(data)
        
        # Test Taiwan stock position
        tw_snap = analyzer.analyze_today_position('2330.TW', date(2026, 1, 27), fx=1.0, prev_close_price=490)
        self.assertAlmostEqual(tw_snap.qty, 100)
        self.assertAlmostEqual(tw_snap.old_qty_remaining, 100)
        
        # Taiwan stock base price should use prev close
        tw_base = analyzer.get_base_price_for_pnl(tw_snap, 490)
        self.assertAlmostEqual(tw_base, 490)
        
        # Test US stock position
        us_snap = analyzer.analyze_today_position('NVDA', date(2026, 1, 27), fx=32.0, prev_close_price=95)
        self.assertAlmostEqual(us_snap.qty, 10)
        self.assertAlmostEqual(us_snap.old_qty_remaining, 10)
        
        # US stock base price should use prev close
        us_base = analyzer.get_base_price_for_pnl(us_snap, 95)
        self.assertAlmostEqual(us_base, 95)
        
        print("PASS: TW and US positions correctly calculate base price from prev close")

    def test_sell_with_fees_and_tax(self):
        """測試情境 7: 賣出含手續費/稅的損益計算"""
        print("\n=== Test 7: Sell with Fees and Tax ===")
        data = [
            # Yesterday: Buy 100 @ $100
            {'Date': '2026-01-26', 'Symbol': 'TEST', 'Type': 'BUY', 'Qty': 100, 'Price': 100, 'Fee': 10, 'Tax': 5},
            # Today: Sell 50 @ $120 with fees
            {'Date': '2026-01-27', 'Symbol': 'TEST', 'Type': 'SELL', 'Qty': 50, 'Price': 120, 'Fee': 8, 'Tax': 3}
        ]
        analyzer = self.create_analyzer(data)
        snapshot = analyzer.analyze_today_position('TEST', date(2026, 1, 27), fx=1.0, prev_close_price=105)
        
        # Remaining qty
        self.assertAlmostEqual(snapshot.qty, 50)
        
        # Realized PnL vs prev close: (120 - 105) * 50 - 11 (fees+tax) = 750 - 11 = 739
        expected_realized_vs_prev = (120 - 105) * 50 - 11
        self.assertAlmostEqual(snapshot.realized_pnl_vs_prev_close, expected_realized_vs_prev, places=0)
        
        print(f"PASS: Realized PnL correctly includes fees/tax: {snapshot.realized_pnl_vs_prev_close}")

    def test_intraday_buy_and_add(self):
        """測試情境 8: 當日買入後又加碼"""
        print("\n=== Test 8: Intraday Buy and Add ===")
        data = [
            # Today: First buy 100 @ $100
            {'Date': '2026-01-27', 'Symbol': 'TEST', 'Type': 'BUY', 'Qty': 100, 'Price': 100, 'Fee': 0, 'Tax': 0},
            # Today: Second buy 50 @ $110
            {'Date': '2026-01-27', 'Symbol': 'TEST', 'Type': 'BUY', 'Qty': 50, 'Price': 110, 'Fee': 0, 'Tax': 0}
        ]
        analyzer = self.create_analyzer(data)
        snapshot = analyzer.analyze_today_position('TEST', date(2026, 1, 27))
        
        # Total qty
        self.assertAlmostEqual(snapshot.qty, 150)
        self.assertTrue(snapshot.is_new_today)
        self.assertAlmostEqual(snapshot.old_qty_remaining, 0)
        self.assertAlmostEqual(snapshot.new_qty_remaining, 150)
        
        # Average cost: (100*100 + 50*110) / 150 = 15500 / 150 = 103.33
        expected_avg = (100*100 + 50*110) / 150
        self.assertAlmostEqual(snapshot.avg_cost, expected_avg, places=2)
        
        # Base price should be avg cost (all new positions)
        base_price = analyzer.get_base_price_for_pnl(snapshot, 95)
        self.assertAlmostEqual(base_price, expected_avg, places=2)
        
        print(f"PASS: Intraday multiple buys avg cost: {snapshot.avg_cost:.2f}")

if __name__ == '__main__':
    unittest.main()

