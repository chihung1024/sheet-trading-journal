from pathlib import Path

path = Path('.pr06/apply_pr06.py')
text = path.read_text(encoding='utf-8')
marker = "worker.write_text(text, encoding='utf-8')\n\n"
addition = '''deployment_test = Path("tests/worker_deployment.test.mjs")
dt = deployment_test.read_text(encoding="utf-8")
dt = dt.replace('tag: "release-4.05.1"', 'tag: "release-4.06"')
dt = dt.replace('assert.equal(body.release_version, "4.05.1");', 'assert.equal(body.release_version, "4.06");')
dt = dt.replace('assert.equal(body.api_version, "2.58");', 'assert.equal(body.api_version, "2.59");')
dt = dt.replace('assert.equal(response.headers.get("X-Release-Version"), "4.05.1");', 'assert.equal(response.headers.get("X-Release-Version"), "4.06");')
dt = dt.replace('assert.equal(response.headers.get("X-API-Version"), "2.58");', 'assert.equal(response.headers.get("X-API-Version"), "2.59");')
dt = dt.replace('assert.equal(metadata.release_version, "4.05.1");', 'assert.equal(metadata.release_version, "4.06");')
dt = dt.replace('assert.equal(metadata.api_version, "2.58");', 'assert.equal(metadata.api_version, "2.59");')
deployment_test.write_text(dt, encoding="utf-8")

security_test = Path("tests/worker_security.test.mjs")
st = security_test.read_text(encoding="utf-8")
st = st.replace('assert.deepEqual(DB.calls[0].binds, ["target@example.com"]);', 'assert.deepEqual(DB.calls[0].binds, ["target@example.com", 251]);')
st = st.replace('assert.deepEqual(DB.calls[0].binds, []);', 'assert.deepEqual(DB.calls[0].binds, [251]);')
security_test.write_text(st, encoding="utf-8")

'''
if marker not in text:
    raise SystemExit('worker write marker not found')
text = text.replace(marker, marker + addition)
path.write_text(text, encoding='utf-8')
