from pathlib import Path

path = Path('.pr06/apply_pr06.py')
text = path.read_text(encoding='utf-8')
text = text.replace('return base64UrlEncode(JSON.stringify(payload));', 'return recordCursorBase64Encode(JSON.stringify(payload));')
text = text.replace('const payload = JSON.parse(base64UrlDecode(value));', 'const payload = JSON.parse(recordCursorBase64Decode(value));')
text = text.replace('function base64UrlEncode(value) {', 'function recordCursorBase64Encode(value) {')
text = text.replace('function base64UrlDecode(value) {', 'function recordCursorBase64Decode(value) {')
path.write_text(text, encoding='utf-8')
