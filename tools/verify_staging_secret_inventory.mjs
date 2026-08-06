const raw = String(process.env.STAGING_SECRET_LIST_JSON || '').trim();
if (!raw) throw new Error('STAGING_SECRET_LIST_JSON is required');

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  throw new Error(`STAGING_SECRET_LIST_JSON is invalid JSON: ${error.message}`);
}
if (!Array.isArray(parsed)) {
  throw new Error('Staging secret inventory must be an array');
}

const names = new Set(
  parsed
    .map((item) => String(item?.name || '').trim())
    .filter(Boolean),
);
if (!names.has('API_SECRET')) {
  throw new Error('Staging Worker API_SECRET is missing');
}
if (names.has('GITHUB_TOKEN')) {
  throw new Error('Staging Worker must not contain GITHUB_TOKEN');
}

console.log('Staging Worker secret inventory is isolated: API_SECRET present, GITHUB_TOKEN absent.');
