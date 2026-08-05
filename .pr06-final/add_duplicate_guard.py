from pathlib import Path

path = Path('journal_engine/clients/api_client.py')
text = path.read_text(encoding='utf-8')
text = text.replace(
    '        seen_cursors = set()\n',
    '        seen_cursors = set()\n        seen_record_ids = set()\n',
)
old = '''            records.extend(page_records)
            if len(records) > MAX_RECORD_COUNT:
'''
new = '''            for record in page_records:
                if not isinstance(record, dict):
                    raise CloudflareAPIError("交易紀錄 API 包含非物件紀錄")
                record_id = record.get("id")
                if not isinstance(record_id, int) or isinstance(record_id, bool) or record_id <= 0:
                    raise CloudflareAPIError("交易紀錄 API 包含無效 record id")
                if record_id in seen_record_ids:
                    raise CloudflareAPIError("交易紀錄 API 跨頁回傳重複紀錄")
                seen_record_ids.add(record_id)

            records.extend(page_records)
            if len(records) > MAX_RECORD_COUNT:
'''
if old not in text:
    raise SystemExit('record extension block not found')
text = text.replace(old, new)
path.write_text(text, encoding='utf-8')

path = Path('tests/test_api_client_pagination.py')
text = path.read_text(encoding='utf-8')
text += '''\n\ndef test_fetch_records_rejects_duplicate_record_across_pages(monkeypatch):
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
'''
path.write_text(text, encoding='utf-8')
