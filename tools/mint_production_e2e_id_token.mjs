import { chmod, readFile, writeFile } from 'node:fs/promises';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function decodeJwtPayload(jwt) {
  const parts = String(jwt || '').split('.');
  if (parts.length !== 3) throw new Error('Google ID token is not a JWT');
  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8'));
  } catch {
    throw new Error('Unable to decode Google ID token payload');
  }
}

function audienceMatches(aud, expected) {
  return Array.isArray(aud) ? aud.includes(expected) : aud === expected;
}

async function productionClientIds() {
  const raw = await readFile(new URL('../config/deployment-environments.json', import.meta.url), 'utf8');
  const contract = JSON.parse(raw);
  const clientIds = contract?.production?.google_client_ids;
  if (!Array.isArray(clientIds) || clientIds.length === 0 || !clientIds.every((id) => typeof id === 'string')) {
    throw new Error('Production Google client contract is incomplete');
  }
  return new Set(clientIds);
}

export async function mintProductionE2eIdToken({
  clientId,
  clientSecret,
  refreshToken,
  expectedSub,
  expectedEmail = '',
  tokenFile,
  fetchImpl = fetch,
  nowSeconds = () => Math.floor(Date.now() / 1000),
}) {
  const normalizedClientId = String(clientId || '').trim();
  const normalizedClientSecret = String(clientSecret || '').trim();
  const normalizedRefreshToken = String(refreshToken || '').trim();
  const normalizedExpectedSub = String(expectedSub || '').trim();
  const normalizedTokenFile = String(tokenFile || '').trim();
  if (!normalizedClientId || !normalizedClientSecret || !normalizedRefreshToken || !normalizedExpectedSub || !normalizedTokenFile) {
    throw new Error('Production E2E token mint inputs are incomplete');
  }
  const productionClients = await productionClientIds();
  if (!productionClients.has(normalizedClientId)) {
    throw new Error('Production E2E Google client is not an allowed production OAuth client');
  }

  const body = new URLSearchParams({
    client_id: normalizedClientId,
    client_secret: normalizedClientSecret,
    refresh_token: normalizedRefreshToken,
    grant_type: 'refresh_token',
  });
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  let tokenResponse;
  try {
    tokenResponse = await response.json();
  } catch {
    throw new Error(`Google token endpoint returned non-JSON HTTP ${response.status}`);
  }
  if (!response.ok) {
    const code = String(tokenResponse?.error || 'unknown_error');
    throw new Error(`Google refresh grant failed with HTTP ${response.status}: ${code}`);
  }

  const idToken = String(tokenResponse?.id_token || '').trim();
  if (!idToken) {
    throw new Error('Google refresh response did not include id_token; the credential needs openid email profile scopes');
  }

  const payload = decodeJwtPayload(idToken);
  const now = nowSeconds();
  if (!GOOGLE_ISSUERS.has(payload.iss)) throw new Error('Refreshed ID token issuer is not Google');
  if (!audienceMatches(payload.aud, normalizedClientId)) throw new Error('Refreshed ID token audience is not the production Google client');
  if (String(payload.sub || '') !== normalizedExpectedSub) throw new Error('Refreshed ID token subject is not the dedicated production test account');
  if (!Number.isFinite(payload.exp) || payload.exp <= now + 120) {
    throw new Error('Refreshed ID token is expired or too close to expiry');
  }
  if (expectedEmail && String(payload.email || '').toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error('Refreshed ID token email does not match the dedicated production test account');
  }

  await writeFile(normalizedTokenFile, `${idToken}\n`, { encoding: 'utf8', mode: 0o600 });
  await chmod(normalizedTokenFile, 0o600);
  return { expiresInSeconds: payload.exp - now };
}

async function main() {
  const result = await mintProductionE2eIdToken({
    clientId: required('PRODUCTION_E2E_GOOGLE_CLIENT_ID'),
    clientSecret: required('PRODUCTION_E2E_GOOGLE_CLIENT_SECRET'),
    refreshToken: required('PRODUCTION_E2E_GOOGLE_REFRESH_TOKEN'),
    expectedSub: required('PRODUCTION_E2E_EXPECTED_GOOGLE_SUB'),
    expectedEmail: String(process.env.PRODUCTION_E2E_EXPECTED_GOOGLE_EMAIL || '').trim(),
    tokenFile: required('PRODUCTION_E2E_ID_TOKEN_FILE'),
  });
  console.log(`Fresh production Google ID token validated; expires in ${result.expiresInSeconds}s`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Production E2E token mint failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  });
}
