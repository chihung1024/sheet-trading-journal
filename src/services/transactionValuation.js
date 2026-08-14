import { detectNativeCurrency } from './instrumentCurrency.js';
import { isSnapshotRecordVerified } from './snapshotVerification.js';

const finiteNumber = value => {
  if (
    value === null
    || value === undefined
    || typeof value === 'boolean'
    || (typeof value === 'string' && value.trim() === '')
  ) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizedTransactionType = record => String(record?.txn_type || '').trim().toUpperCase();

/**
 * Mirror the authoritative PortfolioCalculator transaction cash-flow semantics.
 * BUY consumes cash; SELL and confirmed DIV produce cash. Commission/tax are
 * used exactly as the normalized source ledger supplies them; the current Worker
 * accepts any finite fee/tax and main.prepare_transactions() does not change sign.
 * Confirmed DIV records already carry the actual cash-flow price, so fee/tax are
 * not applied a second time.
 */
export const resolveNetCashflowNative = record => {
  const qty = finiteNumber(record?.qty);
  const price = finiteNumber(record?.price);
  const commission = finiteNumber(record?.fee ?? record?.commission ?? 0);
  const tax = finiteNumber(record?.tax ?? 0);
  const txnType = normalizedTransactionType(record);

  if (
    qty == null
    || price == null
    || commission == null
    || tax == null
    || qty <= 0
    || price < 0
  ) return null;

  const gross = qty * price;
  if (txnType === 'BUY') return -(gross + commission + tax);
  if (txnType === 'SELL') return gross - commission - tax;
  if (txnType === 'DIV') return gross;
  return null;
};

export const resolveSettlementAmountNative = record => {
  const cashflow = resolveNetCashflowNative(record);
  if (cashflow == null) return null;
  return normalizedTransactionType(record) === 'BUY' ? -cashflow : cashflow;
};

const exactHistoryRow = (snapshot, txnDate) => {
  const target = String(txnDate || '').trim();
  if (!target || !Array.isArray(snapshot?.history)) return null;
  return snapshot.history.find(row => String(row?.date || '').trim() === target) || null;
};

/**
 * Read the exact transaction-date FX context already published by Python.
 * Never infer FX from a nearby date in the browser. Foreign-currency FX is usable
 * only when existing Phase 3 snapshot integrity has cryptographically verified the
 * exact snapshot + record object pair. Older USD-only snapshots may then use the
 * same row's legacy scalar fx_rate; no hard-coded fallback is permitted.
 */
export const resolveAuthoritativeTransactionFx = (snapshot, record) => {
  const currency = detectNativeCurrency(record?.symbol);
  if (currency === 'TWD') {
    return { currency, fxRate: 1, source: 'base-currency' };
  }

  if (!isSnapshotRecordVerified(snapshot, record)) return null;

  const row = exactHistoryRow(snapshot, record?.txn_date);
  if (!row) return null;

  const rawRates = row._raw_fx_rates;
  if (rawRates && typeof rawRates === 'object' && !Array.isArray(rawRates)) {
    const rate = finiteNumber(rawRates[currency]);
    if (rate != null && rate > 0) {
      return { currency, fxRate: rate, source: 'snapshot-fx-context' };
    }
  }

  if (currency === 'USD') {
    const legacyRate = finiteNumber(row.fx_rate);
    if (legacyRate != null && legacyRate > 0) {
      return { currency, fxRate: legacyRate, source: 'legacy-usd-reference' };
    }
  }

  return null;
};

export const resolveTransactionValuation = (snapshot, record) => {
  const netCashflowNative = resolveNetCashflowNative(record);
  const fx = resolveAuthoritativeTransactionFx(snapshot, record);
  if (netCashflowNative == null || !fx) return null;

  const netCashflowTwd = netCashflowNative * fx.fxRate;
  if (!Number.isFinite(netCashflowTwd)) return null;

  const isBuy = normalizedTransactionType(record) === 'BUY';
  return {
    currency: fx.currency,
    fxRate: fx.fxRate,
    fxSource: fx.source,
    netCashflowNative,
    netCashflowTwd,
    settlementAmountNative: isBuy ? -netCashflowNative : netCashflowNative,
    settlementAmountTwd: isBuy ? -netCashflowTwd : netCashflowTwd,
  };
};
