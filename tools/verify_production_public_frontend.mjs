#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const SHA_RE = /^[0-9a-f]{40}$/i;

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function normalizeHeaderCsp(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractMetaCsp(html) {
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!/http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag)) continue;
    const match = tag.match(/content\s*=\s*(["'])([\s\S]*?)\1/i);
    if (match) return normalizeHeaderCsp(match[2]);
  }
  return "";
}

function extractSameOriginAssets(html, baseUrl) {
  const base = new URL(baseUrl);
  const candidates = new Set();
  for (const regex of [
    /<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi,
    /<link\b[^>]*\brel\s*=\s*(["'])(?:modulepreload|preload)\1[^>]*\bhref\s*=\s*(["'])(.*?)\2/gi,
    /<link\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*\brel\s*=\s*(["'])(?:modulepreload|preload)\3/gi,
  ]) {
    for (const match of String(html || "").matchAll(regex)) {
      const raw = match[2] || match[3];
      if (!raw) continue;
      let url;
      try {
        url = new URL(raw, base);
      } catch {
        continue;
      }
      if (url.origin !== base.origin) continue;
      if (!/\.(?:m?js)(?:$|\?)/i.test(url.pathname + url.search)) continue;
      candidates.add(url.href);
    }
  }
  return [...candidates].sort();
}

function requireCsp({ csp, productionApiOrigin, stagingApiOrigin, label, errors }) {
  if (!csp) {
    errors.push(`${label} CSP is missing`);
    return;
  }
  if (!csp.includes(productionApiOrigin)) {
    errors.push(`${label} CSP does not authorize production API origin`);
  }
  if (csp.includes(stagingApiOrigin)) {
    errors.push(`${label} CSP authorizes staging API origin`);
  }
  if (!/connect-src\b/i.test(csp)) {
    errors.push(`${label} CSP has no connect-src directive`);
  }
}

export function validateProductionPublicSnapshot({
  pageUrl,
  html,
  headers = {},
  assets = [],
  workerVersion,
  workerHealth,
  contract,
}) {
  const errors = [];
  const production = contract?.production;
  const staging = contract?.staging;
  const productionApiOrigin = String(production?.api_origins?.[0] || "").trim();
  const stagingApiOrigin = String(staging?.api_origin || "").trim();
  const productionGoogleClientId = String(production?.google_client_ids?.[0] || "").trim();
  const expectedFrontendOrigins = production?.frontend_origins;
  const pageOrigin = new URL(pageUrl).origin;

  if (!Array.isArray(expectedFrontendOrigins) || !expectedFrontendOrigins.includes(pageOrigin)) {
    errors.push(`served page origin is not a reviewed production frontend origin: ${pageOrigin}`);
  }
  if (!productionApiOrigin || !stagingApiOrigin || !productionGoogleClientId) {
    errors.push("deployment environment contract is incomplete");
  }

  const headerCsp = normalizeHeaderCsp(headers["content-security-policy"]);
  const metaCsp = extractMetaCsp(html);
  requireCsp({ csp: headerCsp, productionApiOrigin, stagingApiOrigin, label: "header", errors });
  requireCsp({ csp: metaCsp, productionApiOrigin, stagingApiOrigin, label: "meta", errors });

  const combinedJs = assets.map((asset) => asset.body).join("\n");
  if (assets.length === 0) errors.push("no same-origin JavaScript assets were captured");
  if (!combinedJs.includes(productionApiOrigin)) {
    errors.push("served JavaScript does not contain the production API origin");
  }
  if (!combinedJs.includes(productionGoogleClientId)) {
    errors.push("served JavaScript does not contain the reviewed production Google client ID");
  }
  if (combinedJs.includes(stagingApiOrigin)) {
    errors.push("served JavaScript contains the staging API origin");
  }
  if (String(html).includes("__TRADING_JOURNAL_API_ORIGIN__") || combinedJs.includes("__TRADING_JOURNAL_API_ORIGIN__")) {
    errors.push("unrendered frontend API-origin token is present in served production content");
  }

  const observedSource = String(workerVersion?.source_commit || "").trim().toLowerCase();
  if (workerVersion?.success !== true || workerVersion?.status !== "ok") {
    errors.push("production Worker version endpoint is not healthy");
  }
  if (!SHA_RE.test(observedSource)) errors.push("production Worker source_commit is not an exact 40-character SHA");
  if (workerVersion?.service !== "trading-journal-api") errors.push("production Worker runtime service mismatch");
  if (workerVersion?.release_version !== "4.07") errors.push("production Worker release is not 4.07");
  if (workerVersion?.api_version !== "2.60") errors.push("production Worker API is not 2.60");
  if (Number(workerVersion?.schema_version) !== 2) errors.push("production Worker declared schema is not 2");
  if (!workerVersion?.worker_version?.id) errors.push("production Worker version ID is missing");

  if (workerHealth?.success !== true || workerHealth?.status !== "ok") {
    errors.push("production Worker health endpoint is not healthy");
  }
  if (String(workerHealth?.source_commit || "").toLowerCase() !== observedSource) {
    errors.push("production Worker health source_commit differs from version endpoint");
  }
  if (workerHealth?.checks?.database !== "ok" || workerHealth?.checks?.schema !== "ok") {
    errors.push("production Worker health database/schema checks are not ok");
  }
  if (Number(workerHealth?.observed_schema_version) !== 2) {
    errors.push("production Worker observed D1 schema is not exactly 2");
  }

  const evidence = {
    schema_version: 1,
    check_name: "production_frontend_live_contract",
    status: errors.length === 0 ? "passed" : "failed",
    observed_at: new Date().toISOString(),
    public_only: true,
    page: {
      origin: pageOrigin,
      html_sha256: sha256(html),
      header_csp_sha256: headerCsp ? sha256(headerCsp) : null,
      meta_csp_sha256: metaCsp ? sha256(metaCsp) : null,
      header_csp_authorizes_production_api: headerCsp.includes(productionApiOrigin),
      meta_csp_authorizes_production_api: metaCsp.includes(productionApiOrigin),
      header_csp_rejects_staging_api: !headerCsp.includes(stagingApiOrigin),
      meta_csp_rejects_staging_api: !metaCsp.includes(stagingApiOrigin),
      asset_count: assets.length,
      assets: assets.map((asset) => ({
        url: asset.url,
        sha256: sha256(asset.body),
        bytes: Buffer.byteLength(asset.body),
      })),
      bundle_contains_production_api: combinedJs.includes(productionApiOrigin),
      bundle_contains_production_google_client: combinedJs.includes(productionGoogleClientId),
      bundle_rejects_staging_api: !combinedJs.includes(stagingApiOrigin),
    },
    worker: {
      source_commit: observedSource || null,
      service: workerVersion?.service || null,
      release_version: workerVersion?.release_version || null,
      api_version: workerVersion?.api_version || null,
      schema_version: Number(workerVersion?.schema_version),
      observed_schema_version: Number(workerHealth?.observed_schema_version),
      worker_version_id: workerVersion?.worker_version?.id || null,
      health_status: workerHealth?.status || null,
    },
    proof: {
      result: errors.length === 0 ? "pass" : "fail",
      summary: errors.length === 0
        ? "Public production Pages CSP/bundle identity and Worker version/health contract passed."
        : "Public production served-truth verification failed.",
    },
    errors,
  };

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), evidence });
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: "error", cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return { response, body: await response.text() };
}

async function fetchJson(url) {
  const response = await fetch(url, { redirect: "error", cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

export async function runProductionPublicProbe({
  pageUrl = "https://sheet-trading-journal.pages.dev/",
  workerBaseUrl = "https://journal-backend.chired.workers.dev",
  contractPath = "config/deployment-environments.json",
} = {}) {
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const { response: pageResponse, body: html } = await fetchText(pageUrl);
  const headers = Object.fromEntries([...pageResponse.headers.entries()].map(([key, value]) => [key.toLowerCase(), value]));
  const assetUrls = extractSameOriginAssets(html, pageUrl);
  const assets = [];
  for (const url of assetUrls) {
    const { body } = await fetchText(url);
    assets.push({ url, body });
  }
  const [workerVersion, workerHealth] = await Promise.all([
    fetchJson(`${workerBaseUrl}/api/version`),
    fetchJson(`${workerBaseUrl}/api/health`),
  ]);
  return validateProductionPublicSnapshot({
    pageUrl,
    html,
    headers,
    assets,
    workerVersion,
    workerHealth,
    contract,
  });
}

async function main() {
  const output = String(process.env.AUDIT_OUTPUT || "production-public-evidence.json").trim();
  const result = await runProductionPublicProbe();
  await writeFile(output, `${JSON.stringify(result.evidence, null, 2)}\n`, { mode: 0o600 });
  if (!result.ok) {
    throw new Error(result.errors.map((error) => `- ${error}`).join("\n"));
  }
  console.log(`Production public served-truth PASS: Worker source=${result.evidence.worker.source_commit}; assets=${result.evidence.page.asset_count}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`Production public served-truth failed:\n${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
}
