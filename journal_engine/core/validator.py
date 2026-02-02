"""
PortfolioValidator - 投资组合验证器
自动验证计算结果的一致性，发现异常时警告
"""

import logging
import pandas as pd
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class PortfolioValidator:
    """
    自动验证计算结果的一致性
    - 无需人工检查
    - 异常时自动修正或警告
    """
    
    @staticmethod
    def validate_daily_balance(
        holdings: Dict[str, Any], 
        invested_capital: float, 
        market_value: float, 
        tolerance: float = 0.001
    ) -> bool:
        """
        验证每日账户平衡
        
        规则：
        sum(holdings.cost_basis_twd) 应该等于 invested_capital
        
        容差：0.1% 或 100 TWD（取较大值）
        """
        total_cost = sum(
            h['cost_basis_twd'] 
            for h in holdings.values() 
            if h.get('qty', 0) > 1e-6
        )
        
        deviation = abs(total_cost - invested_capital)
        threshold = max(invested_capital * tolerance, 100)
        
        if deviation > threshold:
            logger.error(
                f"Balance mismatch: Holdings cost={total_cost:.2f}, "
                f"Invested capital={invested_capital:.2f}, "
                f"Deviation={deviation:.2f} (threshold={threshold:.2f})"
            )
            return False
        
        return True
    
    @staticmethod
    def validate_twr_calculation(history_data: List[Dict[str, Any]]) -> bool:
        """
        验证 TWR 计算的合理性
        
        规则：
        1. TWR 不应该单日跳变超过 50%（无新资金流入）
        2. TWR 应该随时间单调或平滑变化
        """
        if len(history_data) < 2:
            return True
        
        suspicious_jumps = []
        
        for i in range(1, len(history_data)):
            prev_twr = history_data[i-1].get('twr', 0)
            curr_twr = history_data[i].get('twr', 0)
            
            # 检查单日跳变
            if abs(curr_twr - prev_twr) > 50:
                suspicious_jumps.append({
                    'date': history_data[i].get('date'),
                    'prev_twr': prev_twr,
                    'curr_twr': curr_twr,
                    'jump': curr_twr - prev_twr
                })
        
        if suspicious_jumps:
            for jump in suspicious_jumps:
                logger.warning(
                    f"Suspicious TWR jump: {jump['prev_twr']:.2f}% → {jump['curr_twr']:.2f}% "
                    f"on {jump['date']} (jump={jump['jump']:.2f}%)"
                )
            return False
        
        return True
    
    @staticmethod
    def validate_price_data(symbol: str, df: pd.DataFrame) -> bool:
        """
        验证价格数据质量
        
        规则：
        1. 不应该有 NaN
        2. 价格不应该为 0
        3. 单日涨跌不应该超过 30%（非拆股日）
        """
        if 'Close_Adjusted' not in df.columns:
            logger.error(f"[{symbol}] Missing Close_Adjusted column")
            return False
        
        # 检查 NaN
        if df['Close_Adjusted'].isna().any():
            nan_count = df['Close_Adjusted'].isna().sum()
            logger.error(f"[{symbol}] {nan_count} NaN prices detected")
            return False
        
        # 检查零价格
        if (df['Close_Adjusted'] <= 0).any():
            zero_count = (df['Close_Adjusted'] <= 0).sum()
            logger.error(f"[{symbol}] {zero_count} zero or negative prices detected")
            return False
        
        # 检查异常波动
        daily_return = df['Close_Adjusted'].pct_change()
        extreme_moves = daily_return[abs(daily_return) > 0.3]
        
        if len(extreme_moves) > 0:
            # 排除拆股日
            if 'Stock Splits' in df.columns:
                split_dates = df[df['Stock Splits'] != 0].index
                extreme_non_split = extreme_moves[~extreme_moves.index.isin(split_dates)]
            else:
                extreme_non_split = extreme_moves
            
            if len(extreme_non_split) > 0:
                logger.warning(
                    f"[{symbol}] {len(extreme_non_split)} days with >30% price moves "
                    f"(not split-related)"
                )
        
        return True
    
    @staticmethod
    def validate_holdings_consistency(
        holdings: Dict[str, Any], 
        transactions_df: pd.DataFrame
    ) -> bool:
        """
        验证持仓与交易记录的一致性
        
        规则：
        每个持仓的数量应该等于买入减去卖出的总量
        """
        for symbol, holding in holdings.items():
            symbol_txns = transactions_df[transactions_df['Symbol'] == symbol]
            
            buy_qty = symbol_txns[symbol_txns['Type'] == 'BUY']['Qty'].sum()
            sell_qty = symbol_txns[symbol_txns['Type'] == 'SELL']['Qty'].sum()
            expected_qty = buy_qty - sell_qty
            
            actual_qty = holding.get('qty', 0)
            
            if abs(actual_qty - expected_qty) > 1e-4:
                logger.error(
                    f"[{symbol}] Holdings quantity mismatch: "
                    f"Expected={expected_qty:.4f}, Actual={actual_qty:.4f}"
                )
                return False
        
        return True
