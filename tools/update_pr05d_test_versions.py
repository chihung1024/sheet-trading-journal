from pathlib import Path

path = Path("tests/worker_deployment.test.mjs")
text = path.read_text()
text = text.replace('release-4.05', 'release-4.05.1')
text = text.replace('"4.05"', '"4.05.1"')
text = text.replace('"2.57"', '"2.58"')
path.write_text(text)
