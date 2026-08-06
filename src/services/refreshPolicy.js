export function shouldScheduleMarketRefresh({
  enabled,
  paused,
  visible,
  marketHours,
  hasToken,
  tokenExpired,
}) {
  return Boolean(
    enabled
    && !paused
    && visible
    && marketHours
    && hasToken
    && !tokenExpired
  );
}

export function shouldTriggerMarketRefresh({
  enabled,
  paused,
  visible,
  marketHours,
  hasToken,
  tokenExpired,
  busy,
  running,
}) {
  return shouldScheduleMarketRefresh({
    enabled,
    paused,
    visible,
    marketHours,
    hasToken,
    tokenExpired,
  }) && !busy && !running;
}
