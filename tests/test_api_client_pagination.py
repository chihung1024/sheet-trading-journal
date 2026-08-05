from unittest.mock import Mock

import pytest

from journal_engine.clients.api_client import CloudflareAPIError, CloudflareClient


def response(payload, status=200):
    item = Mock()
    item.status_code = status
    item.json.return_value = payload
    return item


def test_fetch_records_consumes_all_pages(monkeypatch):
    pages = [
        response({"success": True, "data": [{"id": 3}, {"id": 2}], "page": {"limit": 1000, "count": 2, "has_more": True, "next_cursor": "next-one"}}),
        response({"success": True, "data": [{"id": 1}], "page": {"limit": 1000, "count": 1, "has_more": False, "next_cursor": None}}),
    ]
    get = Mock(side_effect=pages)
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", get)
    assert CloudflareClient().fetch_records("user@example.com") == [{"id": 3}, {"id": 2}, {"id": 1}]
    assert get.call_args_list[0].kwargs["params"] == {"limit": 1000}
    assert get.call_args_list[1].kwargs["params"] == {"limit": 1000, "cursor": "next-one"}


def test_fetch_records_rejects_cursor_cycle(monkeypatch):
    pages = [
        response({"success": True, "data": [{"id": 2}], "page": {"limit": 1000, "count": 1, "has_more": True, "next_cursor": "same"}}),
        response({"success": True, "data": [{"id": 1}], "page": {"limit": 1000, "count": 1, "has_more": True, "next_cursor": "same"}}),
    ]
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", Mock(side_effect=pages))
    with pytest.raises(CloudflareAPIError, match="cursor"):
        CloudflareClient().fetch_records()


@pytest.mark.parametrize("page", [{}, {"limit": 1000, "count": 2, "has_more": False, "next_cursor": None}])
def test_fetch_records_rejects_malformed_page(monkeypatch, page):
    payload = {"success": True, "data": [{"id": 1}], "page": page}
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", Mock(return_value=response(payload)))
    with pytest.raises(CloudflareAPIError):
        CloudflareClient().fetch_records()


def test_fetch_records_rejects_ambiguous_legacy_cap(monkeypatch):
    payload = {"success": True, "data": [{"id": item} for item in range(1000)]}
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", Mock(return_value=response(payload)))
    with pytest.raises(CloudflareAPIError, match="截斷"):
        CloudflareClient().fetch_records()


def test_fetch_records_rejects_duplicate_record_across_pages(monkeypatch):
    pages = [
        response({"success": True, "data": [{"id": 2}], "page": {"limit": 1000, "count": 1, "has_more": True, "next_cursor": "next-one"}}),
        response({"success": True, "data": [{"id": 2}], "page": {"limit": 1000, "count": 1, "has_more": False, "next_cursor": None}}),
    ]
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", Mock(side_effect=pages))
    with pytest.raises(CloudflareAPIError, match="重複"):
        CloudflareClient().fetch_records()


def test_fetch_records_rejects_invalid_record_id(monkeypatch):
    payload = {"success": True, "data": [{"id": "1"}], "page": {"limit": 1000, "count": 1, "has_more": False, "next_cursor": None}}
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", Mock(return_value=response(payload)))
    with pytest.raises(CloudflareAPIError, match="record id"):
        CloudflareClient().fetch_records()
