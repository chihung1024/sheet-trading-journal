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


def test_prepare_transactions_rejects_null_user_id():
    record = base_record()
    record["user_id"] = None

    with pytest.raises(runner.PortfolioUpdateError, match="user_id"):
        runner.prepare_transactions([record])


def test_prepare_transactions_rejects_null_symbol():
    record = base_record()
    record["symbol"] = None

    with pytest.raises(runner.PortfolioUpdateError, match="Symbol"):
        runner.prepare_transactions([record])


def test_prepare_transactions_rejects_unsupported_type():
    record = base_record()
    record["txn_type"] = "TRANSFER"

    with pytest.raises(runner.PortfolioUpdateError, match="不支援的 Type"):
        runner.prepare_transactions([record])


def test_prepare_transactions_normalizes_null_tag():
    record = base_record()
    record["tag"] = None

    df, users = runner.prepare_transactions([record])

    assert users == ["alpha@example.com"]
    assert df.loc[0, "Tag"] == ""
