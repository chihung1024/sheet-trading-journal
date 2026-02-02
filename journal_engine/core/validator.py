import logging
from typing import List, Dict, Any
from ..models import PortfolioSummary, HoldingPosition

logger = logging.getLogger(__name__)

class PortfolioValidator:
    """
    投資組合驗證器 (v14.0 NAV 版)
    負責確保計算結果符合財務邏輯，防止數據異常、溢位或計算錯誤。
    """
    
    def __init__(self, tolerance: float = 2.0):
        # 容許的誤差（台幣），用於處理多幣別轉換產生的浮點數微小誤差
        self.tolerance = tolerance

    def validate_accounting_identity(self, summary: PortfolioSummary) -> bool:
        """
        驗證核心財務恆等式：
        資產總值 (Total Value) - 淨投入資金 (Invested Capital) = 累計總損益 (Total P&L)
        
        這是確保 FIFO 成本計算與即時市值重估邏輯一致的最重要校驗。
        """
        # 邏輯：總市值 - 總投入 = 總損益
        calc_pnl = summary.total_value - summary.invested_capital
        diff = abs(calc_pnl - summary.total_pnl)
        
        if diff > self.tolerance:
            logger.error(f"❌ [Validator] 財務恆等式失衡！")
            logger.error(f"   差異金額: ${diff:,.2f} TWD")
            logger.error(f"   計算結果 (Value - Invested): {calc_pnl:,.2f}")
            logger.error(f"   系統報告 (Total PnL): {summary.total_pnl:,.2f}")
            return False
        
        logger.info(f"✅ [Validator] 財務恆等式校驗通過 (誤差: ${diff:.2f})")
        return True

    def validate_holdings_consistency(self, summary: PortfolioSummary, holdings: List[HoldingPosition]) -> bool:
        """
        驗證個別持倉的台幣市值加總是否等於總體彙總表中的總值。
        """
        sum_mv = sum(h.market_value_twd for h in holdings)
        diff = abs(sum_mv - summary.total_value)
        
        if diff > self.tolerance:
            logger.error(f"❌ [Validator] 持倉市值加總不一致！")
            logger.error(f"   差異金額: ${diff:,.2f} TWD")
            logger.error(f"   持倉加總: {sum_mv:,.2f}")
            logger.error(f"   彙總數據: {summary.total_value:,.2f}")
            return False
        
        logger.info(f"✅ [Validator] 持倉市值一致性校驗通過")
        return True

    def validate_daily_pnl_sum(self, summary: PortfolioSummary, holdings: List[HoldingPosition]) -> bool:
        """
        🚀 [v14.0] 驗證當日損益 (Daily P&L) 是否與各標的之 NAV 變動加總一致。
        
        在資產淨值法下，總當日損益應等於所有持倉的 (當日未實現變動 + 當日已實現變動)。
        """
        sum_daily_pnl = sum(h.daily_pl_twd for h in holdings)
        
        # 檢查 Breakdown (台/美分量) 的總和是否也一致
        breakdown_sum = 0.0
        if summary.daily_pnl_breakdown:
            breakdown_sum = sum(summary.daily_pnl_breakdown.values())
            
        diff_summary = abs(sum_daily_pnl - summary.daily_pnl_twd)
        
        # 容許較大的誤差（例如考慮到手續費或微小現金匯差），若超過 5 元則警告
        if diff_summary > 5.0:
            logger.error(f"❌ [Validator] 當日損益加總校驗失敗！")
            logger.error(f"   持倉 Daily PnL 總和: {sum_daily_pnl:,.2f}")
            logger.error(f"   Summary 報告值: {summary.daily_pnl_twd:,.2f}")
            return False
        
        if summary.daily_pnl_breakdown and abs(sum_daily_pnl - breakdown_sum) > 5.0:
            logger.error(f"❌ [Validator] 當日損益分量 (Breakdown) 加總不一致！")
            logger.error(f"   Breakdown 總和: {breakdown_sum:,.2f}")
            return False
            
        logger.info(f"✅ [Validator] 當日損益 (NAV) 加總校驗通過")
        return True

    def validate_data_sanity(self, holdings: List[HoldingPosition]) -> bool:
        """
        檢查持倉數據的合理性（避免出現負股數、零價格或零匯率等邏輯錯誤）。
        """
        for h in holdings:
            # 股數不應為負值
            if h.qty < -1e-6:
                logger.error(f"❌ [Validator] {h.symbol} 股數異常 (負值): {h.qty}")
                return False
            
            # 價格不應為零或負值
            if h.current_price_origin <= 0:
                logger.warning(f"⚠️ [Validator] {h.symbol} 價格異常 (<=0): {h.current_price_origin}")
                # 僅發出警告，不阻斷執行（可能為暫時性 API 缺失）
            
            # 匯率不應為零
            if h.curr_fx_rate <= 0:
                logger.error(f"❌ [Validator] {h.symbol} 匯率數據異常 (<=0): {h.curr_fx_rate}")
                return False
                
        logger.info(f"✅ [Validator] 數據合理性校驗通過")
        return True

    def run_all_checks(self, summary: PortfolioSummary, holdings: List[HoldingPosition]) -> bool:
        """
        執行全方位的數據校驗並回傳最終結果。
        """
        results = [
            self.validate_accounting_identity(summary),
            self.validate_holdings_consistency(summary, holdings),
            self.validate_daily_pnl_sum(summary, holdings),
            self.validate_data_sanity(holdings)
        ]
        
        final_valid = all(results)
        if not final_valid:
            logger.error("🛑 [Validator] 投資組合數據校驗失敗，請檢查計算邏輯或數據源。")
        return final_valid
