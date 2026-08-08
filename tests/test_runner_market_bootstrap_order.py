from pathlib import Path


def test_runner_bootstraps_transaction_dates_before_strict_market_validation():
    source = Path("main.py").read_text(encoding="utf-8")
    start = source.index("def run_update() -> None:")
    block = source[start:]

    download = block.index("market_client.download_data(")
    bootstrap = block.index("inserted_dates = ensure_transaction_dates_in_market_calendar(")
    validate = block.index("validate_required_market_data(")

    assert download < bootstrap < validate

    bootstrap_call = block[bootstrap:validate]
    assert "allow_leading_transaction_seed=True" in bootstrap_call
    assert "market_client" in bootstrap_call
    assert "df" in bootstrap_call
