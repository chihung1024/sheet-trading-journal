const presentation = (className, label, title) => Object.freeze({
  className,
  label,
  title,
});

export function buildDataSyncPresentation({
  loading = false,
  isPolling = false,
  connectionStatus = 'unknown',
  snapshotFreshness = 'unknown',
  verified = false,
} = {}) {
  if (loading) {
    return presentation(
      'loading',
      '載入資料中',
      '正在載入交易、持倉與績效資料',
    );
  }

  if (isPolling) {
    return presentation(
      'polling',
      '資料更新中',
      '最新交易已收到，持倉與績效正在更新',
    );
  }

  if (connectionStatus === 'error') {
    return presentation(
      'error',
      '連線異常',
      '暫時無法取得最新資料；畫面可能保留上一次成功載入的內容',
    );
  }

  if (snapshotFreshness === 'stale') {
    return presentation(
      'stale',
      '資料待更新',
      '交易紀錄已變更，持倉與績效尚未完成最新同步',
    );
  }

  // A successful portfolio GET only means the snapshot was loaded. The existing
  // cryptographic verification proof is the authority for claiming that the exact
  // snapshot and record objects currently shown are synchronized.
  if (connectionStatus === 'connected' && verified === true) {
    return presentation(
      'ready',
      '資料已同步',
      '目前交易紀錄與持倉、績效資料已完成一致性驗證',
    );
  }

  if (connectionStatus === 'connected' && snapshotFreshness === 'loaded') {
    return presentation(
      'loading',
      '驗證資料中',
      '資料已載入，正在確認與目前交易紀錄一致',
    );
  }

  if (connectionStatus === 'connected') {
    return presentation(
      'loading',
      '準備資料中',
      '連線已建立，正在準備最新資料',
    );
  }

  return presentation(
    'unknown',
    '連線中',
    '正在確認資料服務狀態',
  );
}