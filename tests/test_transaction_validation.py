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

def test_prepare_transactions_exposes_optional_r2_metadata_as_shadow_columns():
    record = base_record()

    df, _ = runner.prepare_transactions([record])

    assert list(runner.SHADOW_TRANSACTION_METADATA_COLUMNS) == [
        "currency",
        "executed_at",
        "execution_sequence",
        "event_source",
    ]
    for column in runner.SHADOW_TRANSACTION_METADATA_COLUMNS:
        assert column in df.columns
        assert df.loc[0, column] is None
    assert "Timestamp" not in df.columns
    assert "Sequence" not in df.columns


def test_prepare_transactions_preserves_r2_metadata_without_using_it_for_sorting():
    later_by_metadata = base_record()
    later_by_metadata.update({
        "id": 1,
        "executed_at": "2026-01-01T10:00:00+08:00",
        "execution_sequence": "source:2",
        "currency": "USD",
        "event_source": "IBKR",
    })
    earlier_by_metadata = base_record()
    earlier_by_metadata.update({
        "id": 2,
        "executed_at": "2026-01-01T09:00:00+08:00",
        "execution_sequence": "source:1",
        "currency": "USD",
        "event_source": "IBKR",
    })

    df, _ = runner.prepare_transactions([earlier_by_metadata, later_by_metadata])

    assert df["id"].tolist() == [1, 2]
    assert df["executed_at"].tolist() == [
        "2026-01-01T10:00:00+08:00",
        "2026-01-01T09:00:00+08:00",
    ]
    assert df["execution_sequence"].tolist() == ["source:2", "source:1"]
    assert df["currency"].tolist() == ["USD", "USD"]
    assert df["event_source"].tolist() == ["IBKR", "IBKR"]
    assert "Timestamp" not in df.columns
    assert "Sequence" not in df.columns
