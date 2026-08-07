import { chmod, writeFile } from 'node:fs/promises';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function decodeJwtPayload(jwt) {
  const parts = String(jwt || '').split('.');
  if (parts.length !== 3) throw new Error('Google id_token is not a JWT');
  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8'));
  } catch {
    throw new Error('Unable to decode Google id_token payload');
  }
}

function audienceMatches(aud, expected) {
  if (Array.isArray(aud)) return aud.includes(expected);
  return aud === expected;
}

async function main() {
  const clientId = required('STAGING_GOOGLE_CLIENT_ID');
  const clientSecret = required('STAGING_E2E_GOOGLE_CLIENT_SECRET');
  const refreshToken = required('STAGING_E2E_GOOGLE_REFRESH_TOKEN');
  const expectedSub = required('STAGING_E2E_EXPECTED_GOOGLE_SUB');
  const tokenFile = required('STAGING_E2E_ID_TOKEN_FILE');
  const expectedEmail = String(process.env.STAGING_E2E_EXPECTED_GOOGLE_EMAIL || '').trim().toLowerCase();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
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
    throw new Error(
      'Google refresh response did not include id_token; bootstrap the refresh token with openid email profile scopes',
    );
  }

  const payload = decodeJwtPayload(idToken);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!GOOGLE_ISSUERS.has(payload.iss)) throw new Error('Refreshed ID token issuer is not Google');
  if (!audienceMatches(payload.aud, clientId)) throw new Error('Refreshed ID token audience is not the staging Google client');
  if (String(payload.sub || '') !== expectedSub) throw new Error('Refreshed ID token subject is not the synthetic staging test account');
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds + 120) throw new Error('Refreshed ID token is expired or too close to expiry');
  if (expectedEmail && String(payload.email || '').toLowerCase() !== expectedEmail) {
    throw new Error('Refreshed ID token email does not match the expected staging test account');
  }

  await writeFile(tokenFile, `${idToken}\n`, { encoding: 'utf8', mode: 0o600 });
  await chmod(tokenFile, 0o600);

  console.log(`Fresh staging Google ID token validated; expires in ${payload.exp - nowSeconds}s`);
}

main().catch((error) => {
  console.error(`Staging E2E token mint failed: ${error.message}`);
  process.exitCode = 1;
});
