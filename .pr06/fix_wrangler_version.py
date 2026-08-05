from pathlib import Path

path = Path('.pr06/apply_pr06.py')
text = path.read_text(encoding='utf-8')
marker = "worker.write_text(text, encoding='utf-8')\n\n"
addition = '''wrangler = Path("wrangler.toml")
wrangler_text = wrangler.read_text(encoding="utf-8")
wrangler_text = wrangler_text.replace('RELEASE_VERSION = "4.05.1"', 'RELEASE_VERSION = "4.06"')
wrangler_text = wrangler_text.replace('API_VERSION = "2.58"', 'API_VERSION = "2.59"')
wrangler.write_text(wrangler_text, encoding="utf-8")

'''
if marker not in text:
    raise SystemExit('worker write marker not found')
text = text.replace(marker, marker + addition, 1)
path.write_text(text, encoding='utf-8')
