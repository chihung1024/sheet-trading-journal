    def _generate_final_output(self, current_fx):
        """
        產生最終報表輸出
        
        ✅ 新增功能：計算每檔持股的前一交易日收盤價與今日變化
        """
        from datetime import timedelta
        import pandas as pd
        
        print("整理最終報表...")
        final_holdings = []
        current_holdings_cost_sum = 0.0
        
        # ✅ 使用 pandas Timestamp 並 normalize（與 market_data 格式一致）
        today = pd.Timestamp.now().normalize()
        
        # 往前推 1 天，如果是週末就繼續往前推
        prev_date = today - pd.Timedelta(days=1)
        while prev_date.weekday() >= 5:  # 5=週六, 6=週日
            prev_date -= pd.Timedelta(days=1)
        
        print(f"[今日損益計算] 當前日期: {today.date()}, 前一交易日: {prev_date.date()}")
        
        for sym, h in self.holdings.items():
            if h['qty'] > 0.001:
                # 取得當前價格
                curr_p = self.market.get_price(sym, today)
                
                # ✅ 取得前一交易日的收盤價
                prev_p = self.market.get_price(sym, prev_date)
                
                # ✅ Debug: 打印價格資訊
                if prev_p == 0 or prev_p == curr_p:
                    print(f"[DEBUG] {sym}: curr={curr_p:.2f}, prev={prev_p:.2f}")
                
                # ✅ 計算今日變化
                if prev_p > 0 and abs(curr_p - prev_p) > 0.01:  # 價格變化超過 $0.01
                    daily_change_usd = curr_p - prev_p
                    daily_change_percent = (daily_change_usd / prev_p) * 100
                else:
                    # 無法取得前日價格 或 價格幾乎相同
                    if prev_p == 0:
                        print(f"[警告] {sym} 無法取得前一交易日價格")
                    daily_change_usd = 0.0
                    daily_change_percent = 0.0
                    prev_p = curr_p if prev_p == 0 else prev_p
                
                # 計算市值與損益
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
