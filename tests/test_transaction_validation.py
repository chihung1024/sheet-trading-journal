import pytest

import main as runner


def base_record():
    return {
        "id": 1,
        "user_id": "alpha@example.com",
        "txn_date": "2026-01-01",
        "symbol": "NVDA",
        "txn_type": "BUY",
        "qty": 1,
        "price": 100,
        "fee": 0,
        "tax": 0,
        "tag": "",
    }


def test_prepare_transactions_rejects_nan_quantity():
    record = base_record()
    record["qty"] = float("nan")

    with pytest.raises(runner.PortfolioUpdateError, match="Qty"):
        runner.prepare_transactions([record])


def test_prepare_transactions_rejects_blank_date():
    record = base_record()
    record["txn_date"] = None

    with pytest.raises(runner.PortfolioUpdateError, match="空白日期"):
        runner.prepare_transactions([record])
