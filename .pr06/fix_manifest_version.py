from pathlib import Path

path = Path('.pr06/apply_pr06.py')
text = path.read_text(encoding='utf-8')
marker = "worker.write_text(text, encoding='utf-8')\n\n"
addition = '''manifest = Path("worker-manifest.json")
manifest_text = manifest.read_text(encoding="utf-8")
manifest_text = manifest_text.replace('"releaseVersion": "4.05.1"', '"releaseVersion": "4.06"')
manifest_text = manifest_text.replace('"apiVersion": "2.58"', '"apiVersion": "2.59"')
manifest.write_text(manifest_text, encoding="utf-8")

'''
if marker not in text:
    raise SystemExit('worker write marker not found')
text = text.replace(marker, marker + addition, 1)
path.write_text(text, encoding='utf-8')
