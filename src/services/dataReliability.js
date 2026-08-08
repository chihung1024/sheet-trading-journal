const asBoundedText = (value, fallback = '', maxLength = 240) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;
  return text.slice(0, maxLength);
};

const normalizeGroupName = (group) => asBoundedText(group, 'all', 120);

export const selectPortfolioGroupData = (rawData, group = 'all') => {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return {};
  const groupName = normalizeGroupName(group);
  const groups = rawData.groups;
  if (
    groups
    && typeof groups === 'object'
    && !Array.isArray(groups)
    && groups[groupName]
    && typeof groups[groupName] === 'object'
    && !Array.isArray(groups[groupName])
  ) {
    return groups[groupName];
  }
  return rawData;
};

export const getPortfolioAnomalies = (rawData, group = 'all') => {
  const groupData = selectPortfolioGroupData(rawData, group);
  return Array.isArray(groupData.anomalies) ? groupData.anomalies : [];
};

const anomalyKey = anomaly => [
  anomaly.code,
  anomaly.symbol,
  anomaly.date,
  anomaly.currency,
  anomaly.message,
].join('|');

export const normalizePortfolioAnomaly = (value) => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const code = asBoundedText(raw.code, 'UNKNOWN_ANOMALY', 80);
  const symbol = asBoundedText(raw.symbol, '', 40);
  const date = asBoundedText(raw.date, '', 32);
  const currency = asBoundedText(raw.currency, '', 16);
  const rawMessage = asBoundedText(raw.message, '', 300);

  if (code === 'DIVIDEND_POLICY_REVIEW_REQUIRED') {
    const subject = [symbol, date].filter(Boolean).join(' ');
    const currencyLabel = currency || '該幣別';
    return {
      key: anomalyKey({ code, symbol, date, currency, message: rawMessage }),
      source: 'snapshot_anomaly',
      severity: 'warning',
      code,
      title: '配息需人工確認',
      message: `${subject ? `${subject}：` : ''}${currencyLabel} 預扣稅政策尚未審核，因此系統沒有自動估算這筆待確認配息。請依實際入帳金額建立或確認 DIV 紀錄。`,
      symbol,
      date,
      currency,
    };
  }

  return {
    key: anomalyKey({ code, symbol, date, currency, message: rawMessage }),
    source: 'snapshot_anomaly',
    severity: 'warning',
    code,
    title: '計算警示',
    message: rawMessage || `後端回報資料異常（${code}），請先確認資料再依此結果操作。`,
    symbol,
    date,
    currency,
  };
};

const uniqueNormalizedAnomalies = anomalies => {
  const seen = new Set();
  const normalized = [];
  for (const value of Array.isArray(anomalies) ? anomalies : []) {
    const anomaly = normalizePortfolioAnomaly(value);
    if (seen.has(anomaly.key)) continue;
    seen.add(anomaly.key);
    normalized.push(anomaly);
  }
  return normalized;
};

export const buildDataReliabilityIssues = ({
  connectionStatus = 'unknown',
  snapshotFreshness = 'unknown',
  anomalies = [],
} = {}) => {
  const issues = [];

  if (connectionStatus === 'error') {
    issues.push({
      key: 'connection-error',
      source: 'connection',
      severity: 'error',
      title: '最新資料讀取失敗',
      message: '目前畫面可能仍保留上一次成功載入的快照。重新載入成功前，請勿把目前持倉、績效或配息推算視為最新結果。',
      retryable: true,
    });
  }

  if (snapshotFreshness === 'stale') {
    issues.push({
      key: 'snapshot-stale',
      source: 'snapshot',
      severity: 'warning',
      title: '持倉與績效快照待重新計算',
      message: '交易紀錄已變更，但後端尚未確認發布新的計算快照。請等待背景計算完成或手動觸發重算。',
      retryable: false,
    });
  }

  issues.push(...uniqueNormalizedAnomalies(anomalies));
  return issues;
};
