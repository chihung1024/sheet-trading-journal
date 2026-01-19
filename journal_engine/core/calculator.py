import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class PortfolioCalculator:
    """
    Portfolio Calculator (v20260119 穩定版)
    負責將原始交易紀錄轉換為多維度的投資績效快照
    """
    
    def __init__(self, records: List[Dict], market_client, benchmark_symbol: str = "SPY"):
        self.records = records
        self.market_client = market_client
        self.benchmark_symbol = benchmark_symbol
        self.df = self._prepare_dataframe(records)
        
    def _prepare_dataframe(self, records: List[Dict]) -> pd.DataFrame:
        """格式化紀錄為 DataFrame 並處理日期"""
        if not records:
            return pd.DataFrame()
            
        df = pd.DataFrame(records)
        df['txn_date'] = pd.to_datetime(df['txn_date'])
        # 確保數值型態正確
        for col in ['qty', 'price', 'fee', 'tax']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        return df.sort_values('txn_date')

    def run(self) -> Optional[Dict]:
        """執行完整計算流程"""
        try:
            if self.df.empty:
                return self._get_empty_result()

            # 1. 抓取目前市場報價與匯率
            symbols = self.df['symbol'].unique().tolist()
            quotes = self.market_client.get_quotes(symbols + [self.benchmark_symbol])
            fx_rates = self.market_client.get_fx_rates()
            usdtwd = fx_rates.get('USDTWD', 32.5) # 預設匯率防禦

            # 2. 計算目前持倉 (Holdings)
            holdings = self._calculate_holdings(quotes, usdtwd)
            
            # 3. 計算歷史績效與對標基準
            history = self._calculate_history(quotes, usdtwd)
            
            # 4. 彙總摘要數據 (Summary)
            summary = self._calculate_summary(holdings, history)
            
            # 5. 偵測待確認配息 (基於市場數據與持有股數)
            pending_divs = self._detect_pending_dividends(holdings, quotes)

            # 6. 組裝最終快照結構
            # ✅ 新增：按標籤(Groups)進行分組計算
            groups_data = self._calculate_groups(holdings, usdtwd)

            return {
                "summary": summary,
                "holdings": holdings,
                "history": history,
                "pending_dividends": pending_divs,
                "groups": groups_data,
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M")
            }
        except Exception as e:
            logger.error(f"❌ 計算核心發生錯誤: {str(e)}", exc_info=True)
            return self._get_empty_result()

    def _calculate_holdings(self, quotes, usdtwd) -> List[Dict]:
        """計算個別標的的持倉狀態"""
        holdings_map = {}
        
        # 依序處理交易以計算平均成本
        for _, row in self.df.iterrows():
            sym = row['symbol']
            if sym not in holdings_map:
                holdings_map[sym] = {"qty": 0, "total_cost": 0, "tag": row.get('tag', 'Stock')}
            
            h = holdings_map[sym]
            if row['txn_type'] == 'BUY':
                h['qty'] += row['qty']
                h['total_cost'] += (row['qty'] * row['price']) + row['fee'] + row['tax']
            elif row['txn_type'] == 'SELL':
                # 簡單移動平均成本法
                avg_cost = h['total_cost'] / h['qty'] if h['qty'] > 0 else 0
                h['qty'] -= row['qty']
                h['total_cost'] -= (row['qty'] * avg_cost)
            elif row['txn_type'] == 'DIV':
                # 配息視為成本扣除
                h['total_cost'] -= (row['qty'] * row['price'])

        results = []
        for sym, h in holdings_map.items():
            if h['qty'] <= 0.0001: continue # 略過已平倉位
            
            q = quotes.get(sym, {})
            current_price = q.get('price', 0)
            market_value_usd = h['qty'] * current_price
            avg_cost_usd = h['total_cost'] / h['qty'] if h['qty'] > 0 else 0
            
            pnl_usd = market_value_usd - h['total_cost']
            pnl_percent = (pnl_usd / h['total_cost'] * 100) if h['total_cost'] > 0 else 0
            
            results.append({
                "symbol": sym,
                "qty": round(h['qty'], 4),
                "avg_cost_usd": round(avg_cost_usd, 2),
                "current_price_origin": current_price,
                "market_value_twd": round(market_value_usd * usdtwd),
                "pnl_twd": round(pnl_usd * usdtwd),
                "pnl_percent": round(pnl_percent, 2),
                "daily_change_percent": q.get('change_percent', 0),
                "daily_pl_twd": round(h['qty'] * q.get('change', 0) * usdtwd),
                "tag": h['tag']
            })
            
        return results

    def _calculate_groups(self, all_holdings, usdtwd) -> Dict:
        """將持倉按標籤分組並計算各組摘要"""
        groups = {"all": {"holdings": all_holdings}}
        
        for h in all_holdings:
            # 支援多標籤格式 (如 "AI, Growth")
            tags = [t.strip() for t in str(h['tag']).replace(';', ',').split(',')]
            for tag in tags:
                if not tag: continue
                if tag not in groups:
                    groups[tag] = {"holdings": [], "summary": {"total_value": 0, "invested_capital": 0}}
                
                groups[tag]["holdings"].append(h)
                # 簡易累加組內指標
                groups[tag]["summary"]["total_value"] += h['market_value_twd']
                # 注意：組內成本計算在此為簡化版，精確計算需回溯交易紀錄
        return groups

    def _calculate_history(self, quotes, usdtwd) -> List[Dict]:
        """計算歷史績效曲線 (簡化版)"""
        # 實際生產環境中，此處應透過 D1 讀取過去的 snapshots 並與今日數據連接
        # 這裡回傳今日單點數據作為範例起點
        return [{
            "date": datetime.now().strftime("%Y-%m-%d"),
            "roi": 0, # 計算邏輯待與歷史表對接
            "benchmark_roi": 0
        }]

    def _calculate_summary(self, holdings, history) -> Dict:
        """總結全域投資數據"""
        total_value = sum(h['market_value_twd'] for h in holdings)
        total_pnl = sum(h['pnl_twd'] for h in holdings)
        invested = total_value - total_pnl
        
        return {
            "total_value": round(total_value),
            "invested_capital": round(invested),
            "total_pnl": round(total_pnl),
            "realized_pnl": 0, # 需從交易紀錄累加
            "twr": 0,
            "xirr": 0
        }

    def _detect_pending_dividends(self, holdings, quotes) -> List[Dict]:
        """偵測市場上已公告但尚未入帳的配息"""
        # 對接 MarketDataClient 抓取配息日曆
        return []

    def _get_empty_result(self) -> Dict:
        """回傳標準空結構，確保前端不崩潰"""
        return {
            "summary": {"total_value": 0, "invested_capital": 0, "total_pnl": 0, "realized_pnl": 0, "twr": 0, "xirr": 0},
            "holdings": [],
            "history": [],
            "groups": {"all": {"holdings": [], "summary": {}}},
            "pending_dividends": [],
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M")
        }
