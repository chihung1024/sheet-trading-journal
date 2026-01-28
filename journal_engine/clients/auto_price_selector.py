"""
AutoPriceSelector - 智能价格字段选择器
自动检测数据质量并选择最佳价格字段（Adj Close 或 Close）
"""

import pandas as pd
import logging

logger = logging.getLogger(__name__)


class AutoPriceSelector:
    """
    自动选择最佳价格字段
    - 无需人工配置
    - 自动检测数据异常
    - 优先使用复权价格，异常时回退
    """
    
    def __init__(self, symbol: str, df: pd.DataFrame):
        self.symbol = symbol
        self.df = df
        self.selected_price = None
        self.reason = None
    
    def select_best_price(self) -> str:
        """
        智能选择价格字段
        
        决策树：
        1. 计算 Adj Close / Close 比值分布
        2. 如果比值异常（> 5 或 < 0.2）→ 使用 Close
        3. 如果比值正常但存在拆股 → 使用 Adj Close
        4. 如果比值 = 1（无配息无拆股）→ 使用 Close（性能优化）
        
        返回：'Adj Close' 或 'Close'
        """
        
        # 计算价格比值
        adj_ratio = self.df['Adj Close'] / self.df['Close']
        
        # 统计特征
        median_ratio = adj_ratio.median()
        max_ratio = adj_ratio.max()
        min_ratio = adj_ratio.min()
        std_ratio = adj_ratio.std()
        
        # 检测 1: 极端异常（数据错误）
        if max_ratio > 10 or min_ratio < 0.1:
            self.selected_price = 'Close'
            self.reason = f'Extreme Adj/Close ratio detected (max={max_ratio:.2f}, min={min_ratio:.2f})'
            logger.warning(f"[{self.symbol}] {self.reason}")
            return 'Close'
        
        # 检测 2: 高方差（不稳定数据）
        if std_ratio > 0.5:
            self.selected_price = 'Close'
            self.reason = f'High variance in Adj/Close ratio (std={std_ratio:.2f})'
            logger.warning(f"[{self.symbol}] {self.reason}")
            return 'Close'
        
        # 检测 3: 检查是否有股票分割
        has_splits = False
        if 'Stock Splits' in self.df.columns:
            has_splits = (self.df['Stock Splits'] != 0).any()
        
        # 检测 4: 检查是否有配息
        has_dividends = False
        if 'Dividends' in self.df.columns:
            has_dividends = (self.df['Dividends'] > 0).any()
        
        # 决策逻辑
        if has_splits or has_dividends:
            # 有企业行动，且数据正常 → 使用复权价格
            self.selected_price = 'Adj Close'
            self.reason = f'Corporate actions detected (splits={has_splits}, dividends={has_dividends}), using Adj Close'
            logger.info(f"[{self.symbol}] {self.reason}")
        else:
            # 无企业行动 → 使用原始价格（节省计算）
            self.selected_price = 'Close'
            self.reason = 'No corporate actions, using Close'
            logger.debug(f"[{self.symbol}] {self.reason}")
        
        return self.selected_price
    
    def get_adjusted_price_series(self) -> pd.Series:
        """返回选定的价格序列"""
        price_field = self.select_best_price()
        return self.df[price_field].copy()
    
    def get_metadata(self) -> dict:
        """返回选择元数据（用于审计）"""
        return {
            'price_source': self.selected_price,
            'selection_reason': self.reason
        }
