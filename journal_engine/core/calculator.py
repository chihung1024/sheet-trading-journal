import pandas as pd
import numpy as np
import logging
import pytz
from collections import deque, defaultdict
from datetime import datetime, timedelta
from pyxirr import xirr
from ..models import PortfolioSnapshot, PortfolioSummary, HoldingPosition, DividendRecord, PortfolioGroupData
from ..config import BASE_CURRENCY, DEFAULT_FX_RATE
from .transaction_analyzer import TransactionAnalyzer, PositionSnapshot
from .daily_pnl_helper import DailyPnLHelper
from .currency_detector import CurrencyDetector  # [v2.48] 自动货币识别
from .validator import PortfolioValidator  # [v2.48] 自动验证

# 取得 logger 實例
logger = logging.getLogger(__name__)

class PortfolioCalculator:
    def __init__(self, transactions_df, market_client, benchmark_ticker="SPY"):
        """
        初始化計算器
        :param transactions_df: 交易紀錄 DataFrame
        :param market_client: 市場數據客戶端
        :param benchmark_ticker: 基準標的代碼 (例如 'SPY', 'QQQ', '0050.TW')
        """
        self.df = transactions_df
        self.market = market_client
        self.benchmark_ticker = benchmark_ticker
        self.pnl_helper = DailyPnLHelper()
        self.currency_detector = CurrencyDetector()  # [v2.48] 新增
        self.validator = PortfolioValidator()  # [v2.48] 新增
        
        # [v2.53] 重複配息檢測結果
        self.duplicate_div_ids = set()  # 需要忽略的重複記錄ID
        self.conflict_div_keys = set()  # 數據衝突的配息key

    def _is_taiwan_stock(self, symbol):
        """[v2.48] 判斷是否為台股(不需匯率轉換)"""
        return self.currency_detector.is_base_currency(symbol)

    def _get_effective_fx_rate(self, symbol, fx_rate):
        """[v2.48] 根據標的取得有效匯率"""
        return self.currency_detector.get_fx_multiplier(symbol, fx_rate)
    
    def _is_us_market_open(self, tw_datetime):
        """
        [v2.52] 判斷美股是否開盤 (台灣時間)
        簡化邏輯：
        - 週末：不開盤
        - 交易時間：約 21:30/22:30 至 隔日 04:00/05:00
        - 這裡使用 22:00 - 05:00 作為通用判斷區間
        """
        tw_hour = tw_datetime.hour
        tw_weekday = tw_datetime.weekday()
        
        # 週末不開盤
        if tw_weekday >= 5:
            return False
        
        # 簡化判斷：22:00 之後到隔天 05:00 視為盤中
        if tw_hour >= 22 or tw_hour < 5:
            return True
        
        return False

    def _get_asset_effective_price_and_fx(self, symbol, target_date, current_fx):
        """
        [v2.52 徹底修復] 確保價格與匯率時點嚴格一致
        
        修復邏輯：
        1. 歷史日期：價格和匯率都使用該日期的收盤數據
        2. 今天 (美股未開)：價格用昨天收盤，但匯率使用【今日即時】(current_fx)
           - 修正重點：確保資產價值反映今日台幣波動，即便美股尚未開盤
        3. 今天 (美股盤中/收盤)：價格和匯率都用今天即時數據
        """
        is_tw = self._is_taiwan_stock(symbol)
        
        if is_tw:
            # 台股簡單：不需要匯率，直接使用目標日期
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            return price, 1.0
        
        # === 美股邏輯 ===
        tw_now = datetime.now(self.pnl_helper.tz_tw)
        today = tw_now.date()
        
        # 情況 A: 歷史日期 (比今天早)
        if target_date < today:
            price = self.market.get_price(symbol, pd.Timestamp(target_date))
            try:
                # ✅ 關鍵：歷史日期必須從歷史序列取值，嚴格對齊當日歷史匯率
                fx_to_use = self.market.fx_rates.asof(pd.Timestamp(target_date))
                if pd.isna(fx_to_use):
                    fx_to_use = DEFAULT_FX_RATE
            except:
                fx_to_use = DEFAULT_FX_RATE
            
            return price, self._get_effective_fx_rate(symbol, fx_to_use)
        
        # 情況 B: 今天的數據 (target_date == today)
        us_open = self._is_us_market_open(tw_now)
        
        if not us_open:
            # ✅ 美股未開盤：
            # 價格：回退到「前一交易日」的收盤價
            # 匯率：使用【今日即時匯率 (current_fx)】
            # 結果：資產價值會隨今日台幣匯率波動，符合「美股尚未開盤，但資產受匯率影響」的邏輯
            prev_date = today - timedelta(days=1)
            while prev_date.weekday() >= 5:
                prev_date -= timedelta(days=1)
            
            price = self.market.get_price(symbol, pd.Timestamp(prev_date))
            
            # 這裡使用 current_fx (即時匯率)，而不是歷史匯率
            fx_to_use = current_fx
            
            logger.debug(f"[v2.52] {symbol} 美股未開: 使用昨日({prev_date})價格 ({price}) x 今日即時匯率 ({fx_to_use:.4f})")
            return price, self._get_effective_fx_rate(symbol, fx_to_use)
        
        else:
            # ✅ 美股盤中/已開盤：價格和匯率都用今天即時
            price = self.market.get_price(symbol, pd.Timestamp(today))
            fx_to_use = current_fx  # 使用傳入的即時匯率
            
            logger.debug(f"[v2.52] {symbol} 美股盤中: 使用今日即時價格 ({price}) x 今日即時匯率 ({fx_to_use:.4f})")
            return price, self._get_effective_fx_rate(symbol, fx_to_use)

    def _detect_duplicate_dividends(self, df):
        """
        [v2.53] 檢測重複的配息記錄並智能處理
        
        規則：
        1. 同一股票同一天有多筆 DIV 記錄
        2. 如果數據完全相同（金額、數量一致）→ 保留最早一筆，標記其他為重複
        3. 如果數據不同 → 標記為衝突，需要手動檢查
        
        返回：(duplicate_ids, conflict_keys)
        - duplicate_ids: 需要忽略的重複記錄ID集合
        - conflict_keys: 數據衝突的配息key集合（symbol_date格式）
        """
        logger.info("[v2.53] 開始檢測重複配息記錄...")
        
        div_txs = df[df['Type'] == 'DIV'].copy()
        if div_txs.empty:
            logger.info("[v2.53] 無配息記錄，跳過檢測")
            return set(), set()
        
        # 確保有 id 欄位
        if 'id' not in div_txs.columns:
            logger.warning("[v2.53] 配息記錄缺少 'id' 欄位，無法進行重複檢測")
            return set(), set()
        
        # 按 symbol + date 分組
        div_txs['date_str'] = div_txs['Date'].dt.strftime('%Y-%m-%d')
        div_txs['div_key'] = div_txs['Symbol'] + '_' + div_txs['date_str']
        
        grouped = div_txs.groupby('div_key')
        
        duplicate_ids = set()
        conflict_keys = set()
        
        for div_key, group in grouped:
            if len(group) <= 1:
                continue  # 只有一筆，正常
            
            logger.warning(f"[v2.53] 檢測到 {div_key} 有 {len(group)} 筆配息記錄")
            
            # 檢查數據是否相同
            # 比較: Qty (股數) 和 Price (每股配息淨額)
            first_row = group.iloc[0]
            all_same = True
            
            for idx, row in group.iterrows():
                # 使用容差比較浮點數
                qty_diff = abs(row['Qty'] - first_row['Qty'])
                price_diff = abs(row['Price'] - first_row['Price'])
                
                if qty_diff > 1e-4 or price_diff > 1e-4:
                    all_same = False
                    logger.warning(f"  記錄 {row['id']}: Qty={row['Qty']}, Price={row['Price']} (與第一筆不同)")
                else:
                    logger.info(f"  記錄 {row['id']}: Qty={row['Qty']}, Price={row['Price']} (與第一筆相同)")
            
            if all_same:
                # 數據相同：保留第一筆（通常是最早的），標記其他為重複
                keep_id = group.iloc[0]['id']
                for idx, row in group.iloc[1:].iterrows():
                    duplicate_ids.add(row['id'])
                    logger.info(f"  ✓ 標記記錄 {row['id']} 為重複（保留 {keep_id}）")
            else:
                # 數據不同：標記為衝突
                conflict_keys.add(div_key)
                logger.error(f"  ✗ {div_key} 的多筆記錄數據不一致，標記為衝突！")
                logger.error(f"    建議：手動檢查這些記錄並刪除不正確的")
        
        if duplicate_ids:
            logger.info(f"[v2.53] 檢測完成：發現 {len(duplicate_ids)} 筆重複記錄將被忽略")
        if conflict_keys:
            logger.error(f"[v2.53] 警告：發現 {len(conflict_keys)} 個配息衝突需要處理：{conflict_keys}")
        
        if not duplicate_ids and not conflict_keys:
            logger.info("[v2.53] 檢測完成：未發現重複或衝突")
        
        return duplicate_ids, conflict_keys

    def run(self):
        """執行多群組投資組合計算主流程 (v2.48 Automated + v2.52 FX Fix + v2.53 Duplicate Detection)"""
        logger.info(f"=== 開始執行多群組投資組合計算 (基準: {self.benchmark_ticker}) ===")
        
        # [v2.53] 在計算開始前檢測重複配息
        self.duplicate_div_ids, self.conflict_div_keys = self._detect_duplicate_dividends(self.df)
        
        # [v2.52] 優先使用 market_data 中的即時匯率
        # 這確保了 current_fx 變數持有的是最新的台幣匯率
        current_fx = DEFAULT_FX_RATE
        if hasattr(self.market, 'realtime_fx_rate') and self.market.realtime_fx_rate:
            current_fx = self.market.realtime_fx_rate
            logger.info(f"使用即時匯率進行計算: {current_fx:.4f}")
        elif not self.market.fx_rates.empty:
            current_fx = float(self.market.fx_rates.iloc[-1])
            logger.info(f"使用歷史收盤匯率進行計算 (無即時數據): {current_fx:.4f}")

        if self.df.empty:
            logger.warning("無交易紀錄,產生空快照以重置數據。")
            empty_summary = PortfolioSummary(
                total_value=0, invested_capital=0, total_pnl=0, 
                twr=0, xirr=0, realized_pnl=0, benchmark_twr=0, daily_pnl_twd=0
            )
            return PortfolioSnapshot(
                updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
                base_currency=BASE_CURRENCY,
                exchange_rate=round(current_fx, 2),
                summary=empty_summary,
                holdings=[],
                history=[],
                pending_dividends=[],
                groups={"all": PortfolioGroupData(summary=empty_summary, holdings=[], history=[], pending_dividends=[])}
            )
            
        # [v2.46] 全域復權預處理
        self._back_adjust_transactions_global()
        
        # [v2.40] 獲取市場狀態
        current_stage, stage_desc = self.pnl_helper.get_market_stage()
        logger.info(f"當前市場狀態: {current_stage} ({stage_desc})")

        all_tags = set()
        for tags_str in self.df['Tag'].dropna().unique():
            if not tags_str: 
                continue
            split_tags = [t.strip() for t in tags_str.replace(';', ',').split(',') if t.strip()]
            all_tags.update(split_tags)
        
        groups_to_calc = ['all'] + sorted(list(all_tags))
        logger.info(f"識別到的群組: {groups_to_calc}")

        final_groups_data = {}
        
        for group_name in groups_to_calc:
            logger.info(f"正在計算群組: {group_name}")
            
            if group_name == 'all':
                group_df = self.df.copy()
            else:
                mask = self.df['Tag'].apply(
                    lambda x: group_name in [t.strip() for t in (x or '').replace(';', ',').split(',')]
                )
                group_df = self.df[mask].copy()
            
            if group_df.empty:
                logger.warning(f"群組 {group_name} 無交易紀錄,跳過")
                continue

            group_start_date = group_df['Date'].min()
            group_end_date = datetime.now()
            group_date_range = pd.date_range(start=group_start_date, end=group_end_date, freq='D').normalize()
            
            logger.info(f"[群組:{group_name}] 日期範圍: {group_start_date.strftime('%Y-%m-%d')} ~ {group_end_date.strftime('%Y-%m-%d')}")

            group_result = self._calculate_single_portfolio(group_df, group_date_range, current_fx, group_name, current_stage)
            final_groups_data[group_name] = group_result

        all_data = final_groups_data.get('all')
        if not all_data:
            logger.error("無法產出 'all' 群組的總體數據")
            return None
        
        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY,
            exchange_rate=round(current_fx, 2),
            summary=all_data.summary,
            holdings=all_data.holdings,
            history=all_data.history,
            pending_dividends=all_data.pending_dividends,
            groups=final_groups_data
        )

    def _back_adjust_transactions_global(self):
        """[v2.48] 全域復權處理"""
        logger.info("正在進行全域交易數據復權處理...")
        for index, row in self.df.iterrows():
            sym = row['Symbol']
            date = row['Date']
            if row['Type'] not in ['BUY', 'SELL']: 
                continue
            
            is_tw = self._is_taiwan_stock(sym)
            split_factor = self.market.get_transaction_multiplier(sym, date)
            
            if is_tw:
                div_adj_factor = 1.0
            else:
                div_adj_factor = self.market.get_dividend_adjustment_factor(sym, date)
            
            if split_factor != 1.0 or div_adj_factor != 1.0:
                old_qty = row['Qty']
                old_price = row['Price']
                new_qty = old_qty * split_factor
                new_price = (old_price / split_factor) * div_adj_factor
                
                self.df.at[index, 'Qty'] = new_qty
                self.df.at[index, 'Price'] = new_price

    def _get_previous_trading_day(self, date):
        """獲取前一個交易日(排除周末)"""
        prev_date = date - timedelta(days=1)
        while prev_date.weekday() >= 5:
            prev_date -= timedelta(days=1)
        return prev_date

    def _calculate_single_portfolio(self, df, date_range, current_fx, group_name="unknown", current_stage="CLOSED"):
        """單一群組的核心計算邏輯 (v2.48 Automated + v2.53 Duplicate Handling)"""
        
        txn_analyzer = TransactionAnalyzer(df)
        
        holdings = {}
        fifo_queues = {}
        invested_capital = 0.0
        total_realized_pnl_twd = 0.0
        history_data = []
        confirmed_dividends = set()
        dividend_history = []
        xirr_cashflows = []
        
        cumulative_twr_factor = 1.0
        last_market_value_twd = 0.0
        first_benchmark_val_twd = None

        # [v2.53] 過濾重複的 DIV 記錄
        div_txs = df[df['Type'] == 'DIV'].copy()
        
        for _, row in div_txs.iterrows():
            # 跳過重複記錄
            if 'id' in row and row['id'] in self.duplicate_div_ids:
                logger.info(f"[v2.53] 跳過重複配息記錄: {row['Symbol']} {row['Date'].strftime('%Y-%m-%d')} (ID: {row['id']})")
                continue
            
            key = f"{row['Symbol']}_{row['Date'].strftime('%Y-%m-%d')}"
            confirmed_dividends.add(key)

        if not df.empty:
            first_tx_date = df['Date'].min()
            prev_trading_day = self._get_previous_trading_day(first_tx_date)
            prev_date_str = prev_trading_day.strftime('%Y-%m-%d')
            
            try:
                prev_fx = self.market.fx_rates.asof(prev_trading_day)
                if pd.isna(prev_fx): prev_fx = DEFAULT_FX_RATE
            except: 
                prev_fx = DEFAULT_FX_RATE
            
            prev_benchmark_p = self.market.get_price(self.benchmark_ticker, prev_trading_day)
            effective_prev_fx = self._get_effective_fx_rate(self.benchmark_ticker, prev_fx)
            prev_benchmark_val_twd = prev_benchmark_p * effective_prev_fx
            
            if first_benchmark_val_twd is None and prev_benchmark_val_twd > 0:
                first_benchmark_val_twd = prev_benchmark_val_twd
            
            history_data.append({
                "date": prev_date_str, 
                "total_value": 0,
                "invested": 0, 
                "net_profit": 0,
                "realized_pnl": 0,
                "unrealized_pnl": 0,
                "twr": 0.0, 
                "benchmark_twr": 0.0,
                "fx_rate": round(prev_fx, 4)
            })
            
            logger.info(f"[群組:{group_name}] 已在 {prev_date_str} 補上虛擬 0 資產記錄(第一筆交易: {first_tx_date.strftime('%Y-%m-%d')})。")

        last_fx = current_fx
        
        for d in date_range:
            current_date = d.date()
            
            # [v2.52 Fix] 在迴圈中，獲取當日對應的匯率 (供下單計算用)
            try:
                fx = self.market.fx_rates.asof(d)
                if pd.isna(fx): fx = DEFAULT_FX_RATE
            except: 
                fx = DEFAULT_FX_RATE
            
            benchmark_p = self.market.get_price(self.benchmark_ticker, d)
            effective_benchmark_fx = self._get_effective_fx_rate(self.benchmark_ticker, fx)
            curr_benchmark_val_twd = benchmark_p * effective_benchmark_fx

            if first_benchmark_val_twd is None and curr_benchmark_val_twd > 0:
                first_benchmark_val_twd = curr_benchmark_val_twd

            daily_txns = df[df['Date'].dt.date == current_date].copy()
            
            if not daily_txns.empty:
                priority_map = {'BUY': 1, 'DIV': 2, 'SELL': 3}
                daily_txns['priority'] = daily_txns['Type'].map(priority_map).fillna(99)
                daily_txns = daily_txns.sort_values(by='priority', kind='stable')
            
            daily_net_cashflow_twd = 0.0
            
            for _, row in daily_txns.iterrows():
                sym = row['Symbol']
                if sym not in holdings:
                    holdings[sym] = {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': row['Tag']}
                    fifo_queues[sym] = deque()

                if row['Type'] == 'BUY':
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    cost_usd = (row['Qty'] * row['Price']) + row['Commission'] + row['Tax']
                    cost_twd = cost_usd * effective_fx
                    holdings[sym]['qty'] += row['Qty']
                    holdings[sym]['cost_basis_usd'] += cost_usd
                    holdings[sym]['cost_basis_twd'] += cost_twd
                    fifo_queues[sym].append({
                        'qty': row['Qty'], 'price': row['Price'], 'cost_total_usd': cost_usd, 
                        'cost_total_twd': cost_twd, 'date': d
                    })
                    invested_capital += cost_twd
                    xirr_cashflows.append({'date': d, 'amount': -cost_twd})
                    daily_net_cashflow_twd += cost_twd

                elif row['Type'] == 'SELL':
                    if not fifo_queues.get(sym) or not fifo_queues[sym]: continue
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    proceeds_twd = ((row['Qty'] * row['Price']) - row['Commission'] - row['Tax']) * effective_fx
                    remaining = row['Qty']
                    cost_sold_twd = 0.0
                    cost_sold_usd = 0.0
                    while remaining > 1e-6 and fifo_queues[sym]:
                        batch = fifo_queues[sym][0]
                        take = min(remaining, batch['qty'])
                        frac = take / batch['qty']
                        cost_sold_usd += batch['cost_total_usd'] * frac
                        cost_sold_twd += batch['cost_total_twd'] * frac
                        batch['qty'] -= take
                        batch['cost_total_usd'] -= batch['cost_total_usd'] * frac
                        batch['cost_total_twd'] -= batch['cost_total_twd'] * frac
                        remaining -= take
                        if batch['qty'] < 1e-6: fifo_queues[sym].popleft()
                    
                    holdings[sym]['qty'] -= (row['Qty'] - remaining)
                    holdings[sym]['cost_basis_usd'] -= cost_sold_usd
                    holdings[sym]['cost_basis_twd'] -= cost_sold_twd
                    invested_capital -= cost_sold_twd
                    total_realized_pnl_twd += (proceeds_twd - cost_sold_twd)
                    xirr_cashflows.append({'date': d, 'amount': proceeds_twd})
                    daily_net_cashflow_twd -= proceeds_twd

                elif row['Type'] == 'DIV':
                    # [v2.53] 跳過重複的 DIV 記錄
                    if 'id' in row and row['id'] in self.duplicate_div_ids:
                        continue
                    
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    div_twd = row['Price'] * effective_fx
                    total_realized_pnl_twd += div_twd
                    xirr_cashflows.append({'date': d, 'amount': div_twd})
                    daily_net_cashflow_twd -= div_twd

            # [v2.44 復權修正] 配息計算
            date_str = d.strftime('%Y-%m-%d')
            for sym, h_data in holdings.items():
                div_per_share = self.market.get_dividend(sym, d)
                if div_per_share > 0 and h_data['qty'] > 1e-6:
                    effective_fx = self._get_effective_fx_rate(sym, fx)
                    div_key = f"{sym}_{date_str}"
                    
                    # [v2.53] 檢查是否為衝突記錄
                    if div_key in self.conflict_div_keys:
                        logger.warning(f"[v2.53] 跳過衝突配息: {div_key} (需要手動處理)")
                        continue
                    
                    is_confirmed = div_key in confirmed_dividends
                    
                    split_factor = self.market.get_transaction_multiplier(sym, d)
                    shares_at_ex = h_data['qty'] / split_factor
                    
                    total_gross = shares_at_ex * div_per_share
                    total_net_usd = total_gross * 0.7 
                    total_net_twd = total_net_usd * effective_fx

                    dividend_history.append({
                        'symbol': sym, 'ex_date': date_str, 'shares_held': h_data['qty'],
                        'dividend_per_share_gross': div_per_share, 
                        'total_gross': round(total_gross, 2),
                        'total_net_usd': round(total_net_usd, 2),
                        'total_net_twd': round(total_net_twd, 0),
                        'fx_rate': fx, 'status': 'confirmed' if is_confirmed else 'pending'
                    })
                    
                    if not is_confirmed:
                        total_realized_pnl_twd += total_net_twd
                        xirr_cashflows.append({'date': d, 'amount': total_net_twd})
                        daily_net_cashflow_twd -= total_net_twd

            # [v2.52 FIX] 計算市值時使用修復後的價格與匯率選擇邏輯
            # _get_asset_effective_price_and_fx 會根據日期和市場狀態選擇正確的 FX
            current_market_value_twd = 0.0
            
            # 用於記錄日誌的 FX (取第一個持倉的 FX 即可)
            logging_fx = fx
            
            for sym, h in holdings.items():
                if h['qty'] > 1e-6:
                    # 傳入 current_fx (即時匯率)，方法內部會決定是否使用它
                    price, effective_fx = self._get_asset_effective_price_and_fx(sym, current_date, current_fx)
                    current_market_value_twd += h['qty'] * price * effective_fx
                    logging_fx = effective_fx if not self._is_taiwan_stock(sym) else logging_fx
            
            period_hpr_factor = 1.0
            
            if last_market_value_twd > 1e-9:
                period_hpr_factor = (current_market_value_twd - daily_net_cashflow_twd) / last_market_value_twd
            elif current_market_value_twd > 1e-9 and daily_net_cashflow_twd > 1e-9:
                period_hpr_factor = current_market_value_twd / daily_net_cashflow_twd
            elif current_market_value_twd < 1e-9 and last_market_value_twd < 1e-9:
                period_hpr_factor = 1.0
            
            if not np.isfinite(period_hpr_factor):
                period_hpr_factor = 1.0
            
            cumulative_twr_factor *= period_hpr_factor
            last_market_value_twd = current_market_value_twd
            
            unrealized_pnl = current_market_value_twd - sum(h['cost_basis_twd'] for h in holdings.values() if h['qty'] > 1e-6)
            total_pnl = unrealized_pnl + total_realized_pnl_twd
            
            benchmark_twr = (curr_benchmark_val_twd / first_benchmark_val_twd - 1) * 100 if first_benchmark_val_twd else 0.0

            history_data.append({
                "date": date_str, "total_value": round(current_market_value_twd, 0),
                "invested": round(invested_capital, 0), 
                "net_profit": round(total_pnl, 0),
                "realized_pnl": round(total_realized_pnl_twd, 0),
                "unrealized_pnl": round(unrealized_pnl, 0),
                "twr": round((cumulative_twr_factor - 1) * 100, 2), 
                "benchmark_twr": round(benchmark_twr, 2),
                # 這裡記錄的 FX 僅供參考，實際計算已在上面完成
                "fx_rate": round(logging_fx, 4)
            })
            
            last_fx = fx

        # --- [v2.48] 最終報表產生 & 驗證 ---
        final_holdings = []
        current_holdings_cost_sum = 0.0
        
        effective_date_tw = self.pnl_helper.get_effective_display_date(True)
        effective_date_us = self.pnl_helper.get_effective_display_date(False)
        
        txns_tw_day = df[df['Date'].dt.date == effective_date_tw]
        txns_us_day = df[df['Date'].dt.date == effective_date_us]
        
        active_symbols = set([k for k, v in holdings.items() if v['qty'] > 1e-4])
        active_symbols.update(txns_tw_day['Symbol'].unique())
        active_symbols.update(txns_us_day['Symbol'].unique())

        for sym in active_symbols:
            h = holdings.get(sym, {'qty': 0.0, 'cost_basis_usd': 0.0, 'cost_basis_twd': 0.0, 'tag': None})
            
            is_tw = self._is_taiwan_stock(sym)
            effective_display_date = self.pnl_helper.get_effective_display_date(is_tw)
            
            sym_txs = df[(df['Symbol'] == sym) & (df['Date'].dt.date == effective_display_date)]
            
            if not h['tag'] and not sym_txs.empty:
                tags = sym_txs['Tag'].dropna()
                if not tags.empty:
                    h['tag'] = tags.iloc[0]

            effective_fx = self._get_effective_fx_rate(sym, current_fx)
            
            curr_p = self.market.get_price(sym, pd.Timestamp(effective_display_date))
            prev_date = effective_display_date - timedelta(days=1)
            while prev_date.weekday() >= 5:
                prev_date -= timedelta(days=1)
            prev_p = self.market.get_price(sym, pd.Timestamp(prev_date))
            
            position_snap = txn_analyzer.analyze_today_position(sym, effective_display_date, effective_fx)
            
            realized_pnl_today = position_snap.realized_pnl
            
            base_prev_close = prev_p 
            unrealized_pnl_today = 0.0
            
            if position_snap.qty > 0:
                weighted_base = txn_analyzer.get_base_price_for_pnl(position_snap, base_prev_close)
                unrealized_pnl_today = (curr_p - weighted_base) * position_snap.qty * effective_fx
            
            total_daily_pnl = realized_pnl_today + unrealized_pnl_today
            
            cost = h['cost_basis_twd']
            current_holdings_cost_sum += cost
            mkt_val = h['qty'] * curr_p * effective_fx
            
            daily_change_pct = round((curr_p - prev_p) / prev_p * 100, 2) if prev_p > 0 else 0.0
            
            currency = self.currency_detector.detect(sym)
            
            if h['qty'] > 1e-4 or abs(total_daily_pnl) > 1:
                 final_holdings.append(HoldingPosition(
                    symbol=sym, tag=h['tag'], currency=currency, qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0), pnl_twd=round(mkt_val - cost, 0),
                    pnl_percent=round((mkt_val - cost) / cost * 100, 2) if cost > 0 else 0,
                    current_price_origin=round(curr_p, 2), avg_cost_usd=round(h['cost_basis_usd'] / h['qty'], 2) if h['qty'] > 0 else 0,
                    prev_close_price=round(prev_p, 2), daily_change_usd=round(curr_p - prev_p, 2),
                    daily_change_percent=daily_change_pct,
                    daily_pl_twd=round(total_daily_pnl, 0)
                ))
        
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        display_daily_pnl = sum(h.daily_pl_twd for h in final_holdings)
        
        logger.info(f"[群組:{group_name}] 當日損益(持股加總 v2.48): {display_daily_pnl}")
        
        self.validator.validate_daily_balance(holdings, invested_capital, current_holdings_cost_sum)
        
        xirr_val = 0.0
        if xirr_cashflows:
            curr_val_sum = sum(h.market_value_twd for h in final_holdings)
            xirr_cashflows_calc = xirr_cashflows.copy()
            xirr_cashflows_calc.append({'date': datetime.now(), 'amount': curr_val_sum})
            try:
                xirr_res = xirr([x['date'] for x in xirr_cashflows_calc], [x['amount'] for x in xirr_cashflows_calc])
                xirr_val = round(xirr_res * 100, 2)
            except: pass

        current_total_value = sum(h.market_value_twd for h in final_holdings)
        current_invested = current_holdings_cost_sum
        current_total_pnl = current_total_value - current_invested + total_realized_pnl_twd
        
        summary = PortfolioSummary(
            total_value=round(current_total_value, 0),
            invested_capital=round(current_invested, 0),
            total_pnl=round(current_total_pnl, 0),
            twr=history_data[-1]['twr'] if history_data else 0,
            xirr=xirr_val,
            realized_pnl=round(total_realized_pnl_twd, 0),
            benchmark_twr=history_data[-1]['benchmark_twr'] if history_data else 0,
            daily_pnl_twd=round(display_daily_pnl, 0)
        )
        
        self.validator.validate_twr_calculation(history_data)
        
        return PortfolioGroupData(
            summary=summary, holdings=final_holdings, history=history_data,
            pending_dividends=[DividendRecord(**d) for d in dividend_history if d['status']=='pending']
        )