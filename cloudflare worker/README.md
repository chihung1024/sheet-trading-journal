# Legacy Worker archive policy

The repository directory `cloudflare worker/` contains historical Worker
snapshots (`worker_v2.36.js` through `worker_v2.39.js`). They are retained for
forensic comparison only.

`worker.js` at repository root is the single canonical production source.
Wrangler configuration, tests, CI, and deployment workflows must reference only
`worker.js`. Do not copy an archived file into Cloudflare Quick Edit.
