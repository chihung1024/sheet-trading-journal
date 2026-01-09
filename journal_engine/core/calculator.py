    def _generate_final_output(self, current_fx):
        """
        產生最終報表輸出
        
        ✅ 新增功能：
        1. 計算每檔持股的前一交易日收盤價
        2. 計算每檔持股的今日變化（漲跌金額與百分比）
        3. 考慮美股交易時間，正確定義「昨日」
        """
        from datetime import timedelta
        import pytz
        
        print("整理最終報表...")
        final_holdings = []
        current_holdings_cost_sum = 0.0
        
        # ✅ 計算「前一交易日」的日期
        # 使用美東時間（ET）來判斷，因為美股收盤才是真正的「一天結束」
        et_tz = pytz.timezone('America/New_York')
        now_utc = datetime.now(pytz.utc)
        now_et = now_utc.astimezone(et_tz)
        
        # 當前日期（美東時間）
        current_date_et = now_et.date()
        
        # 計算前一交易日
        # 簡單處理：往前推1天，如果是週末就繼續往前推
        prev_date = current_date_et - timedelta(days=1)
        while prev_date.weekday() >= 5:  # 5=週六, 6=週日
            prev_date -= timedelta(days=1)
        
        # 轉換為 datetime 物件（使用美東時間的收盤時刻）
        prev_datetime_et = et_tz.localize(datetime.combine(prev_date, datetime.min.time()))
        
        print(f"[今日損益計算] 當前日期 (ET): {current_date_et}, 前一交易日: {prev_date}")
        
        for sym, h in self.holdings.items():
            if h['qty'] > 0.001:
                # 取得當前價格（可能是盤中價或收盤價）
                curr_p = self.market.get_price(sym, datetime.now())
                
                # ✅ 取得前一交易日的收盤價
                prev_p = self.market.get_price(sym, prev_datetime_et)
                
                # ✅ 計算今日變化
                if prev_p > 0:
                    daily_change_usd = curr_p - prev_p
                    daily_change_percent = (daily_change_usd / prev_p) * 100
                else:
                    # 無法取得前日價格（可能是新上市股票或數據缺失）
                    print(f"[警告] {sym} 無法取得前一交易日價格，使用當前價格作為基準")
                    daily_change_usd = 0.0
                    daily_change_percent = 0.0
                    prev_p = curr_p
                
                # 計算市值與損益（使用當前匯率）
                mkt_val = h['qty'] * curr_p * current_fx
                cost = h['cost_basis_twd']
                pnl = mkt_val - cost
                pnl_pct = (pnl / cost * 100) if cost > 0 else 0
                avg_cost_usd = h['cost_basis_usd'] / h['qty'] if h['qty'] > 0 else 0
                current_holdings_cost_sum += cost
                
                final_holdings.append(HoldingPosition(
                    symbol=sym, 
                    tag=h['tag'], 
                    currency="USD",
                    qty=round(h['qty'], 2),
                    market_value_twd=round(mkt_val, 0),
                    pnl_twd=round(pnl, 0),
                    pnl_percent=round(pnl_pct, 2),
                    current_price_origin=round(curr_p, 2),
                    avg_cost_usd=round(avg_cost_usd, 2),
                    # ✅ 新增欄位
                    prev_close_price=round(prev_p, 2),
                    daily_change_usd=round(daily_change_usd, 2),
                    daily_change_percent=round(daily_change_percent, 2)
                ))
        
        # 按市值排序
        final_holdings.sort(key=lambda x: x.market_value_twd, reverse=True)
        
        # 計算總結統計
        curr_total_val = sum(x.market_value_twd for x in final_holdings)
        total_pnl = (curr_total_val - current_holdings_cost_sum) + self.total_realized_pnl_twd
        
        summary = PortfolioSummary(
            total_value=round(curr_total_val, 0),
            invested_capital=round(current_holdings_cost_sum, 0),
            total_pnl=round(total_pnl, 0),
            twr=self.history_data[-1]['twr'] if self.history_data else 0,
            realized_pnl=round(self.total_realized_pnl_twd, 0),
            benchmark_twr=self.history_data[-1]['benchmark_twr'] if self.history_data else 0
        )
        
        return PortfolioSnapshot(
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            base_currency=BASE_CURRENCY,
            exchange_rate=round(current_fx, 2),
            summary=summary,
            holdings=final_holdings,
            history=self.history_data
        )
