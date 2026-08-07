import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DEPLOYMENT_CONTRACT,
  validateFrontendEnvironment,
} from './frontend_environment_policy.mjs';

export const CSP_API_ORIGIN_TOKEN = '__TRADING_JOURNAL_API_ORIGIN__';

function readValue(source, name) {
  return String(source?.[name] || '').trim();
}

function normalizeHttpOrigin(rawValue, label) {
  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error(`${label} must be a valid absolute URL`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS`);
  }
  return parsed.origin;
}

export function resolveFrontendCspApiOrigin(source = process.env) {
  const environment = validateFrontendEnvironment(source);
  const explicitApiUrl = readValue(source, 'VITE_API_URL');

  if (environment.context === 'pages-staging' || environment.context === 'staging') {
    return DEPLOYMENT_CONTRACT.staging.api_origin;
  }

  const productionFallback = DEPLOYMENT_CONTRACT.production.api_origins[0];
  return normalizeHttpOrigin(
    explicitApiUrl || productionFallback,
    'frontend CSP API origin',
  );
}

export function renderFrontendCspTemplate(template, apiOrigin, label = 'CSP template') {
  if (typeof template !== 'string') {
    throw new TypeError(`${label} must be a string`);
  }

  const tokenCount = template.split(CSP_API_ORIGIN_TOKEN).length - 1;
  if (tokenCount !== 1) {
    throw new Error(
      `${label} must contain ${CSP_API_ORIGIN_TOKEN} exactly once; found ${tokenCount}`,
    );
  }

  const normalizedOrigin = normalizeHttpOrigin(apiOrigin, `${label} API origin`);
  const rendered = template.replace(CSP_API_ORIGIN_TOKEN, normalizedOrigin);
  if (rendered.includes(CSP_API_ORIGIN_TOKEN)) {
    throw new Error(`${label} still contains the CSP API origin token after rendering`);
  }
  return rendered;
}

export function createFrontendCspPlugin({ source = process.env } = {}) {
  const apiOrigin = resolveFrontendCspApiOrigin(source);
  let isBuild = false;
  let outputDirectory = null;

  return {
    name: 'trading-journal-environment-csp',
    enforce: 'pre',

    configResolved(config) {
      isBuild = config.command === 'build';
      outputDirectory = path.resolve(config.root, config.build.outDir);
    },

    transformIndexHtml(html) {
      return renderFrontendCspTemplate(html, apiOrigin, 'index.html');
    },

    async closeBundle() {
      if (!isBuild) return;
      if (!outputDirectory) {
        throw new Error('Frontend CSP plugin did not receive the Vite build output directory');
      }

      const headersPath = path.join(outputDirectory, '_headers');
      let headers;
      try {
        headers = await readFile(headersPath, 'utf8');
      } catch (error) {
        throw new Error(`Unable to read generated Cloudflare Pages _headers: ${error.message}`);
      }

      const renderedHeaders = renderFrontendCspTemplate(
        headers,
        apiOrigin,
        'generated _headers',
      );
      await writeFile(headersPath, renderedHeaders, 'utf8');
    },
  };
}
