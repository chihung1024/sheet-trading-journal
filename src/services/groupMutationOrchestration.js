export function summarizeGroupBatchFailure(error, { refreshed }) {
  const succeeded = Number.isSafeInteger(error?.succeeded) ? error.succeeded : 0;
  const total = Number.isSafeInteger(error?.total) ? error.total : 0;
  const failedRecordId = error?.failedRecordId ?? null;
  const failedOutcomeAmbiguous = error?.failedOutcomeAmbiguous === true;
  const mutationMayHaveCommitted = succeeded > 0 || failedOutcomeAmbiguous;

  return Object.freeze({
    succeeded,
    total,
    failedRecordId,
    failedOutcomeAmbiguous,
    refreshed: refreshed === true,
    mutationMayHaveCommitted,
    shouldRecalculate: mutationMayHaveCommitted,
  });
}

export function formatGroupBatchFailureMessage(summary) {
  const failedId = summary.failedRecordId ? `（紀錄 #${summary.failedRecordId}）` : '';
  const stateText = summary.refreshed
    ? '已重新載入目前狀態'
    : '畫面未能重新載入，請重新整理頁面確認目前狀態';

  if (summary.failedOutcomeAmbiguous) {
    return `批次結果不確定：已確認更新 ${summary.succeeded}/${summary.total} 筆${failedId}，失敗位置的請求可能已由伺服器完成；${stateText}。請勿直接重送整批。`;
  }

  if (summary.succeeded > 0) {
    return `批次未完成：已更新 ${summary.succeeded}/${summary.total} 筆${failedId}；${stateText}`;
  }

  return `更新失敗${failedId}；${stateText}`;
}
