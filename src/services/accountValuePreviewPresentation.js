const finiteNumber = value => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const READY_METHOD = 'securities_plus_authoritative_cash_v1';
const READY_FX_POLICY = 'engine_current_valuation_fx_context';

const unavailableMessage = reason => ({
  cash_evidence_unavailable: '現金資料暫時無法驗證',
  cash_ledger_incomplete: '現金帳本尚未完成完整性檢查',
  cash_fx_unavailable: '現金幣別缺少可用的計算引擎匯率',
  securities_value_invalid: '持倉市值暫時無法驗證',
}[reason] || '帳戶價值預覽暫時無法驗證');

export const buildAccountValuePreviewPresentation = ({
  preview,
  currentGroup = 'all',
} = {}) => {
  // Cash is account-level. There is no reviewed tag/group cash-allocation authority.
  if (currentGroup !== 'all') {
    return Object.freeze({ status: 'hidden' });
  }

  if (!preview || typeof preview !== 'object') {
    return Object.freeze({ status: 'hidden' });
  }

  const contractValid = preview.preview_version === 1
    && preview.base_currency === 'TWD'
    && preview.method === READY_METHOD
    && preview.fx_policy === READY_FX_POLICY;
  if (!contractValid) {
    return Object.freeze({
      status: 'unavailable',
      message: '帳戶價值預覽版本無法驗證',
      reason: 'contract_invalid',
      missingFxCurrencies: Object.freeze([]),
    });
  }

  if (preview.status !== 'ready') {
    return Object.freeze({
      status: 'unavailable',
      message: unavailableMessage(preview.reason),
      reason: String(preview.reason || ''),
      missingFxCurrencies: Object.freeze(
        Array.isArray(preview.missing_cash_fx_currencies)
          ? preview.missing_cash_fx_currencies.map(value => String(value))
          : [],
      ),
    });
  }

  const accountValueTwd = finiteNumber(preview.account_value_twd);
  const securitiesValueTwd = finiteNumber(preview.securities_value_twd);
  const cashValueTwd = finiteNumber(preview.cash_value_twd);
  if (
    preview.cash_ledger_complete !== true
    || accountValueTwd === null
    || securitiesValueTwd === null
    || cashValueTwd === null
  ) {
    return Object.freeze({
      status: 'unavailable',
      message: '帳戶價值預覽內容無法驗證',
      reason: 'contract_invalid',
      missingFxCurrencies: Object.freeze([]),
    });
  }

  // Deliberately do not recompute accountValueTwd from securities + cash here.
  // Python is the financial authority; the browser only validates shape and renders.
  return Object.freeze({
    status: 'ready',
    accountValueTwd,
    securitiesValueTwd,
    cashValueTwd,
    componentCount: Array.isArray(preview.cash_components)
      ? preview.cash_components.length
      : 0,
  });
};
