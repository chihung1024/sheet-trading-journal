const MAX_PROFILE_NAME_LENGTH = 64;
const PROFILE_SCOPE_PREFIX = 'PROFILE_';
const PROFILE_SCOPE_HEX_LENGTH = 32;
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;
const PROFILE_SCOPE_RE = /^PROFILE_[A-F0-9]{32}$/;

export function normalizeIbkrImportProfileName(value) {
  const displayName = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');

  if (!displayName) return '';
  if (CONTROL_CHAR_RE.test(displayName)) {
    throw new Error('匯入設定檔名稱不可包含控制字元');
  }
  if ([...displayName].length > MAX_PROFILE_NAME_LENGTH) {
    throw new Error(`匯入設定檔名稱最多 ${MAX_PROFILE_NAME_LENGTH} 個字元`);
  }
  return displayName;
}

const canonicalProfileName = value => normalizeIbkrImportProfileName(value).toLocaleLowerCase('en-US');

export async function deriveIbkrImportProfile(value) {
  const displayName = normalizeIbkrImportProfileName(value);
  if (!displayName) {
    return Object.freeze({ displayName: '', scopeId: '' });
  }
  if (!globalThis.crypto?.subtle?.digest) {
    throw new Error('瀏覽器缺少安全雜湊能力，無法建立匯入設定檔');
  }

  const canonical = canonicalProfileName(displayName);
  const payload = new TextEncoder().encode(`IBKR_IMPORT_PROFILE_V1\0${canonical}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', payload);
  const fullHex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  const scopeId = `${PROFILE_SCOPE_PREFIX}${fullHex.slice(0, PROFILE_SCOPE_HEX_LENGTH)}`;
  if (!PROFILE_SCOPE_RE.test(scopeId)) {
    throw new Error('匯入設定檔識別碼建立失敗');
  }

  return Object.freeze({ displayName, scopeId });
}

export const isIbkrImportProfileScope = value => PROFILE_SCOPE_RE.test(String(value ?? '').trim().toUpperCase());

export const __test = Object.freeze({
  MAX_PROFILE_NAME_LENGTH,
  PROFILE_SCOPE_PREFIX,
  PROFILE_SCOPE_HEX_LENGTH,
  PROFILE_SCOPE_RE,
  canonicalProfileName,
});