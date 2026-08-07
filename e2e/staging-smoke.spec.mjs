import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const contract = JSON.parse(
  readFileSync(new URL('../config/deployment-environments.json', import.meta.url), 'utf8'),
);

const stagingFrontend = String(process.env.STAGING_E2E_BASE_URL || '').trim();
const stagingApi = String(process.env.STAGING_E2E_API_ORIGIN || '').trim();
const tokenFile = String(process.env.STAGING_E2E_ID_TOKEN_FILE || '').trim();

if (stagingFrontend !== contract.staging.frontend_origin) {
  throw new Error('STAGING_E2E_BASE_URL does not match the fixed staging frontend');
}
if (stagingApi !== contract.staging.api_origin) {
  throw new Error('STAGING_E2E_API_ORIGIN does not match the fixed staging API');
}
if (!tokenFile) throw new Error('STAGING_E2E_ID_TOKEN_FILE is required');

const googleIdToken = readFileSync(tokenFile, 'utf8').trim();
if (!googleIdToken) throw new Error('staging Google ID token file is empty');

const forbiddenProductionOrigins = new Set([
  ...contract.production.frontend_origins,
  ...contract.production.api_origins,
]);

function parseJsonOrThrow(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON: ${text.slice(0, 200)}`);
  }
}

async function browserApi(page, method, endpoint, body = undefined) {
  return page.evaluate(async ({ apiOrigin, methodName, endpointPath, requestBody }) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('browser auth token missing');

    const response = await fetch(`${apiOrigin}${endpointPath}`, {
      method: methodName,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    });
    const text = await response.text();
    return { status: response.status, ok: response.ok, text };
  }, {
    apiOrigin: stagingApi,
    methodName: method,
    endpointPath: endpoint,
    requestBody: body,
  });
}

async function getRecords(page) {
  const response = await browserApi(page, 'GET', '/api/records?limit=1000');
  expect(response.ok, `GET records failed HTTP ${response.status}`).toBe(true);
  const payload = parseJsonOrThrow(response.text, 'GET /api/records');
  expect(payload.success).toBe(true);
  expect(Array.isArray(payload.data)).toBe(true);
  return payload.data;
}

async function fallbackCleanup(request, recordId) {
  const response = await request.delete(`${stagingApi}/api/records`, {
    headers: {
      Authorization: `Bearer ${googleIdToken}`,
      'Content-Type': 'application/json',
    },
    data: { id: recordId },
  });
  if (!response.ok()) {
    throw new Error(`fallback DELETE failed HTTP ${response.status()}`);
  }
  const payload = parseJsonOrThrow(await response.text(), 'fallback DELETE /api/records');
  if (payload.success !== true) throw new Error('fallback DELETE was not successful');
}

test('fixed staging login, browser-origin CRUD, cleanup, and logout', async ({ page, context, request }) => {
  const productionRequests = [];
  let createdRecordId = null;
  const marker = `E2E_${process.env.GITHUB_RUN_ID || Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  await context.route('**/*', async (route) => {
    const url = route.request().url();
    let origin = '';
    try { origin = new URL(url).origin; } catch { /* non-URL request */ }

    if (forbiddenProductionOrigins.has(origin)) {
      productionRequests.push({ method: route.request().method(), url });
      await route.abort('blockedbyclient');
      return;
    }

    if (url.startsWith('https://accounts.google.com/gsi/client')) {
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
      return;
    }

    await route.continue();
  });

  await page.addInitScript((credential) => {
    Object.defineProperty(window, 'google', {
      configurable: true,
      value: {
        accounts: {
          id: {
            initialize(options) {
              window.__stagingE2eGoogleCredentialCallback = options.callback;
            },
            renderButton(container) {
              const button = document.createElement('button');
              button.type = 'button';
              button.dataset.e2eGoogleSignin = 'true';
              button.textContent = 'Staging E2E Google Sign-In';
              button.addEventListener('click', () => {
                window.__stagingE2eGoogleCredentialCallback?.({ credential });
              });
              container.replaceChildren(button);
            },
          },
        },
      },
    });
  }, googleIdToken);

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-e2e-google-signin="true"]')).toBeVisible();
    await page.locator('[data-e2e-google-signin="true"]').click();

    await expect(page.locator('.login-overlay')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('token')))).toBe(true);

    const initialRecords = await getRecords(page);
    expect(initialRecords.filter((record) => record.tag === marker)).toHaveLength(0);

    const syntheticRecord = {
      txn_date: '2024-01-02',
      symbol: 'AAPL',
      txn_type: 'BUY',
      qty: 0.0001,
      price: 1,
      fee: 0,
      tax: 0,
      total_amount: 0.0001,
      tag: marker,
    };

    const createResponse = await browserApi(page, 'POST', '/api/records', syntheticRecord);
    expect(createResponse.ok, `POST record failed HTTP ${createResponse.status}`).toBe(true);
    const createPayload = parseJsonOrThrow(createResponse.text, 'POST /api/records');
    expect(createPayload.success).toBe(true);

    const afterCreate = await getRecords(page);
    const createdMatches = afterCreate.filter((record) => record.tag === marker);
    expect(createdMatches).toHaveLength(1);
    createdRecordId = Number(createdMatches[0].id);
    expect(Number.isSafeInteger(createdRecordId) && createdRecordId > 0).toBe(true);

    const updatedRecord = {
      ...syntheticRecord,
      id: createdRecordId,
      price: 2,
      total_amount: 0.0002,
    };
    const updateResponse = await browserApi(page, 'PUT', '/api/records', updatedRecord);
    expect(updateResponse.ok, `PUT record failed HTTP ${updateResponse.status}`).toBe(true);
    const updatePayload = parseJsonOrThrow(updateResponse.text, 'PUT /api/records');
    expect(updatePayload.success).toBe(true);

    const afterUpdate = await getRecords(page);
    const updatedMatches = afterUpdate.filter((record) => Number(record.id) === createdRecordId);
    expect(updatedMatches).toHaveLength(1);
    expect(Number(updatedMatches[0].price)).toBe(2);

    const deleteResponse = await browserApi(page, 'DELETE', '/api/records', { id: createdRecordId });
    expect(deleteResponse.ok, `DELETE record failed HTTP ${deleteResponse.status}`).toBe(true);
    const deletePayload = parseJsonOrThrow(deleteResponse.text, 'DELETE /api/records');
    expect(deletePayload.success).toBe(true);
    createdRecordId = null;

    const afterDelete = await getRecords(page);
    expect(afterDelete.filter((record) => record.tag === marker)).toHaveLength(0);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /登出/ }).click();
    await expect(page.locator('.login-overlay')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).toBe(null);

    for (const productionApi of contract.production.api_origins) {
      const response = await request.get(`${productionApi}/api/version`);
      expect(response.status()).toBeLessThan(500);
    }

    expect(productionRequests, 'browser must never contact a production origin').toEqual([]);
  } finally {
    if (createdRecordId) {
      let browserCleanupSucceeded = false;
      try {
        const cleanupResponse = await browserApi(page, 'DELETE', '/api/records', { id: createdRecordId });
        if (cleanupResponse.ok) {
          const cleanupPayload = parseJsonOrThrow(cleanupResponse.text, 'cleanup DELETE /api/records');
          browserCleanupSucceeded = cleanupPayload.success === true;
        }
      } catch (error) {
        console.error(`Browser cleanup failed for synthetic record ${createdRecordId}: ${error.message}`);
      }

      if (!browserCleanupSucceeded) {
        try {
          await fallbackCleanup(request, createdRecordId);
        } catch (error) {
          console.error(`Fallback cleanup failed for synthetic record ${createdRecordId}: ${error.message}`);
        }
      }
    }
  }
});
