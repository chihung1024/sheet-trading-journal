import { detectNativeCurrency } from './instrumentCurrency.js';
import { isIbkrImportProfileScope } from './ibkrImportProfile.js';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 10000;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._~-]{16,128}$/;
const RECORD_CURRENCY_RE = /^[A-Z]{3}$/;
const EXECUTION_SEQUENCE_RE = /^[A-Za-z0-9._:/-]{1,128}$/;
const OFFSET_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

const ALIASES = Object.freeze({
  assetClass: ['assetclass', 'assetcategory', 'securitytype'],
  symbol: ['symbol', 'underlyingsymbol'],
  side: ['buysell', 'side', 'action'],
  quantity: ['quantity', 'qty', 'shares'],
  price: ['tradeprice', 'tprice', 'price', 'fillprice'],
  commission: ['ibcommission', 'commission', 'commfee', 'fee'],
  taxes: ['taxes', 'tax', 'transactiontax'],
  currency: ['currencyprimary', 'currency', 'currencycode'],
  tradeDate: ['tradedate', 'date'],
  dateTime: ['datetime', 'dateandtime', 'tradetime', 'executedatetime'],
  orderId: ['iborderid', 'orderid'],
  tradeId: ['tradeid', 'executionid', 'execid'],
  accountId: ['accountid', 'clientaccountid', 'account', 'accountnumber', 'accountcode'],
  level: ['levelofdetail', 'detaillevel'],
  discriminator: ['datadiscriminator', 'discriminator'],
});

const text = value => String(value ?? '').trim();
const headerKey = value => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');

function csvRows(source) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(source ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (quoted) throw new Error('unterminated csv quote');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(columns => columns.some(value => text(value)));
}

function findColumn(headers, names) {
  const keys = headers.map(headerKey);
  for (const name of names) {
    const index = keys.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

function columnsFor(headers) {
  return Object.fromEntries(Object.entries(ALIASES).map(([key, names]) => [key, findColumn(headers, names)]));
}

function statementAccounts(rows) {
  return [...new Set(rows
    .filter(candidate => (
      text(candidate[0]).toLowerCase() === 'statement'
      && text(candidate[1]).toLowerCase() === 'data'
      && headerKey(candidate[2]) === 'account'
      && text(candidate[3])
    ))
    .map(candidate => text(candidate[3]).toUpperCase()))];
}

function statementAccount(rows) {
  const uniqueAccounts = statementAccounts(rows);
  return uniqueAccounts.length === 1 ? uniqueAccounts[0] : '';
}

function extractTradeTable(rows) {
  const statementAccountIds = statementAccounts(rows);
  const fallbackAccountId = statementAccountIds.length === 1 ? statementAccountIds[0] : '';
  const section = rows.findIndex(row => text(row[0]).toLowerCase() === 'trades' && text(row[1]).toLowerCase() === 'header');
  if (section >= 0) {
    return {
      format: 'ibkr-sectioned',
      fallbackAccountId,
      statementAccountIds,
      headers: rows[section].slice(2),
      data: rows.slice(section + 1)
        .map((row, index) => ({ rowNumber: section + index + 2, row }))
        .filter(item => text(item.row[0]).toLowerCase() === 'trades' && text(item.row[1]).toLowerCase() === 'data')
        .map(item => ({ rowNumber: item.rowNumber, values: item.row.slice(2) })),
    };
  }
  return {
    format: 'direct-csv',
    fallbackAccountId: '',
    statementAccountIds: [],
    headers: rows[0] || [],
    data: rows.slice(1).map((values, index) => ({ rowNumber: index + 2, values })),
  };
}

function actualAccountIds(table, columns) {
  const accounts = new Set(table.statementAccountIds || []);
  if (columns.accountId >= 0) {
    for (const item of table.data) {
      const value = text(item.values[columns.accountId]).toUpperCase();
      if (value) accounts.add(value);
    }
  }
  return [...accounts];
}

function finiteNumber(value) {
  const normalized = text(value).replace(/^\((.*)\)$/, '-$1').replace(/[$€£¥₩,]/g, '');
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function dateOnly(value) {
  const raw = text(value);
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = raw.match(/^(\d{4})(\d{2})(\d{2})(?:\b|;|T|\s)/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  return null;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateOffsetAwareDateTime(value) {
  const candidate = text(value);
  const match = candidate.match(OFFSET_DATETIME_RE);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offset] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const maxDay = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > maxDay || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  if (offset !== 'Z') {
    const offsetHour = Number(offset.slice(1, 3));
    const offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
  }
  return candidate;
}

function normalizeAuthoritativeExecutedAt(value) {
  const raw = text(value);
  if (!raw) return null;
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2});(\d{2})(\d{2})(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/);
  const candidate = compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}${compact[7] || ''}${compact[8]}`
    : raw;
  return validateOffsetAwareDateTime(candidate);
}

function sideOf(value) {
  const side = text(value).toUpperCase();
  if (side === 'BUY' || side === 'BOT') return 'BUY';
  if (side === 'SELL' || side === 'SLD') return 'SELL';
  return null;
}

function warning(rowNumber, code, message) {
  return Object.freeze({ rowNumber, code, message });
}

function rowReader(item, columns) {
  return key => columns[key] >= 0 ? text(item.values[columns[key]]) : '';
}

function sourceIdentity(item, columns, fallbackAccountId = '', accountScope = '') {
  const read = rowReader(item, columns);
  const accountId = (read('accountId') || fallbackAccountId).toUpperCase();
  const scopeId = accountScope || accountId;
  const orderId = read('orderId');
  const tradeId = read('tradeId');
  const groupKey = scopeId && (orderId || tradeId)
    ? `${orderId ? 'ORDER' : 'TRADE'}:${scopeId}:${orderId || tradeId}`
    : null;
  return {
    accountId,
    scopeId,
    scopeMode: accountScope ? 'profile' : 'account',
    orderId,
    tradeId,
    groupKey,
  };
}

function groupLabel(groupKey) {
  const parts = text(groupKey).split(':');
  if (parts.length < 3) return 'IBKR order';
  return `${parts[0]}:${parts.slice(2).join(':')}`;
}

function stableTradeFingerprint(trade) {
  return JSON.stringify([
    trade.scopeId, trade.accountId, trade.assetClass, trade.symbol, trade.side, trade.quantity, trade.price,
    trade.fee, trade.tax, trade.currency, trade.tradeDate,
    trade.orderId, trade.tradeId, trade.dateTime,
  ]);
}

function parseTrade(item, columns, fallbackAccountId, accountScope) {
  const read = rowReader(item, columns);
  const source = sourceIdentity(item, columns, fallbackAccountId, accountScope);
  const level = read('level').toUpperCase();
  const discriminator = read('discriminator').toUpperCase();
  if (
    (level && level !== 'EXECUTION' && level !== 'EXEC')
    || (discriminator && discriminator !== 'EXECUTION' && discriminator !== 'EXEC')
  ) {
    return { skip: warning(item.rowNumber, 'NON_EXECUTION_ROW', '非成交明細列，已略過'), taintKey: null };
  }

  if (!source.scopeId) {
    return { skip: warning(item.rowNumber, 'MISSING_ACCOUNT_ID', '缺少 IBKR Account ID 或匯入設定檔，無法建立跨帳戶安全識別'), taintKey: null };
  }

  const assetClass = read('assetClass').toUpperCase().replace(/\s+/g, '');
  if (assetClass !== 'STK' && assetClass !== 'STOCK') {
    return { skip: warning(item.rowNumber, 'UNSUPPORTED_ASSET_CLASS', `目前只支援 STK，實際為 ${assetClass || '空白'}`), taintKey: source.groupKey };
  }

  const rawSymbol = read('symbol').toUpperCase();
  if (!rawSymbol || /\s/.test(rawSymbol) || !/^[A-Z0-9.^=\-]{1,24}$/.test(rawSymbol)) {
    return { skip: warning(item.rowNumber, 'INVALID_SYMBOL', 'Symbol 缺失或無法安全映射'), taintKey: source.groupKey };
  }

  const side = sideOf(read('side'));
  const quantityRaw = finiteNumber(read('quantity'));
  const price = finiteNumber(read('price'));
  if (!side) return { skip: warning(item.rowNumber, 'INVALID_SIDE', 'BuySell/Side 無法辨識'), taintKey: source.groupKey };
  if (quantityRaw === null || quantityRaw === 0 || price === null || price <= 0) {
    return { skip: warning(item.rowNumber, 'INVALID_QUANTITY_OR_PRICE', 'Quantity 必須非零且 TradePrice 必須大於 0'), taintKey: source.groupKey };
  }

  const commission = columns.commission >= 0 ? finiteNumber(read('commission')) : 0;
  const taxes = columns.taxes >= 0 ? finiteNumber(read('taxes')) : 0;
  if (commission === null || taxes === null) {
    return { skip: warning(item.rowNumber, 'INVALID_FEE_OR_TAX', 'Commission/Taxes 必須為有效數值'), taintKey: source.groupKey };
  }

  const currency = read('currency').toUpperCase();
  const expectedCurrency = detectNativeCurrency(rawSymbol);
  if (!currency) return { skip: warning(item.rowNumber, 'MISSING_CURRENCY', '缺少交易幣別'), taintKey: source.groupKey };
  if (currency !== expectedCurrency) {
    return { skip: warning(item.rowNumber, 'CURRENCY_SYMBOL_MISMATCH', `${rawSymbol} 目前系統辨識為 ${expectedCurrency}，IBKR 檔案為 ${currency}；不自動猜測市場 suffix`), taintKey: source.groupKey };
  }

  const tradeDate = dateOnly(read('tradeDate')) || dateOnly(read('dateTime'));
  if (!validDate(tradeDate)) {
    return { skip: warning(item.rowNumber, 'INVALID_TRADE_DATE', 'TradeDate/DateTime 無法辨識'), taintKey: source.groupKey };
  }
  if (!source.orderId && !source.tradeId) {
    return { skip: warning(item.rowNumber, 'MISSING_EXECUTION_ID', '缺少 Order ID 或 Trade ID'), taintKey: null };
  }

  return { trade: Object.freeze({
    rowNumber: item.rowNumber,
    accountId: source.accountId,
    scopeId: source.scopeId,
    scopeMode: source.scopeMode,
    assetClass: 'STK',
    symbol: rawSymbol,
    side,
    quantity: Math.abs(quantityRaw),
    price,
    fee: Math.abs(commission),
    tax: Math.abs(taxes),
    currency,
    tradeDate,
    orderId: source.orderId,
    tradeId: source.tradeId,
    dateTime: read('dateTime'),
    groupKey: source.groupKey,
  }) };
}

function keyPart(value) {
  return text(value).toUpperCase().replace(/[^A-Z0-9._~-]+/g, '_').replace(/^_+|_+$/g, '');
}

function idempotencyKeyFor(trade, tradeIds) {
  const kind = trade.orderId ? 'ORDER' : 'TRADE';
  const identity = trade.orderId || tradeIds[0];
  const key = [
    'IBKR', kind, trade.tradeDate.replace(/-/g, ''), keyPart(trade.scopeId),
    keyPart(identity), keyPart(trade.symbol), trade.side,
  ].join('~');
  return IDEMPOTENCY_KEY_RE.test(key) ? key : null;
}

function executionSequenceFor(trade) {
  const identity = text(trade.orderId || trade.tradeId);
  if (!identity) return null;
  const accountId = text(trade.accountId).toUpperCase();
  if (accountId && identity.toUpperCase().includes(accountId)) return null;
  const candidate = `IBKR-${trade.orderId ? 'ORDER' : 'TRADE'}:${identity}`;
  return EXECUTION_SEQUENCE_RE.test(candidate) ? candidate : null;
}

function metadataFor(trade, fills) {
  const metadata = { event_source: 'IBKR' };
  if (trade.currency === 'GBp' || RECORD_CURRENCY_RE.test(trade.currency)) {
    metadata.currency = trade.currency;
  }
  const sequence = executionSequenceFor(trade);
  if (sequence) metadata.execution_sequence = sequence;

  const executedAtValues = fills.map(fill => normalizeAuthoritativeExecutedAt(fill.dateTime));
  if (executedAtValues.length === fills.length && executedAtValues.every(Boolean)) {
    const unique = [...new Set(executedAtValues)];
    if (unique.length === 1) metadata.executed_at = unique[0];
  }
  return Object.freeze(metadata);
}

function noteFor(trade, fills, tradeIds) {
  const times = [...new Set(fills.map(fill => fill.dateTime).filter(Boolean))].sort();
  return [
    'source=IBKR', `currency=${trade.currency}`,
    'security_type=STK', 'aggregation=order', `trade_date=${trade.tradeDate}`,
    trade.orderId ? `order_id=${trade.orderId}` : null,
    `fill_count=${fills.length}`,
    tradeIds.length ? `trade_ids=${tradeIds.join('|')}` : null,
    times.length ? `executed_at=${times.join('|')}` : null,
  ].filter(Boolean).join('; ').slice(0, 2000);
}

function aggregate(trades, initialTaintedGroups = new Set()) {
  const warnings = [];
  const taintedGroups = new Set(initialTaintedGroups);
  const tradeIdState = new Map();
  const candidates = [];

  for (const trade of trades) {
    if (!trade.tradeId) {
      candidates.push(trade);
      continue;
    }
    const tradeIdentity = `${trade.scopeId}:${trade.tradeId}`;
    const state = tradeIdState.get(tradeIdentity);
    if (!state) {
      tradeIdState.set(tradeIdentity, {
        fingerprint: stableTradeFingerprint(trade),
        conflicted: false,
        groupKeys: new Set([trade.groupKey].filter(Boolean)),
      });
      candidates.push(trade);
      continue;
    }
    if (trade.groupKey) state.groupKeys.add(trade.groupKey);
    if (!state.conflicted && state.fingerprint === stableTradeFingerprint(trade)) {
      warnings.push(warning(trade.rowNumber, 'DUPLICATE_TRADE_ID', `TradeID ${trade.tradeId} 重複列已略過`));
      continue;
    }
    state.conflicted = true;
    for (const groupKey of state.groupKeys) taintedGroups.add(groupKey);
    warnings.push(warning(trade.rowNumber, 'CONFLICTING_TRADE_ID', `TradeID ${trade.tradeId} 出現衝突內容，相關 order 已封鎖`));
  }

  const groups = new Map();
  for (const trade of candidates) {
    if (!groups.has(trade.groupKey)) groups.set(trade.groupKey, []);
    groups.get(trade.groupKey).push(trade);
  }

  const entries = [];
  for (const [groupKey, fills] of groups) {
    const first = fills[0];
    if (taintedGroups.has(groupKey)) {
      warnings.push(warning(first.rowNumber, 'ORDER_TAINTED', `${groupLabel(groupKey)} 含不完整或衝突成交明細，整筆略過`));
      continue;
    }
    const sameIdentity = fills.every(fill => (
      fill.scopeId === first.scopeId
      && fill.tradeDate === first.tradeDate
      && fill.symbol === first.symbol
      && fill.side === first.side
      && fill.currency === first.currency
    ));
    if (!sameIdentity) {
      warnings.push(warning(first.rowNumber, 'ORDER_IDENTITY_CONFLICT', `${groupLabel(groupKey)} 含不同帳戶/日期/代碼/方向/幣別，整筆略過`));
      continue;
    }
    const qty = fills.reduce((sum, fill) => sum + fill.quantity, 0);
    const weighted = fills.reduce((sum, fill) => sum + fill.quantity * fill.price, 0);
    const tradeIds = fills.map(fill => fill.tradeId).filter(Boolean).sort();
    const idempotencyKey = idempotencyKeyFor(first, tradeIds);
    if (!idempotencyKey || !(qty > 0) || !Number.isFinite(weighted)) {
      warnings.push(warning(first.rowNumber, 'INVALID_ORDER_AGGREGATE', `${groupLabel(groupKey)} 無法建立安全聚合或 durable identity`));
      continue;
    }
    entries.push(Object.freeze({
      idempotencyKey,
      record: Object.freeze({
        txn_date: first.tradeDate,
        symbol: first.symbol,
        txn_type: first.side,
        qty,
        price: weighted / qty,
        fee: fills.reduce((sum, fill) => sum + fill.fee, 0),
        tax: fills.reduce((sum, fill) => sum + fill.tax, 0),
        tag: '',
        note: noteFor(first, fills, tradeIds),
      }),
      metadata: metadataFor(first, fills),
      source: Object.freeze({
        accountId: first.accountId,
        scopeId: first.scopeId,
        scopeMode: first.scopeMode,
        orderId: first.orderId || null,
        tradeIds: Object.freeze(tradeIds),
        currency: first.currency,
        fillCount: fills.length,
        firstRowNumber: first.rowNumber,
      }),
    }));
  }
  return { entries, warnings };
}

export function parseIbkrTradeCsv(input, { accountScope = '' } = {}) {
  const source = typeof input === 'string' ? input : '';
  const normalizedAccountScope = text(accountScope).toUpperCase();
  const invalid = (code, message, format = null, rows = 0) => Object.freeze({
    status: 'invalid', format, entries: Object.freeze([]),
    warnings: Object.freeze([warning(null, code, message)]),
    summary: Object.freeze({ rows, importable: 0, skipped: Math.max(1, rows) }),
  });
  if (!source.trim()) return invalid('EMPTY_FILE', '檔案為空');
  if (new TextEncoder().encode(source).byteLength > MAX_FILE_BYTES) return invalid('FILE_TOO_LARGE', '檔案超過大小上限');
  if (normalizedAccountScope && !isIbkrImportProfileScope(normalizedAccountScope)) {
    return invalid('INVALID_PROFILE_SCOPE', '匯入設定檔識別碼無效');
  }

  let rows;
  try { rows = csvRows(source); } catch { return invalid('INVALID_CSV', 'CSV 格式不完整'); }
  if (rows.length > MAX_ROWS + 10) return invalid('TOO_MANY_ROWS', `交易明細最多 ${MAX_ROWS} 列`, null, rows.length);

  const table = extractTradeTable(rows);
  const columns = columnsFor(table.headers);
  const accounts = actualAccountIds(table, columns);
  if (normalizedAccountScope && accounts.length > 1) {
    return invalid(
      'PROFILE_MULTI_ACCOUNT_CONFLICT',
      '同一匯入設定檔不可覆蓋多個不同 IBKR Account ID；請分帳戶匯出或不要使用設定檔',
      table.format,
      table.data.length,
    );
  }

  const required = ['assetClass', 'symbol', 'side', 'quantity', 'price', 'currency'];
  const missing = required.filter(key => columns[key] < 0);
  if (columns.tradeDate < 0 && columns.dateTime < 0) missing.push('tradeDate/dateTime');
  if (columns.orderId < 0 && columns.tradeId < 0) missing.push('orderId/tradeId');
  if (!normalizedAccountScope && columns.accountId < 0 && !table.fallbackAccountId) missing.push('accountId');
  if (missing.length) return invalid('MISSING_COLUMNS', `缺少必要欄位：${missing.join(', ')}`, table.format, table.data.length);

  const trades = [];
  const warnings = [];
  const taintedGroups = new Set();
  for (const item of table.data.slice(0, MAX_ROWS)) {
    const parsed = parseTrade(item, columns, table.fallbackAccountId, normalizedAccountScope);
    if (parsed.trade) trades.push(parsed.trade);
    if (parsed.skip) warnings.push(parsed.skip);
    if (parsed.taintKey) taintedGroups.add(parsed.taintKey);
  }

  const aggregated = aggregate(trades, taintedGroups);
  warnings.push(...aggregated.warnings);
  const entries = aggregated.entries.sort((left, right) => (
    left.record.txn_date.localeCompare(right.record.txn_date)
    || left.record.symbol.localeCompare(right.record.symbol)
    || left.idempotencyKey.localeCompare(right.idempotencyKey)
  ));
  return Object.freeze({
    status: entries.length ? 'ready' : 'invalid',
    format: table.format,
    entries: Object.freeze(entries),
    warnings: Object.freeze(warnings),
    summary: Object.freeze({ rows: table.data.length, importable: entries.length, skipped: warnings.length }),
  });
}

export const __test = Object.freeze({
  MAX_FILE_BYTES,
  MAX_ROWS,
  IDEMPOTENCY_KEY_RE,
  csvRows,
  dateOnly,
  statementAccount,
  statementAccounts,
  actualAccountIds,
  groupLabel,
  normalizeAuthoritativeExecutedAt,
  executionSequenceFor,
  metadataFor,
});