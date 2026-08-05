from pathlib import Path

path = Path("tests/worker_deployment.test.mjs")
text = path.read_text()
text = text.replace('assert.equal(version.release_version, "4.05");', 'assert.equal(version.release_version, "4.05.1");')
text = text.replace('assert.equal(version.api_version, "2.57");', 'assert.equal(version.api_version, "2.58");')
text = text.replace('assert.equal(metadata.release_version, "4.05");', 'assert.equal(metadata.release_version, "4.05.1");')
text = text.replace('assert.equal(metadata.api_version, "2.57");', 'assert.equal(metadata.api_version, "2.58");')
path.write_text(text)
