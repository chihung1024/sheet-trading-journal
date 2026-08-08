import logging
from pathlib import Path

import pytest

import main as runner
from journal_engine.clients.api_client import CloudflareAPIError
from journal_engine.core.daily_pnl_reconciler import DailyPnLReconciliationError
from tools import run_portfolio_update as observed_runner


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize(
    ("error", "per_user", "expected"),
    [
        (runner.PortfolioUpdateError("環境變數中找不到 API_KEY"), False, observed_runner.CONFIGURATION_FAILED),
        (CloudflareAPIError("交易紀錄 API 連線失敗"), False, observed_runner.RECORDS_API_FAILED),
        (CloudflareAPIError("benchmark API 回應失敗"), False, observed_runner.SETTINGS_API_FAILED),
        (runner.PortfolioUpdateError("交易紀錄包含空白 Symbol 或 Type"), False, observed_runner.RECORD_VALIDATION_FAILED),
        (runner.PortfolioUpdateError("必要市場資料驗證失敗（缺少資料: NVDA）"), False, observed_runner.MARKET_DATA_FAILED),
        (runner.PortfolioUpdateError("計算器未產生快照"), True, observed_runner.CALCULATION_FAILED),
        (DailyPnLReconciliationError("mismatch"), True, observed_runner.RECONCILIATION_FAILED),
        (runner.PortfolioUpdateError("計算器與驗證器的拆股復權交易帳本不一致"), True, observed_runner.RECONCILIATION_FAILED),
        (runner.PortfolioUpdateError("快照驗證失敗，共偵測到 2 項錯誤"), True, observed_runner.SNAPSHOT_VALIDATION_FAILED),
        (CloudflareAPIError("投資組合上傳失敗 [user=masked]"), True, observed_runner.SNAPSHOT_UPLOAD_FAILED),
        (RuntimeError("unexpected calculator bug"), True, observed_runner.CALCULATION_FAILED),
        (RuntimeError("unexpected top-level bug"), False, observed_runner.UNKNOWN_CALCULATION_FAILED),
    ],
)
def test_classify_failure_uses_only_fixed_operational_codes(error, per_user, expected):
    assert observed_runner.classify_failure(error, per_user=per_user) == expected
    assert expected in observed_runner.SAFE_FAILURE_CODES


def test_multiple_distinct_user_failures_collapse_without_exposing_details():
    code = observed_runner.collapse_user_failure_codes(
        [
            runner.PortfolioUpdateError("快照驗證失敗，共偵測到 1 項錯誤"),
            CloudflareAPIError("投資組合上傳失敗 [user=masked]"),
        ]
    )
    assert code == observed_runner.MULTIPLE_USER_FAILURES


def test_same_user_failure_category_stays_specific():
    code = observed_runner.collapse_user_failure_codes(
        [
            runner.PortfolioUpdateError("計算器未產生快照"),
            RuntimeError("different calculator exception text"),
        ]
    )
    assert code == observed_runner.CALCULATION_FAILED


def test_user_failure_capture_reads_exception_object_not_log_text():
    capture = observed_runner.UserFailureCapture()
    logger = logging.getLogger("main")
    logger.addHandler(capture)
    try:
        try:
            raise runner.PortfolioUpdateError("快照驗證失敗，共偵測到 1 項錯誤")
        except runner.PortfolioUpdateError:
            logger.exception("使用者 ch***@example.com 處理失敗: rendered message")
    finally:
        logger.removeHandler(capture)

    assert len(capture.exceptions) == 1
    assert isinstance(capture.exceptions[0], runner.PortfolioUpdateError)
    assert observed_runner.classify_failure(capture.exceptions[0], per_user=True) == observed_runner.SNAPSHOT_VALIDATION_FAILED


def test_github_output_contains_only_key_and_safe_enum(tmp_path):
    output = tmp_path / "github-output.txt"
    observed_runner.write_github_output(observed_runner.MARKET_DATA_FAILED, str(output))
    assert output.read_text(encoding="utf-8") == "error_code=MARKET_DATA_FAILED\n"

    with pytest.raises(ValueError, match="unsafe calculation error code"):
        observed_runner.write_github_output("email=user@example.com", str(output))


def test_wrapper_reports_specific_per_user_failure_without_changing_runner_contract(monkeypatch, tmp_path):
    output = tmp_path / "github-output.txt"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.setattr(runner, "setup_logging", lambda: None)

    def fail_update():
        logger = logging.getLogger("main")
        try:
            raise runner.PortfolioUpdateError("快照驗證失敗，共偵測到 1 項錯誤")
        except runner.PortfolioUpdateError:
            logger.exception("使用者 ch***@example.com 處理失敗: hidden detail")
        raise runner.PortfolioUpdateError("本次更新有 1 位使用者失敗；成功 0 位")

    monkeypatch.setattr(runner, "run_update", fail_update)

    assert observed_runner.main() == 1
    assert output.read_text(encoding="utf-8") == "error_code=SNAPSHOT_VALIDATION_FAILED\n"


def test_wrapper_success_publishes_empty_error_code(monkeypatch, tmp_path):
    output = tmp_path / "github-output.txt"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.setattr(runner, "setup_logging", lambda: None)
    monkeypatch.setattr(runner, "run_update", lambda: None)

    assert observed_runner.main() == 0
    assert output.read_text(encoding="utf-8") == "error_code=\n"


def test_update_workflow_runs_wrapper_and_allowlists_codes_before_worker_report():
    source = (ROOT / ".github" / "workflows" / "update.yml").read_text(encoding="utf-8")

    assert "run: python tools/run_portfolio_update.py" in source
    assert "JOB_ERROR_CODE: ${{ steps.calculation.outputs.error_code }}" in source
    assert 'JOB_ERROR_CODE="CALCULATION_FAILED"' in source
    assert "run: python main.py" not in source

    for code in observed_runner.SAFE_FAILURE_CODES:
        assert code in source
