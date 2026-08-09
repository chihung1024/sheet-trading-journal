import copy
from datetime import datetime
import json
from pathlib import Path

import pandas as pd
import pytest
import pytz

from journal_engine.core.calculation_manifest import (
    build_deterministic_calculation_identity,
    build_runtime_config_identity,
    build_source_records_identity,
    canonical_sha256,
)
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.daily_pnl_reconciler import reconcile_snapshot_daily_pnl
from journal_engine.core.input_provenance import (
    build_fx_inputs_identity,
    build_market_inputs_identity,
    build_provider_provenance_diagnostics,
)


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "golden_replay_mixed_tw_us_v1.json"


class FrozenReplayMarket:
    """Network-free effective market state for D1d golden replay."""

    def __init__(self, fixture):
        self.market_data = {}
        for symbol, rows in fixture["market"].items():
            index = pd.to_datetime([row["date"] for row in rows])
            self.market_data[symbol] = pd.DataFrame(
                {
                    "Close_Adjusted": [row["close_adjusted"] for row in rows],
                    "Dividends": [row["dividends"] for row in rows],
                    "Split_Factor": [row["split_factor"] for row in rows],
                    "Valuation_Source": [row["valuation_source"] for row in rows],
                    "Valuation_Source_Date": [row["valuation_source_date"] for row in rows],
                },
                index=index,
            )

        self.fx_rates_by_currency = {}
        self.realtime_fx_rates_by_currency = {}
        for currency, payload in fixture["fx"].items():
            historical = payload["historical"]
            series = pd.Series(
                [row["rate"] for row in historical],
                index=pd.to_datetime([row["date"] for row in historical]),
                dtype=float,
            )
            self.fx_rates_by_currency[currency] = series
            if payload.get("realtime") is not None:
                self.realtime_fx_rates_by_currency[currency] = float(payload["realtime"])

        self.fx_rates = self.fx_rates_by_currency["USD"]
        self.realtime_fx_rate = self.realtime_fx_rates_by_currency.get("USD")

    @staticmethod
    def _normalize_date(value):
        value = pd.Timestamp(value)
        if value.tzinfo is not None:
            value = value.tz_localize(None)
        return value.normalize()

    def get_price(self, symbol, value_date):
        price, _ = self.get_price_asof(symbol, value_date)
        return price

    def get_price_asof(self, symbol, value_date):
        target = self._normalize_date(value_date)
        frame = self.market_data[symbol]
        idx = frame.index.get_indexer([target], method="pad")[0]
        if idx == -1:
            return 0.0, target
        used = frame.index[idx]
        return float(frame.iloc[idx]["Close_Adjusted"]), used

    def get_prev_trading_date(self, symbol, used_date):
        target = self._normalize_date(used_date)
        frame = self.market_data[symbol]
        idx = frame.index.get_indexer([target], method="pad")[0]
        if idx <= 0:
            return frame.index[0]
        return frame.index[idx - 1]

    def get_transaction_multiplier(self, symbol, value_date):
        target = self._normalize_date(value_date)
        frame = self.market_data.get(symbol)
        if frame is None or frame.empty:
            return 1.0
        idx = frame.index.get_indexer([target], method="pad")[0]
        if idx == -1:
            idx = 0
        return float(frame.iloc[idx]["Split_Factor"])

    def get_dividend(self, symbol, value_date):
        target = self._normalize_date(value_date)
        frame = self.market_data.get(symbol)
        if frame is None or target not in frame.index:
            return 0.0
        return float(frame.loc[target, "Dividends"])

    def get_fx_snapshot(self, value_date):
        target = self._normalize_date(value_date)
        snapshot = {"TWD": 1.0}
        for currency, series in self.fx_rates_by_currency.items():
            value = series.asof(target)
            if pd.notna(value):
                snapshot[currency] = float(value)
        return snapshot

    def get_realtime_fx_snapshot(self, value_date=None):
        snapshot = self.get_fx_snapshot(value_date)
        snapshot.update(self.realtime_fx_rates_by_currency)
        snapshot["TWD"] = 1.0
        return snapshot


def _load_fixture():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _fixed_now(fixture):
    parsed = datetime.fromisoformat(fixture["calculation_now"])
    return parsed.astimezone(pytz.timezone("Asia/Taipei"))


def _raw_transactions(fixture):
    frame = pd.DataFrame(copy.deepcopy(fixture["transactions"]))
    frame["Date"] = pd.to_datetime(frame["Date"])
    return frame


def _market_inputs_asof(market, calculation_as_of):
    cutoff = pd.Timestamp(calculation_as_of)
    return {
        symbol: frame.loc[frame.index <= cutoff].copy(deep=True)
        for symbol, frame in market.market_data.items()
    }


def _fx_inputs_asof(market, calculation_as_of):
    cutoff = pd.Timestamp(calculation_as_of)
    return {
        currency: series.loc[series.index <= cutoff].copy(deep=True)
        for currency, series in market.fx_rates_by_currency.items()
    }


def _snapshot_projection(snapshot):
    payload = snapshot.model_dump(mode="json")
    payload.pop("updated_at", None)
    return payload


def _run_replay(fixture):
    raw_df = _raw_transactions(fixture)
    market = FrozenReplayMarket(fixture)
    fixed_now = _fixed_now(fixture)

    calculator = PortfolioCalculator(
        raw_df.copy(deep=True),
        market,
        benchmark_ticker=fixture["benchmark_symbol"],
        oversell_policy=fixture["oversell_policy"],
        calculation_now=fixed_now,
    )
    snapshot = calculator.run()
    assert snapshot is not None
    snapshot.benchmark_symbol = fixture["benchmark_symbol"]
    reconcile_snapshot_daily_pnl(snapshot, calculator.df, calculator)

    calculation_as_of = calculator.calculation_as_of
    source_identity = build_source_records_identity(raw_df)
    runtime_identity = build_runtime_config_identity(
        benchmark_symbol=fixture["benchmark_symbol"],
        base_currency=fixture["base_currency"],
        oversell_policy=fixture["oversell_policy"],
    )
    market_identity = build_market_inputs_identity(
        _market_inputs_asof(market, calculation_as_of),
        required_symbols=sorted(market.market_data),
    )
    fx_identity = build_fx_inputs_identity(
        _fx_inputs_asof(market, calculation_as_of),
        required_currencies=["TWD", "USD"],
        realtime_fx_rates_by_currency=market.realtime_fx_rates_by_currency,
        include_realtime=True,
    )
    combined_identity = build_deterministic_calculation_identity(
        engine_source_commit=fixture["engine_source_commit"],
        source_records=source_identity,
        runtime_config=runtime_identity,
        market_inputs_sha256=market_identity.sha256,
        fx_inputs_sha256=fx_identity.sha256,
        calculation_as_of=calculation_as_of,
    )
    provider_diagnostics = build_provider_provenance_diagnostics(
        metadata_by_symbol=fixture["provider_metadata"],
        realtime_overlay_symbols=(),
    )
    projection = _snapshot_projection(snapshot)

    return {
        "snapshot": snapshot,
        "calculator": calculator,
        "source_identity": source_identity,
        "runtime_identity": runtime_identity,
        "market_identity": market_identity,
        "fx_identity": fx_identity,
        "combined_identity": combined_identity,
        "provider_diagnostics": provider_diagnostics,
        "projection": projection,
        "content_sha256": canonical_sha256(projection),
    }


def _forbid_network(monkeypatch):
    def fail(*_args, **_kwargs):
        raise AssertionError("D1d replay must not access the network")

    monkeypatch.setattr("requests.sessions.Session.request", fail)
    monkeypatch.setattr("yfinance.download", fail)


def _assert_golden_economics(replay, expected):
    snapshot = replay["snapshot"]
    summary = snapshot.summary
    holdings = {holding.symbol: holding for holding in snapshot.holdings}
    dividends = {record.symbol: record.total_net_twd for record in snapshot.pending_dividends}
    day_ledger = {
        row["symbol"]: row["total_pnl_twd"]
        for row in snapshot.groups["all"].day_ledger
    }

    assert set(holdings) == {"2330.TW", "NVDA"}
    assert holdings["2330.TW"].qty == 10.0
    assert holdings["NVDA"].qty == expected["nvda_adjusted_qty"]
    assert holdings["2330.TW"].market_value_twd == 5100.0
    assert holdings["NVDA"].market_value_twd == 7150.0

    assert summary.total_value == expected["total_value"]
    assert summary.invested_capital == expected["invested_capital"]
    assert summary.realized_pnl == expected["realized_pnl"]
    assert summary.total_pnl == expected["total_pnl"]
    assert summary.daily_pnl_twd == expected["daily_pnl_twd"]
    assert summary.daily_pnl_breakdown == expected["daily_pnl_breakdown"]
    assert summary.daily_pnl_base_value == expected["daily_pnl_base_value"]
    assert summary.daily_pnl_roi_percent == expected["daily_pnl_roi_percent"]

    assert summary.twr == expected["twr"]
    assert summary.twr_status == expected["twr_status"]
    assert summary.twr_reason is None
    assert summary.twr_invalid_since is None
    assert summary.xirr == expected["xirr"]
    assert summary.xirr_status == expected["xirr_status"]
    assert summary.xirr_reason is None
    assert summary.xirr_asof_date == expected["xirr_asof_date"]
    assert summary.xirr_cashflow_conventional is expected["xirr_cashflow_conventional"]

    assert dividends == expected["pending_dividends_twd"]
    assert day_ledger == expected["day_ledger_total_pnl_twd"]


def test_d1d_golden_replay_is_exact_and_network_free(monkeypatch):
    _forbid_network(monkeypatch)
    fixture = _load_fixture()

    first = _run_replay(copy.deepcopy(fixture))
    second = _run_replay(copy.deepcopy(fixture))
    expected = fixture["expected"]

    assert first["calculator"].calculation_as_of.isoformat() == expected["calculation_as_of"]
    assert first["snapshot"].updated_at == "2026-01-05 15:00"
    assert first["snapshot"].history[-1]["date"] == expected["history_last_date"]
    assert max(row["date"] for row in first["snapshot"].history) == expected["history_last_date"]
    assert first["market_identity"].synthetic_row_counts == expected["synthetic_row_counts"]

    _assert_golden_economics(first, expected)
    _assert_golden_economics(second, expected)

    assert first["projection"] == second["projection"]
    assert first["content_sha256"] == second["content_sha256"]
    assert first["combined_identity"] == second["combined_identity"]
    assert first["provider_diagnostics"] == second["provider_diagnostics"]

    assert first["content_sha256"] == expected["content_sha256"]
    assert first["combined_identity"].combined_sha256 == expected["combined_input_sha256"]


def test_d1d_future_rows_and_provider_diagnostics_do_not_pollute_numeric_identity(monkeypatch):
    _forbid_network(monkeypatch)
    fixture = _load_fixture()
    baseline = _run_replay(copy.deepcopy(fixture))

    changed = copy.deepcopy(fixture)
    changed["market"]["NVDA"][-1]["close_adjusted"] = 123456.0
    changed["market"]["2330.TW"][-1]["close_adjusted"] = 654321.0
    changed["fx"]["USD"]["historical"][-1]["rate"] = 777.0
    changed["provider_metadata"]["NVDA"]["selection_reason"] = "different_provider_reason"
    replay = _run_replay(changed)

    assert replay["projection"] == baseline["projection"]
    assert replay["content_sha256"] == baseline["content_sha256"]
    assert replay["market_identity"] == baseline["market_identity"]
    assert replay["fx_identity"] == baseline["fx_identity"]
    assert replay["combined_identity"] == baseline["combined_identity"]
    assert replay["provider_diagnostics"] != baseline["provider_diagnostics"]


def test_d1d_identity_components_distinguish_change_causes(monkeypatch):
    _forbid_network(monkeypatch)
    fixture = _load_fixture()
    baseline = _run_replay(copy.deepcopy(fixture))

    source_changed = copy.deepcopy(fixture)
    source_changed["transactions"][0]["Commission"] = 2.0
    source_replay = _run_replay(source_changed)
    assert source_replay["source_identity"].sha256 != baseline["source_identity"].sha256
    assert source_replay["combined_identity"].combined_sha256 != baseline["combined_identity"].combined_sha256

    market_changed = copy.deepcopy(fixture)
    market_changed["market"]["NVDA"][2]["close_adjusted"] = 56.0
    market_replay = _run_replay(market_changed)
    assert market_replay["market_identity"].sha256 != baseline["market_identity"].sha256
    assert market_replay["combined_identity"].combined_sha256 != baseline["combined_identity"].combined_sha256

    fx_changed = copy.deepcopy(fixture)
    fx_changed["fx"]["USD"]["historical"][2]["rate"] = 33.0
    fx_changed["fx"]["USD"]["realtime"] = 33.0
    fx_replay = _run_replay(fx_changed)
    assert fx_replay["fx_identity"].sha256 != baseline["fx_identity"].sha256
    assert fx_replay["combined_identity"].combined_sha256 != baseline["combined_identity"].combined_sha256

    synthetic_changed = copy.deepcopy(fixture)
    synthetic_changed["market"]["2330.TW"][1]["valuation_source"] = "market"
    synthetic_replay = _run_replay(synthetic_changed)
    assert synthetic_replay["projection"] == baseline["projection"]
    assert synthetic_replay["market_identity"].sha256 != baseline["market_identity"].sha256
    assert synthetic_replay["combined_identity"].combined_sha256 != baseline["combined_identity"].combined_sha256

    engine_changed = copy.deepcopy(fixture)
    engine_changed["engine_source_commit"] = "2222222222222222222222222222222222222222"
    engine_replay = _run_replay(engine_changed)
    assert engine_replay["projection"] == baseline["projection"]
    assert engine_replay["combined_identity"].combined_sha256 != baseline["combined_identity"].combined_sha256

    config_changed = copy.deepcopy(fixture)
    config_changed["oversell_policy"] = "CLAMP"
    config_replay = _run_replay(config_changed)
    assert config_replay["projection"] == baseline["projection"]
    assert config_replay["runtime_identity"].sha256 != baseline["runtime_identity"].sha256
    assert config_replay["combined_identity"].combined_sha256 != baseline["combined_identity"].combined_sha256
