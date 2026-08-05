from pathlib import Path

path = Path('.pr06/apply_pr06.py')
text = path.read_text(encoding='utf-8')
old = '''            if not isinstance(page_records, list):
                raise CloudflareAPIError("交易紀錄 API 的 data 欄位不是陣列")
            if not isinstance(page, dict):
                raise CloudflareAPIError("交易紀錄 API 缺少分頁資訊")

            count = page.get("count")
'''
new = '''            if not isinstance(page_records, list):
                raise CloudflareAPIError("交易紀錄 API 的 data 欄位不是陣列")
            if page is None and page_number == 1 and cursor is None:
                if len(page_records) >= RECORD_PAGE_LIMIT:
                    raise CloudflareAPIError("舊版交易紀錄 API 可能已截斷資料")
                self.logger.warning("交易紀錄 API 使用舊版單頁格式")
                self.logger.info("成功取得 %s 筆交易紀錄", len(page_records))
                return page_records
            if not isinstance(page, dict):
                raise CloudflareAPIError("交易紀錄 API 缺少分頁資訊")

            count = page.get("count")
'''
if old not in text:
    raise SystemExit('pagination validation block not found')
text = text.replace(old, new)
old_test = '''@pytest.mark.parametrize("page", [None, {}, {"limit": 1000, "count": 2, "has_more": False, "next_cursor": None}])
def test_fetch_records_rejects_malformed_page(monkeypatch, page):
    payload = {"success": True, "data": [{"id": 1}], "page": page}
'''
new_test = '''@pytest.mark.parametrize("page", [{}, {"limit": 1000, "count": 2, "has_more": False, "next_cursor": None}])
def test_fetch_records_rejects_malformed_page(monkeypatch, page):
    payload = {"success": True, "data": [{"id": 1}], "page": page}
'''
if old_test not in text:
    raise SystemExit('malformed page test block not found')
text = text.replace(old_test, new_test)
append_marker = "''', encoding='utf-8')\n"
legacy_test = '''\n\ndef test_fetch_records_rejects_ambiguous_legacy_cap(monkeypatch):
    payload = {"success": True, "data": [{"id": item} for item in range(1000)]}
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", Mock(return_value=response(payload)))
    with pytest.raises(CloudflareAPIError, match="截斷"):
        CloudflareClient().fetch_records()
'''
pos = text.rfind(append_marker)
if pos < 0:
    raise SystemExit('test file terminator not found')
text = text[:pos] + legacy_test + text[pos:]
path.write_text(text, encoding='utf-8')
